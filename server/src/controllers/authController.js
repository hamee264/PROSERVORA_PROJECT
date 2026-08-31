const authService = require("../services/authService");

const {
  generatePasswordResetCode,
  verifyPasswordResetCode,
  resetPassword: resetPasswordService,
} = require("../services/passwordResetService");

// ============================================================
// REGISTER
// ============================================================

const register = async (req, res) => {
  try {
    const result = await authService.registerUser(req.body);

    res.status(201).json({
      success: true,
      message:
        "Account created successfully. Please check your email for the verification code.",
      user: result.user,
    });
  } catch (error) {
    console.error("Registration error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Registration failed",
    });
  }
};

// ============================================================
// LOGIN
// ============================================================

const login = async (req, res) => {
  try {
    const { user, token } = await authService.loginUser(req.body);

    res.status(200).json({
      success: true,
      message: "Login successful",
      user,
      token,
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Login failed",
    });
  }
};

// ============================================================
// VERIFY EMAIL
// ============================================================

const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;

    await authService.verifyEmail(email, code);

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Email verification error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Email verification failed",
    });
  }
};

// ============================================================
// FORGOT PASSWORD
// ============================================================

const forgotPassword = async (req, res) => {
  console.log("FORGOT PASSWORD ROUTE HIT");

  try {
    const result = await generatePasswordResetCode(req.body.email);

    const response = {
      success: true,
      message:
        "If an account with that email exists, a password reset code has been sent",
    };

    // Development only.
    // Remove this when email testing is complete.
    if (result) {
      response.resetCode = result.code;
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Forgot password error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to process password reset request",
    });
  }
};

// ============================================================
// VERIFY PASSWORD RESET CODE
// ============================================================

const verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    const result = await verifyPasswordResetCode(email, code);

    res.status(200).json({
      success: true,
      message: "Reset code is valid",
      userId: result.userId,
    });
  } catch (error) {
    console.error("Reset code verification error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Reset code verification failed",
    });
  }
};

// ============================================================
// RESET PASSWORD
// ============================================================

const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    await resetPasswordService(email, code, newPassword);

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Password reset error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Password reset failed",
    });
  }
};

const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    await authService.resendVerificationEmail(email);

    res.status(200).json({
      success: true,
      message:
        "If an unverified account with that email exists, a new verification code has been sent",
    });
  } catch (error) {
    console.error("Resend verification error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to resend verification code",
    });
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  verifyResetCode,
  resetPassword,
};
