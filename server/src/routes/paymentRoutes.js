const express = require("express");

const {
  initializePayment,
  verifyPayment,
  releasePayment,
} = require("../controllers/paymentController");

const { authenticate, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// CUSTOMER PAYMENTS
// ============================================================

// Initialize payment
router.post(
  "/initialize",
  authenticate,
  requireRole("customer"),
  initializePayment,
);

// Verify payment
router.post("/verify", authenticate, requireRole("customer"), verifyPayment);

// Release payment
router.post("/release", authenticate, requireRole("customer"), releasePayment);

module.exports = router;
