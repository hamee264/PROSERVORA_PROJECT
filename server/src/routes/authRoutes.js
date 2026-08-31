const express = require("express");

const {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  verifyResetCode,
  resetPassword,
} = require("../controllers/authController");

const {
  resendVerificationLimiter,
} = require("../middleware/rateLimitMiddleware");

const router = express.Router();

// ============================================================
// AUTHENTICATION
// ============================================================

router.post("/register", register);

router.post("/login", login);

// ============================================================
// EMAIL VERIFICATION
// ============================================================

router.post("/verify-email", verifyEmail);

router.post(
  "/resend-verification",
  resendVerificationLimiter,
  resendVerification,
);

// ============================================================
// PASSWORD RESET
// ============================================================

router.post("/forgot-password", forgotPassword);

router.post("/verify-reset-code", verifyResetCode);

router.post("/reset-password", resetPassword);

module.exports = router;
