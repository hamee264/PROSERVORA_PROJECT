const providerService = require("../services/providerService");

// ============================================================
// GET PUBLIC PROVIDER PROFILE
// ============================================================

const getPublicProviderProfile = async (req, res) => {
  try {
    const { providerId } = req.params;

    if (!providerId) {
      return res.status(400).json({
        success: false,
        message: "Provider ID is required",
      });
    }

    const provider =
      await providerService.getPublicProviderProfile(providerId);

    return res.status(200).json({
      success: true,
      provider,
    });
  } catch (error) {
    console.error(
      "Get public provider profile error:",
      error,
    );

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message ||
        "Unable to get public provider profile",
    });
  }
};

// ============================================================
// GET MY PROVIDER PROFILE
// ============================================================

const getMyProviderProfile = async (req, res) => {
  try {
    const provider = await providerService.getProviderProfile(
      req.user.id,
    );

    res.status(200).json({
      success: true,
      provider,
    });
  } catch (error) {
    console.error("Get provider profile error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message ||
        "Unable to get provider profile",
    });
  }
};

const submitProviderVerification = async (req, res) => {
  try {
    const provider = await providerService.submitProviderVerification(
      req.user.id,
      req.body,
      req.file,
    );

    return res.status(200).json({
      success: true,
      message: "Verification details submitted for review",
      provider,
    });
  } catch (error) {
    console.error("Submit provider verification error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to submit verification details",
    });
  }
};

// ============================================================
// UPDATE MY PROVIDER PROFILE
// ============================================================

const updateMyProviderProfile = async (req, res) => {
  try {
    const profile =
      await providerService.updateProviderProfile(
        req.user.id,
        req.body,
      );

    res.status(200).json({
      success: true,
      message:
        "Provider profile updated successfully",
      profile,
    });
  } catch (error) {
    console.error(
      "Update provider profile error:",
      error,
    );

    res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message ||
        "Unable to update provider profile",
    });
  }
};

// ============================================================
// UPDATE AVAILABILITY
// ============================================================

const updateAvailability = async (req, res) => {
  try {
    const { isAvailable } = req.body;

    const result =
      await providerService.updateProviderAvailability(
        req.user.id,
        isAvailable,
      );

    res.status(200).json({
      success: true,
      message:
        "Availability updated successfully",
      provider: result,
    });
  } catch (error) {
    console.error(
      "Update provider availability error:",
      error,
    );

    res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message ||
        "Unable to update availability",
    });
  }
};

// ============================================================
// UPDATE ONLINE STATUS
// ============================================================

const updateOnlineStatus = async (req, res) => {
  try {
    const { isOnline } = req.body;

    const result =
      await providerService.updateProviderOnlineStatus(
        req.user.id,
        isOnline,
      );

    res.status(200).json({
      success: true,
      message:
        "Online status updated successfully",
      provider: result,
    });
  } catch (error) {
    console.error(
      "Update online status error:",
      error,
    );

    res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message ||
        "Unable to update online status",
    });
  }
};
const getPublicProviderServices = async (req, res) => {
  try {
    const { providerId } = req.params;

    if (!providerId) {
      return res.status(400).json({
        success: false,
        message: "Provider ID is required",
      });
    }

    const services =
      await providerService.getPublicProviderServices(
        providerId,
      );

    return res.status(200).json({
      success: true,
      services,
    });
  } catch (error) {
    console.error(
      "Get public provider services error:",
      error,
    );

    return res.status(
      error.statusCode || 500,
    ).json({
      success: false,
      message:
        error.message ||
        "Unable to get provider services",
    });
  }
};
module.exports = {
  getPublicProviderProfile,
  getMyProviderProfile,
  submitProviderVerification,
  updateMyProviderProfile,
  updateAvailability,
  updateOnlineStatus,
  getPublicProviderServices,
};