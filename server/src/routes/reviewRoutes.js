const express = require("express");

const {
  createReview,
  getProviderReviews,
} = require("../controllers/reviewController");

const { authenticate, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// PROVIDER - GET REVIEWS
// ============================================================

router.get("/me", authenticate, requireRole("provider"), getProviderReviews);

// ============================================================
// CUSTOMER - CREATE REVIEW
// ============================================================

router.post("/", authenticate, requireRole("customer"), createReview);

module.exports = router;
