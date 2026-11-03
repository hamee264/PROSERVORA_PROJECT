const userService = require("../services/userService");

// ============================================================
// PROVIDER-ONLY TEST
// ============================================================

const providerTest = async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Provider authorization works",
    user: {
      id: req.user.id,
      role: req.user.role,
    },
  });
};

// ============================================================
// GET CURRENT USER
// ============================================================

const getCurrentUser = async (req, res) => {
  try {
    const user = await userService.getCurrentUser(req.user.id);

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to retrieve user",
    });
  }
};

// ============================================================
// UPDATE CURRENT USER PROFILE
// ============================================================

const updateCurrentUser = async (req, res) => {
  try {
    await userService.updateProfile(req.user.id, req.body);

    // Fetch the complete updated user profile
    const user = await userService.getCurrentUser(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user,
    });
  } catch (error) {
    console.error("Update current user error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to update profile",
    });
  }
};

// ============================================================
// UPDATE PROFILE IMAGE
// ============================================================

const updateProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Profile image is required",
      });
    }

    const user = await userService.updateProfileImage(
      req.user.id,
      req.file,
    );

    return res.status(200).json({
      success: true,
      message: "Profile image updated successfully.",
      user,
    });
  } catch (error) {
    console.error("Update profile image error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to update profile image",
    });
  }
};
// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  getCurrentUser,
  updateCurrentUser,
  updateProfileImage,
  providerTest,
};