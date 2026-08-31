const rateLimit = require("express-rate-limit");

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

module.exports = {
  resendVerificationLimiter,
};
