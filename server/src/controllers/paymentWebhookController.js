const crypto = require("crypto");

const pool = require("../config/database");
const paymentService = require("../services/paymentService");
const adminDisputeService = require("../services/adminDisputeService");
const notificationService = require("../services/notificationService");

// ============================================================
// PAYSTACK WEBHOOK
// ============================================================

const handlePaystackWebhook = async (req, res) => {
  try {
    // ========================================================
    // VERIFY PAYSTACK SIGNATURE
    // ========================================================

    const signature = req.headers["x-paystack-signature"];

    if (!signature) {
      return res.status(401).json({
        success: false,
        message: "Missing Paystack signature",
      });
    }

    // The webhook route uses express.raw(), so req.body should
    // be the exact Buffer received from Paystack.
    if (!Buffer.isBuffer(req.body)) {
      console.error(
        "Paystack webhook body is not a raw Buffer",
      );

      return res.status(500).json({
        success: false,
        message: "Invalid webhook body",
      });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      console.error(
        "PAYSTACK_SECRET_KEY is not configured",
      );

      return res.status(500).json({
        success: false,
        message: "Payment webhook is not configured",
      });
    }

    const hash = crypto
      .createHmac("sha512", secretKey)
      .update(req.body)
      .digest("hex");

    // ========================================================
    // CONSTANT-TIME SIGNATURE COMPARISON
    // ========================================================

    let providedSignature;

    try {
      providedSignature = Buffer.from(
        signature,
        "hex",
      );
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid Paystack signature",
      });
    }

    const expectedSignature = Buffer.from(
      hash,
      "hex",
    );

    if (
      providedSignature.length !==
      expectedSignature.length ||
      !crypto.timingSafeEqual(
        providedSignature,
        expectedSignature,
      )
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid Paystack signature",
      });
    }

    // ========================================================
    // PARSE WEBHOOK BODY
    // ========================================================

    let event;

    try {
      event = JSON.parse(
        req.body.toString("utf8"),
      );
    } catch (error) {
      console.error(
        "Invalid Paystack webhook JSON:",
        error,
      );

      return res.status(400).json({
        success: false,
        message: "Invalid webhook payload",
      });
    }

    // ========================================================
    // BASIC EVENT VALIDATION
    // ========================================================

    if (
      !event ||
      typeof event !== "object" ||
      !event.event
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook event",
      });
    }

    // ========================================================
    // REFUND EVENTS
    // ========================================================

    if (
      event.event === "refund.pending" ||
      event.event === "refund.processing" ||
      event.event === "refund.needs_attention" ||
      event.event === "refund.processed" ||
      event.event === "refund.failed"
    ) {
      const result =
        await paymentService.processRefundWebhook(
          event.event,
          event.data,
        );

      if (
        result.found &&
        result.refundId
      ) {
        await adminDisputeService.handleRefundWebhookNotification(
          result.refundId,
          result.status,
        );
      }

      return res.status(200).json({
        success: true,
        message: "Refund webhook processed",
        result,
      });
    }

    // ========================================================
    // NORMAL PAYMENT
    // ========================================================

    if (event.event !== "charge.success") {
      return res.status(200).json({
        success: true,
        message: "Event ignored",
      });
    }

    const data = event.data;

    if (
      !data ||
      !data.reference ||
      data.status !== "success"
    ) {
      return res.status(200).json({
        success: true,
        message: "Payment was not successful",
      });
    }

    // ========================================================
    // FIND PAYMENT
    // ========================================================

    const paymentResult = await pool.query(
      `
        SELECT
          id,
          payment_provider,
          customer_total,
          currency,
          status,
          provider_transaction_id

        FROM payments

        WHERE provider_transaction_id = $1

        LIMIT 1
      `,
      [data.reference],
    );

    if (!paymentResult.rows.length) {
      console.error(
        "Paystack webhook payment not found:",
        data.reference,
      );

      // Returning 404 causes Paystack to retry the webhook.
      // This is useful if the webhook arrives before the local
      // payment record/reference has been persisted.
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    const payment = paymentResult.rows[0];

    // ========================================================
    // VALIDATE PAYMENT PROVIDER
    // ========================================================

    if (
      payment.payment_provider !== "paystack"
    ) {
      return res.status(400).json({
        success: false,
        message: "Unsupported payment provider",
      });
    }

    // ========================================================
    // VALIDATE CURRENCY
    // ========================================================

    if (
      String(data.currency).toUpperCase() !==
      String(payment.currency).toUpperCase()
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment currency mismatch",
      });
    }

    // ========================================================
    // VALIDATE AMOUNT
    // ========================================================

    const expectedAmount = Math.round(
      Number(payment.customer_total) * 100,
    );

    const receivedAmount = Number(data.amount);

    if (
      !Number.isFinite(receivedAmount) ||
      receivedAmount !== expectedAmount
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment amount mismatch",
      });
    }

    // ========================================================
    // IDEMPOTENCY CHECK
    // ========================================================

    if (
      payment.status === "paid" ||
      payment.status === "released"
    ) {
      return res.status(200).json({
        success: true,
        message: "Payment already processed",
      });
    }

    // ========================================================
    // PROCESS PAYMENT
    // ========================================================

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result =
        await paymentService.processSuccessfulPayment(
          payment.id,
          data,
          client,
        );

      await client.query("COMMIT");

      // ======================================================
      // NOTIFICATIONS
      // ======================================================

      if (!result.alreadyProcessed) {
        try {
          await notificationService.createNotification({
            userId:
              result.payment.customer_id,

            type: "payment_successful",

            title: "Payment Successful",

            message: `Your payment of ₦${Number(
              result.payment.customer_total,
            ).toLocaleString()} was successful.`,

            actionUrl:
              `/payments/${result.payment.id}`,
          });

          await notificationService.createNotification({
            userId:
              result.payment.provider_id,

            type: "payment_received",

            title: "Payment Received",

            message: `₦${Number(
              result.payment.provider_amount,
            ).toLocaleString()} has been received and is being held until the job is completed.`,

            actionUrl: "/wallet",
          });
        } catch (notificationError) {
          // Notification failure must never cause the
          // successful payment transaction to be rolled back.
          console.error(
            "Webhook notification error:",
            notificationError,
          );
        }
      }

      // ======================================================
      // RESPONSE
      // ======================================================

      return res.status(200).json({
        success: true,

        message:
          result.alreadyProcessed
            ? "Payment already processed"
            : "Payment processed successfully",

        payment: result.payment,

        paymentTransaction:
          result.paymentTransaction,

        wallet: result.wallet,

        walletTransaction:
          result.walletTransaction,
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Webhook rollback error:",
          rollbackError,
        );
      }

      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(
      "Paystack webhook error:",
      error,
    );

    return res.status(
      error.statusCode || 500,
    ).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};

module.exports = {
  handlePaystackWebhook,
};