const express = require("express");

const {
  handlePaystackWebhook,
} = require("../controllers/paymentWebhookController");

const router = express.Router();

// ============================================================
// PAYSTACK PAYMENT WEBHOOK
// ============================================================
//
// IMPORTANT:
// This route must receive the raw request body so the Paystack
// signature can be verified against the exact bytes Paystack sent.
//

router.post(
  "/paystack",
  express.raw({
    type: "application/json",
  }),
  handlePaystackWebhook,
);

module.exports = router;