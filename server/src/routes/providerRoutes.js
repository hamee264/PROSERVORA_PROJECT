const express = require("express");

const {
  getMyProviderProfile,
  updateMyProviderProfile,
  updateAvailability,
  updateOnlineStatus,
} = require("../controllers/providerController");

const { authenticate, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// PROVIDER PROFILE
// ============================================================

router.get("/me", authenticate, requireRole("provider"), getMyProviderProfile);

router.patch(
  "/me",
  authenticate,
  requireRole("provider"),
  updateMyProviderProfile,
);

// ============================================================
// PROVIDER AVAILABILITY
// ============================================================

router.patch(
  "/me/availability",
  authenticate,
  requireRole("provider"),
  updateAvailability,
);

// ============================================================
// PROVIDER ONLINE STATUS
// ============================================================

router.patch(
  "/me/online",
  authenticate,
  requireRole("provider"),
  updateOnlineStatus,
);

module.exports = router;
