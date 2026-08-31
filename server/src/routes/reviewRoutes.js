const express = require("express");

const { createReview } = require("../controllers/reviewController");

const { authenticate, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// CUSTOMER - CREATE REVIEW
// ============================================================

router.post("/", authenticate, requireRole("customer"), createReview);

module.exports = router;
