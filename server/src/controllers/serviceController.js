const serviceService = require("../services/serviceService");

// ============================================================
// CREATE PROVIDER SERVICE
// ============================================================

const createService = async (req, res) => {
  try {
    const service = await serviceService.createProviderService(
      req.user.id,
      req.body,
    );

    res.status(201).json({
      success: true,
      message: "Service created successfully",
      service,
    });
  } catch (error) {
    console.error("Create service error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to create service",
    });
  }
};

// ============================================================
// GET MY SERVICES
// ============================================================

const getMyServices = async (req, res) => {
  try {
    const services = await serviceService.getMyServices(req.user.id);

    res.status(200).json({
      success: true,
      services,
    });
  } catch (error) {
    console.error("Get my services error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to get services",
    });
  }
};
// ============================================================
// GET MY SERVICE BY ID
// ============================================================

const getMyServiceById = async (req, res) => {
  try {
    const service = await serviceService.getServiceById(
      req.user.id,
      req.params.serviceId,
    );

    res.status(200).json({
      success: true,
      service,
    });
  } catch (error) {
    console.error("Get service error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to get service",
    });
  }
};
// ============================================================
// UPDATE MY SERVICE
// ============================================================

const updateMyService = async (req, res) => {
  try {
    const service = await serviceService.updateProviderService(
      req.user.id,
      req.params.serviceId,
      req.body,
    );

    res.status(200).json({
      success: true,
      message: "Service updated successfully",
      service,
    });
  } catch (error) {
    console.error("Update service error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to update service",
    });
  }
};
// ============================================================
// UPDATE SERVICE STATUS
// ============================================================

const updateServiceStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    const service = await serviceService.updateProviderServiceStatus(
      req.user.id,
      req.params.serviceId,
      isActive,
    );

    res.status(200).json({
      success: true,
      message: "Service status updated successfully",
      service,
    });
  } catch (error) {
    console.error("Update service status error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to update service status",
    });
  }
};
// ============================================================
// GET PUBLIC SERVICES
// ============================================================

const getPublicServices = async (req, res) => {
  try {
    const services = await serviceService.getPublicServices(req.query);

    res.status(200).json({
      success: true,
      services,
    });
  } catch (error) {
    console.error("Get public services error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to get services",
    });
  }
};
// ============================================================
// GET PUBLIC SERVICE BY ID
// ============================================================

const getPublicServiceById = async (req, res) => {
  try {
    const service = await serviceService.getPublicServiceById(
      req.params.serviceId,
    );

    res.status(200).json({
      success: true,
      service,
    });
  } catch (error) {
    console.error("Get public service error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to get service",
    });
  }
};
module.exports = {
  createService,
  getMyServices,
  getMyServiceById,
  updateMyService,
  updateServiceStatus,
  getPublicServices,
  getPublicServiceById,
};
