const express = require("express");

const {
  handlePayoutWebhook,
} = require("../controllers/payoutWebhookController");

const router = express.Router();

// ============================================================
// PAYSTACK PAYOUT WEBHOOK
// ============================================================
//
// IMPORTANT:
//
// This route MUST receive the raw request body because
// Paystack's HMAC signature is calculated from the exact
// bytes Paystack sent.
//

router.post(
  "/",
  express.raw({
    type: "application/json",
  }),
  handlePayoutWebhook,
);

module.exports = router;