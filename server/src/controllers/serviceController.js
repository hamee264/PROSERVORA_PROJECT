const serviceService = require("../services/serviceService");

// ============================================================
// CREATE SERVICE
// ============================================================

const createService = async (req, res) => {
  try {
    const service =
      await serviceService.createProviderService(
        req.user.id,
        req.body,
        req.files || [],
      );

    return res.status(201).json({
      success: true,
      message: "Service created successfully",
      service,
    });
  } catch (error) {
    console.error(
      "Create service error:",
      error,
    );

    return res.status(
      error.statusCode || 500,
    ).json({
      success: false,
      message:
        error.message ||
        "Unable to create service",
    });
  }
};

// ============================================================
// GET MY SERVICES
// ============================================================

const getMyServices = async (req, res) => {
  try {
    const services =
      await serviceService.getMyServices(
        req.user.id,
      );

    return res.status(200).json({
      success: true,
      services,
    });
  } catch (error) {
    console.error(
      "Get my services error:",
      error,
    );

    return res.status(
      error.statusCode || 500,
    ).json({
      success: false,
      message:
        error.message ||
        "Unable to get services",
    });
  }
};

// ============================================================
// GET MY SERVICE
// ============================================================

const getMyServiceById = async (
  req,
  res,
) => {
  try {
    const service =
      await serviceService.getServiceById(
        req.user.id,
        req.params.serviceId,
      );

    return res.status(200).json({
      success: true,
      service,
    });
  } catch (error) {
    console.error(
      "Get service error:",
      error,
    );

    return res.status(
      error.statusCode || 500,
    ).json({
      success: false,
      message:
        error.message ||
        "Unable to get service",
    });
  }
};

// ============================================================
// UPDATE MY SERVICE
// ============================================================

const updateMyService = async (
  req,
  res,
) => {
  try {
    const service =
      await serviceService.updateProviderService(
        req.user.id,
        req.params.serviceId,
        req.body,
      );

    return res.status(200).json({
      success: true,
      message:
        "Service updated successfully",
      service,
    });
  } catch (error) {
    console.error(
      "Update service error:",
      error,
    );

    return res.status(
      error.statusCode || 500,
    ).json({
      success: false,
      message:
        error.message ||
        "Unable to update service",
    });
  }
};

// ============================================================
// UPDATE SERVICE STATUS
// ============================================================

const updateServiceStatus = async (
  req,
  res,
) => {
  try {
    const { isActive } = req.body;

    const service =
      await serviceService.updateProviderServiceStatus(
        req.user.id,
        req.params.serviceId,
        isActive,
      );

    return res.status(200).json({
      success: true,
      message:
        "Service status updated successfully",
      service,
    });
  } catch (error) {
    console.error(
      "Update service status error:",
      error,
    );

    return res.status(
      error.statusCode || 500,
    ).json({
      success: false,
      message:
        error.message ||
        "Unable to update service status",
    });
  }
};

// ============================================================
// DELETE SERVICE
// ============================================================

const deleteService = async (
  req,
  res,
) => {
  try {
    const result =
      await serviceService.deleteProviderService(
        req.user.id,
        req.params.serviceId,
      );

    return res.status(200).json({
      success: true,
      message:
        "Service deleted successfully",
      ...result,
    });
  } catch (error) {
    console.error(
      "Delete service error:",
      error,
    );

    return res.status(
      error.statusCode || 500,
    ).json({
      success: false,
      message:
        error.message ||
        "Unable to delete service",
    });
  }
};

// ============================================================
// ADD SERVICE IMAGES
// ============================================================

const addServiceImages = async (
  req,
  res,
) => {
  try {
    const media =
      await serviceService.addServiceImages(
        req.user.id,
        req.params.serviceId,
        req.files || [],
      );

    return res.status(200).json({
      success: true,
      message:
        "Service images added successfully",
      media,
    });
  } catch (error) {
    console.error(
      "Add service images error:",
      error,
    );

    return res.status(
      error.statusCode || 500,
    ).json({
      success: false,
      message:
        error.message ||
        "Unable to add service images",
    });
  }
};

// ============================================================
// DELETE SERVICE IMAGE
// ============================================================

const deleteServiceImage = async (
  req,
  res,
) => {
  try {
    const result =
      await serviceService.deleteServiceImage(
        req.user.id,
        req.params.serviceId,
        req.params.mediaId,
      );

    return res.status(200).json({
      success: true,
      message:
        "Service image deleted successfully",
      ...result,
    });
  } catch (error) {
    console.error(
      "Delete service image error:",
      error,
    );

    return res.status(
      error.statusCode || 500,
    ).json({
      success: false,
      message:
        error.message ||
        "Unable to delete service image",
    });
  }
};

// ============================================================
// REORDER SERVICE IMAGES
// ============================================================

const reorderServiceImages = async (
  req,
  res,
) => {
  try {
    const { mediaIds } = req.body;

    const media =
      await serviceService.reorderServiceImages(
        req.user.id,
        req.params.serviceId,
        mediaIds,
      );

    return res.status(200).json({
      success: true,
      message:
        "Service images reordered successfully",
      media,
    });
  } catch (error) {
    console.error(
      "Reorder service images error:",
      error,
    );

    return res.status(
      error.statusCode || 500,
    ).json({
      success: false,
      message:
        error.message ||
        "Unable to reorder service images",
    });
  }
};

// ============================================================
// PUBLIC SERVICES
// ============================================================

const getPublicServices = async (
  req,
  res,
) => {
  try {
    const services =
      await serviceService.getPublicServices(
        req.query,
      );

    return res.status(200).json({
      success: true,
      services,
    });
  } catch (error) {
    console.error(
      "Get public services error:",
      error,
    );

    return res.status(
      error.statusCode || 500,
    ).json({
      success: false,
      message:
        error.message ||
        "Unable to get services",
    });
  }
};

// ============================================================
// SEARCH SUGGESTIONS
// ============================================================

const getSearchSuggestions = async (
  req,
  res,
) => {
  try {
    const suggestions =
      await serviceService.getSearchSuggestions(
        req.query.q,
      );

    return res.status(200).json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error(
      "Get search suggestions error:",
      error,
    );

    return res.status(
      error.statusCode || 500,
    ).json({
      success: false,
      message:
        error.message ||
        "Unable to get search suggestions",
    });
  }
};

// ============================================================
// PUBLIC SERVICE BY ID
// ============================================================

const getPublicServiceById = async (
  req,
  res,
) => {
  try {
    const service =
      await serviceService.getPublicServiceById(
        req.params.serviceId,
      );

    return res.status(200).json({
      success: true,
      service,
    });
  } catch (error) {
    console.error(
      "Get public service error:",
      error,
    );

    return res.status(
      error.statusCode || 500,
    ).json({
      success: false,
      message:
        error.message ||
        "Unable to get service",
    });
  }
};

module.exports = {
  createService,
  getMyServices,
  getMyServiceById,
  updateMyService,
  updateServiceStatus,
  deleteService,
  addServiceImages,
  deleteServiceImage,
  reorderServiceImages,
  getPublicServices,
  getSearchSuggestions,
  getPublicServiceById,
};