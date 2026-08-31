const express = require("express");

const {
  handlePayoutWebhook,
} = require("../controllers/payoutWebhookController");

const router = express.Router();

router.post("/", handlePayoutWebhook);

module.exports = router;
