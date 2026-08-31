const express = require("express");

const {
  handlePaystackWebhook,
} = require("../controllers/paymentWebhookController");

const router = express.Router();

router.post("/paystack", handlePaystackWebhook);

module.exports = router;
