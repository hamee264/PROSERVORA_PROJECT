const express = require("express");

const {
  getCurrentUser,
  updateCurrentUser,
  updateProfileImage,
  providerTest,
} = require("../controllers/userController");

const { authenticate, requireRole } = require("../middleware/authMiddleware");

const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

// ============================================================
// CURRENT USER
// ============================================================

router.get("/me", authenticate, getCurrentUser);

router.patch("/me", authenticate, updateCurrentUser);

router.patch(
  "/me/avatar",
  authenticate,
  upload.single("image"),
  updateProfileImage,
);

// ============================================================
// PROVIDER-ONLY
// ============================================================

router.get(
  "/provider-test",
  authenticate,
  requireRole("provider"),
  providerTest,
);

module.exports = router;