const express = require("express");

const { authenticate, requireRole } = require("../middleware/authMiddleware");

const {
  getPayoutPreview,
  getWallet,
  requestPayout,
  getPayoutHistory,
  getPayout,
} = require("../controllers/payoutController");

const router = express.Router();

// ============================================================
// PROVIDER WALLET
// ============================================================

router.get("/wallet", authenticate, requireRole("provider"), getWallet);

// ============================================================
// WITHDRAWAL PREVIEW
// ============================================================

router.get("/preview", authenticate, requireRole("provider"), getPayoutPreview);

// ============================================================
// REQUEST WITHDRAWAL
// ============================================================

router.post("/", authenticate, requireRole("provider"), requestPayout);

// ============================================================
// PAYOUT HISTORY
// ============================================================

router.get("/", authenticate, requireRole("provider"), getPayoutHistory);

// ============================================================
// SINGLE PAYOUT
// ============================================================

router.get("/:payoutId", authenticate, requireRole("provider"), getPayout);

module.exports = router;
