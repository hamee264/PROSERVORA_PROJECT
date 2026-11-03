const express = require("express");

const {
  getMyPayments,
  initializePayment,
  verifyPayment,
} = require("../controllers/paymentController");

const {
  authenticate,
  requireRole,
} = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// CUSTOMER PAYMENTS
// ============================================================

router.get(
  "/",
  authenticate,
  requireRole("customer"),
  getMyPayments,
);

// Initialize payment for an accepted booking
router.post(
  "/initialize",
  authenticate,
  requireRole("customer"),
  initializePayment,
);

// Verify Paystack payment
router.post(
  "/verify",
  authenticate,
  requireRole("customer"),
  verifyPayment,
);

module.exports = router;