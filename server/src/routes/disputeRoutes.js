const express = require("express");

const {
  createDispute,
  getMyDisputes,
  getDispute,
  addDisputeMessage,
} = require("../controllers/disputeController");

const {
  authenticate,
} = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// ALL DISPUTE ROUTES REQUIRE AUTHENTICATION
// ============================================================

// Create dispute
router.post(
  "/",
  authenticate,
  createDispute,
);

// Get my disputes
router.get(
  "/",
  authenticate,
  getMyDisputes,
);

// Get single dispute
router.get(
  "/:disputeId",
  authenticate,
  getDispute,
);

// Add message to dispute
router.post(
  "/:disputeId/messages",
  authenticate,
  addDisputeMessage,
);

module.exports = router;