const express = require("express");

const {
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
  getPublicServiceById,
  getSearchSuggestions,
} = require("../controllers/serviceController");

const {
  authenticate,
  requireRole,
} = require("../middleware/authMiddleware");

const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

// ============================================================
// PUBLIC SERVICE DISCOVERY
// ============================================================

// Get all active services
router.get(
  "/",
  getPublicServices,
);

// Search suggestions / autocomplete
router.get(
  "/search/suggestions",
  getSearchSuggestions,
);

// Get one public service
router.get(
  "/public/:serviceId",
  getPublicServiceById,
);

// ============================================================
// PROVIDER SERVICES
// ============================================================

// Create service + images
router.post(
  "/",
  authenticate,
  requireRole("provider"),
  upload.array("images", 6),
  createService,
);

// Get my services
router.get(
  "/me",
  authenticate,
  requireRole("provider"),
  getMyServices,
);

// Update service status
router.patch(
  "/:serviceId/status",
  authenticate,
  requireRole("provider"),
  updateServiceStatus,
);

// Get one of my services
router.get(
  "/:serviceId",
  authenticate,
  requireRole("provider"),
  getMyServiceById,
);

// Update service information
router.patch(
  "/:serviceId",
  authenticate,
  requireRole("provider"),
  updateMyService,
);

// Delete service
router.delete(
  "/:serviceId",
  authenticate,
  requireRole("provider"),
  deleteService,
);

// ============================================================
// SERVICE IMAGES
// ============================================================

// Add more images
router.post(
  "/:serviceId/images",
  authenticate,
  requireRole("provider"),
  upload.array("images", 6),
  addServiceImages,
);

// Delete one image
router.delete(
  "/:serviceId/images/:mediaId",
  authenticate,
  requireRole("provider"),
  deleteServiceImage,
);

// Reorder images
router.patch(
  "/:serviceId/images/order",
  authenticate,
  requireRole("provider"),
  reorderServiceImages,
);

module.exports = router;