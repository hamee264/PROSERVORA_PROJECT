require("dotenv").config();

const crypto = require("crypto");

const payload = JSON.stringify({
  event: "transfer.failed",
  data: {
    reference: "PAYOUT-TEST-123456",
    amount: 4950000,
    status: "failed",
    reason: "Test transfer failure",
  },
});

const signature = crypto
  .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
  .update(payload)
  .digest("hex");

fetch("http://localhost:3000/api/webhooks/paystack/payouts", {
  method: "POST",

  headers: {
    "Content-Type": "application/json",
    "x-paystack-signature": signature,
  },

  body: payload,
})
  .then(async (response) => {
    console.log("Status:", response.status);
    console.log("Response:", await response.text());
  })
  .catch((error) => {
    console.error("Request failed:", error);
  });
