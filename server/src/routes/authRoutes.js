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
  registerLimiter,
  loginLimiter,
  verifyEmailLimiter,
  resendVerificationLimiter,
  forgotPasswordLimiter,
  verifyResetCodeLimiter,
  resetPasswordLimiter,
} = require("../middleware/rateLimitMiddleware");

const router = express.Router();

// ============================================================
// AUTHENTICATION
// ============================================================

router.post(
  "/register",
  registerLimiter,
  register,
);

router.post(
  "/login",
  loginLimiter,
  login,
);

// ============================================================
// EMAIL VERIFICATION
// ============================================================

router.post(
  "/verify-email",
  verifyEmailLimiter,
  verifyEmail,
);

router.post(
  "/resend-verification",
  resendVerificationLimiter,
  resendVerification,
);

// ============================================================
// PASSWORD RESET
// ============================================================

router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  forgotPassword,
);

router.post(
  "/verify-reset-code",
  verifyResetCodeLimiter,
  verifyResetCode,
);

router.post(
  "/reset-password",
  resetPasswordLimiter,
  resetPassword,
);

module.exports = router;