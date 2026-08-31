const express = require("express");

const {
  getCurrentUser,
  providerTest,
} = require("../controllers/userController");

const { authenticate, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// CURRENT USER
// ============================================================

router.get("/me", authenticate, getCurrentUser);

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
