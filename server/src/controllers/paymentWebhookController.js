const crypto = require("crypto");
const pool = require("../config/database");
const paymentService = require("../services/paymentService");

// ============================================================
// PAYSTACK WEBHOOK
// ============================================================

const handlePaystackWebhook = async (req, res) => {
  try {
    // ==========================================================
    // VERIFY PAYSTACK SIGNATURE
    // ==========================================================
    const signature = req.headers["x-paystack-signature"];

    if (!signature) {
      return res.status(401).json({
        success: false,
        message: "Missing Paystack signature",
      });
    }

    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest("hex");

    const signatureBuffer = Buffer.from(signature, "hex");
    const hashBuffer = Buffer.from(hash, "hex");

    if (
      signatureBuffer.length !== hashBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, hashBuffer)
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid Paystack signature",
      });
    }

    // ==========================================================
    // GET EVENT
    // ==========================================================

    const event = req.body;

    console.log("Paystack webhook received:", event.event);

    // ==========================================================
    // ONLY HANDLE SUCCESSFUL CHARGES
    // ==========================================================

    if (event.event !== "charge.success") {
      return res.status(200).json({
        success: true,
        message: "Event ignored",
      });
    }

    const paystackData = event.data;

    // ==========================================================
    // BASIC VALIDATION
    // ==========================================================

    if (!paystackData || !paystackData.reference) {
      return res.status(400).json({
        success: false,
        message: "Invalid Paystack webhook payload",
      });
    }

    const reference = paystackData.reference;

    // ==========================================================
    // FIND PAYMENT
    // ==========================================================

    const paymentResult = await pool.query(
      `
      SELECT
        id,
        booking_id,
        customer_id,
        provider_id,
        amount,
        currency,
        platform_fee,
        processing_fee,
        customer_total,
        provider_amount,
        payment_provider,
        provider_transaction_id,
        status,
        paid_at,
        released_at,
        refunded_at

      FROM payments

      WHERE provider_transaction_id = $1

      LIMIT 1
      `,
      [reference],
    );

    if (paymentResult.rows.length === 0) {
      console.error("Paystack webhook payment not found:", reference);

      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    const payment = paymentResult.rows[0];

    // ==========================================================
    // ONLY PAYSTACK PAYMENTS
    // ==========================================================

    if (payment.payment_provider !== "paystack") {
      return res.status(400).json({
        success: false,
        message: "Unsupported payment provider",
      });
    }

    // ==========================================================
    // CHECK STATUS
    // ==========================================================

    if (paystackData.status !== "success") {
      return res.status(200).json({
        success: true,
        message: "Payment was not successful",
      });
    }

    // ==========================================================
    // CHECK CURRENCY
    // ==========================================================

    if (paystackData.currency !== payment.currency) {
      console.error("Webhook currency mismatch:", {
        paymentCurrency: payment.currency,
        paystackCurrency: paystackData.currency,
        paymentId: payment.id,
      });

      return res.status(400).json({
        success: false,
        message: "Payment currency mismatch",
      });
    }

    // ==========================================================
    // CHECK AMOUNT
    // ==========================================================

    const expectedAmount = Math.round(Number(payment.customer_total) * 100);

    const receivedAmount = Number(paystackData.amount);

    if (receivedAmount !== expectedAmount) {
      console.error("Webhook amount mismatch:", {
        paymentId: payment.id,
        expectedAmount,
        receivedAmount,
      });

      return res.status(400).json({
        success: false,
        message: "Payment amount mismatch",
      });
    }

    // ==========================================================
    // ALREADY PROCESSED
    // ==========================================================

    if (payment.status === "paid" || payment.status === "released") {
      console.log("Paystack webhook already processed:", payment.id);

      return res.status(200).json({
        success: true,
        message: "Payment already processed",
      });
    }

    // ==========================================================
    // DATABASE TRANSACTION
    // ==========================================================

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // ========================================================
      // LOCK PAYMENT
      // ========================================================

      const lockedPaymentResult = await client.query(
        `
        SELECT
          id,
          booking_id,
          customer_id,
          provider_id,
          amount,
          currency,
          platform_fee,
          processing_fee,
          customer_total,
          provider_amount,
          payment_provider,
          provider_transaction_id,
          status,
          paid_at,
          released_at,
          refunded_at

        FROM payments

        WHERE id = $1

        FOR UPDATE
        `,
        [payment.id],
      );

      if (lockedPaymentResult.rows.length === 0) {
        throw new Error("Payment no longer exists");
      }

      const lockedPayment = lockedPaymentResult.rows[0];

      // ========================================================
      // RACE CONDITION / DUPLICATE WEBHOOK
      // ========================================================

      if (
        lockedPayment.status === "paid" ||
        lockedPayment.status === "released"
      ) {
        await client.query("COMMIT");

        return res.status(200).json({
          success: true,
          message: "Payment already processed",
        });
      }

      // ========================================================
      // MARK PAYMENT AS PAID
      // ========================================================

      const updatedPaymentResult = await client.query(
        `
        UPDATE payments

        SET
          status = 'paid',

          paid_at = COALESCE($1, NOW()),

          provider_transaction_id = $2,

          updated_at = NOW()

        WHERE id = $3

        RETURNING
          id,
          booking_id,
          customer_id,
          provider_id,
          amount,
          currency,
          platform_fee,
          processing_fee,
          customer_total,
          provider_amount,
          payment_provider,
          provider_transaction_id,
          status,
          paid_at,
          released_at,
          refunded_at,
          created_at,
          updated_at
        `,
        [
          paystackData.paid_at ? new Date(paystackData.paid_at) : null,

          paystackData.reference,

          lockedPayment.id,
        ],
      );

      const updatedPayment = updatedPaymentResult.rows[0];

      // ========================================================
      // CREATE PAYMENT TRANSACTION
      // ========================================================

      const paymentTransaction = await paymentService.createPaymentTransaction(
        updatedPayment,
        paystackData.reference,
        client,
      );

      // ========================================================
      // CREDIT PROVIDER PENDING WALLET
      // ========================================================

      const walletResult = await paymentService.creditProviderPendingWallet(
        updatedPayment.id,
        client,
      );

      // ========================================================
      // COMMIT
      // ========================================================

      await client.query("COMMIT");

      console.log(
        "Paystack payment processed successfully:",
        updatedPayment.id,
      );

      return res.status(200).json({
        success: true,
        message: "Payment processed successfully",
        payment: updatedPayment,
        paymentTransaction,
        wallet: walletResult.wallet || null,
        walletTransaction: walletResult.transaction || null,
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Webhook rollback error:", rollbackError);
      }

      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Paystack webhook error:", error);

    return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};

module.exports = {
  handlePaystackWebhook,
};
