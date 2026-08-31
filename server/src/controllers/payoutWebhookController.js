const crypto = require("crypto");

const {
  handleTransferSuccess,
  handleTransferFailed,
  handleTransferReversed,
} = require("../services/payoutService");
// ============================================================
// VERIFY PAYSTACK SIGNATURE
// ============================================================

const verifyPaystackSignature = (req) => {
  const signature = req.headers["x-paystack-signature"];

  if (!signature) {
    return false;
  }

  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(req.body)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
};

// ============================================================
// PAYOUT WEBHOOK
// ============================================================

const handlePayoutWebhook = async (req, res) => {
  try {
    // ========================================================
    // VERIFY SIGNATURE
    // ========================================================

    if (!verifyPaystackSignature(req)) {
      return res.status(401).json({
        success: false,
        message: "Invalid Paystack signature",
      });
    }

    // Convert raw body back to JSON
    const event = JSON.parse(req.body.toString());

    console.log("Paystack payout webhook:", event.event);

    // ========================================================
    // SUCCESS
    // ========================================================

    // ========================================================
    // SUCCESS
    // ========================================================

    if (event.event === "transfer.success") {
      await handleTransferSuccess(event.data);

      return res.status(200).json({
        success: true,
        message: "Payout success processed",
      });
    }

    // ========================================================
    // FAILED
    // ========================================================

    if (event.event === "transfer.failed") {
      await handleTransferFailed(event.data);

      return res.status(200).json({
        success: true,
        message: "Payout failure processed",
      });
    }

    // ========================================================
    // REVERSED
    // ========================================================

    if (event.event === "transfer.reversed") {
      await handleTransferReversed(event.data);

      return res.status(200).json({
        success: true,
        message: "Payout reversal processed",
      });
    }

    // ========================================================
    // OTHER EVENTS
    // ========================================================

    return res.status(200).json({
      success: true,
      message: "Webhook received",
    });
  } catch (error) {
    console.error("Payout webhook error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Webhook processing failed",
    });
  }
};

module.exports = {
  handlePayoutWebhook,
};
