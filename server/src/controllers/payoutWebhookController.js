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
  const signature =
    req.headers["x-paystack-signature"];

  if (!signature) {
    return false;
  }

  const secretKey =
    process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    console.error(
      "PAYSTACK_SECRET_KEY is not configured",
    );

    return false;
  }

  if (!Buffer.isBuffer(req.body)) {
    console.error(
      "Paystack payout webhook body is not a raw Buffer",
    );

    return false;
  }

  const hash = crypto
    .createHmac("sha512", secretKey)
    .update(req.body)
    .digest("hex");

  let expectedSignature;
  let providedSignature;

  try {
    expectedSignature = Buffer.from(
      hash,
      "hex",
    );

    providedSignature = Buffer.from(
      String(signature),
      "hex",
    );
  } catch (error) {
    return false;
  }

  // timingSafeEqual requires equal-length buffers.
  if (
    expectedSignature.length !==
    providedSignature.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedSignature,
    providedSignature,
  );
};

// ============================================================
// PAYOUT WEBHOOK
// ============================================================

const handlePayoutWebhook = async (
  req,
  res,
) => {
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

    // ========================================================
    // PARSE RAW BODY
    // ========================================================

    let event;

    try {
      event = JSON.parse(
        req.body.toString("utf8"),
      );
    } catch (error) {
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

    if (
      !event.data ||
      typeof event.data !== "object"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid transfer payload",
      });
    }

    console.log(
      "Paystack payout webhook:",
      event.event,
    );

    // ========================================================
    // TRANSFER SUCCESS
    // ========================================================

    if (
      event.event === "transfer.success"
    ) {
      const result =
        await handleTransferSuccess(
          event.data,
        );

      return res.status(200).json({
        success: true,
        message:
          result.alreadyProcessed
            ? "Payout success already processed"
            : "Payout success processed",
        result,
      });
    }

    // ========================================================
    // TRANSFER FAILED
    // ========================================================

    if (
      event.event === "transfer.failed"
    ) {
      const result =
        await handleTransferFailed(
          event.data,
        );

      return res.status(200).json({
        success: true,
        message:
          result.alreadyProcessed
            ? "Payout failure already processed"
            : "Payout failure processed",
        result,
      });
    }

    // ========================================================
    // TRANSFER REVERSED
    // ========================================================

    if (
      event.event === "transfer.reversed"
    ) {
      const result =
        await handleTransferReversed(
          event.data,
        );

      return res.status(200).json({
        success: true,
        message:
          result.alreadyProcessed
            ? "Payout reversal already processed"
            : "Payout reversal processed",
        result,
      });
    }

    // ========================================================
    // OTHER EVENTS
    // ========================================================

    return res.status(200).json({
      success: true,
      message: "Webhook event ignored",
    });
  } catch (error) {
    console.error(
      "Payout webhook error:",
      error,
    );

    return res.status(
      error.statusCode || 500,
    ).json({
      success: false,
      message:
        error.message ||
        "Webhook processing failed",
    });
  }
};

module.exports = {
  handlePayoutWebhook,
};