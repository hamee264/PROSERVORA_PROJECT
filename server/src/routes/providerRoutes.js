const express = require("express");

const {
  getMyProviderProfile,
  getPublicProviderProfile,
  updateMyProviderProfile,
  updateAvailability,
  updateOnlineStatus,
  submitProviderVerification,
} = require("../controllers/providerController");

const {
  authenticate,
  requireRole,
} = require("../middleware/authMiddleware");
const verificationUpload = require("../middleware/verificationUploadMiddleware");

const router = express.Router();

// ============================================================
// PUBLIC PROVIDER PROFILE
// ============================================================

router.get(
  "/public/:providerId",
  getPublicProviderProfile,
);

// ============================================================
// PROVIDER PROFILE
// ============================================================

router.get(
  "/me",
  authenticate,
  requireRole("provider"),
  getMyProviderProfile,
);

router.patch(
  "/me",
  authenticate,
  requireRole("provider"),
  updateMyProviderProfile,
);

router.patch(
  "/me/verification",
  authenticate,
  requireRole("provider"),
  verificationUpload.single("idDocument"),
  submitProviderVerification,
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