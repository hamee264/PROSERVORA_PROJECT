const express = require("express");

const {
  createDispute,
  getMyDisputes,
  getDispute,
} = require("../controllers/disputeController");

const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// ALL DISPUTE ROUTES REQUIRE AUTHENTICATION
// ============================================================

// Create a dispute
router.post("/", authenticate, createDispute);

// Get my disputes
router.get("/", authenticate, getMyDisputes);

// Get a single dispute
router.get("/:disputeId", authenticate, getDispute);

module.exports = router;
