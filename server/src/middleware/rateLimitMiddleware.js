const rateLimit = require("express-rate-limit");

// ============================================================
// LOGIN
// ============================================================
// Prevent brute-force password attacks.
//
// 10 attempts per 15 minutes per IP.
// ============================================================

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,

  standardHeaders: "draft-7",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
  },
});

// ============================================================
// REGISTER
// ============================================================
// Prevent automated account creation.
//
// 10 registrations per hour per IP.
// ============================================================

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,

  standardHeaders: "draft-7",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many registration attempts. Please try again later.",
  },
});

// ============================================================
// EMAIL VERIFICATION
// ============================================================
// Covers both verifying and requesting new verification codes.
//
// ============================================================

const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,

  standardHeaders: "draft-7",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many email verification attempts. Please try again later.",
  },
});

const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,

  standardHeaders: "draft-7",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many verification requests. Please try again later.",
  },
});

// ============================================================
// PASSWORD RESET REQUEST
// ============================================================
// Prevent abuse of the password-reset email endpoint.
//
// ============================================================

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,

  standardHeaders: "draft-7",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many password reset requests. Please try again later.",
  },
});

// ============================================================
// PASSWORD RESET CODE VERIFICATION
// ============================================================

const verifyResetCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,

  standardHeaders: "draft-7",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many reset code attempts. Please try again later.",
  },
});

// ============================================================
// PASSWORD RESET
// ============================================================

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,

  standardHeaders: "draft-7",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many password reset attempts. Please try again later.",
  },
});

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  loginLimiter,
  registerLimiter,
  verifyEmailLimiter,
  resendVerificationLimiter,
  forgotPasswordLimiter,
  verifyResetCodeLimiter,
  resetPasswordLimiter,
};