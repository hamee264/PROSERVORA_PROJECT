const express = require("express");

const {
  createService,
  getMyServices,
  getMyServiceById,
  updateMyService,
  updateServiceStatus,
  getPublicServices,
  getPublicServiceById,
} = require("../controllers/serviceController");

const { authenticate, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// PUBLIC SERVICE DISCOVERY
// ============================================================

// Get all active services
router.get("/", getPublicServices);

// Get one public service
router.get("/public/:serviceId", getPublicServiceById);

// ============================================================
// PROVIDER SERVICES
// ============================================================

// Create service
router.post("/", authenticate, requireRole("provider"), createService);

// Get my services
router.get("/me", authenticate, requireRole("provider"), getMyServices);

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

// Update my service
router.patch(
  "/:serviceId",
  authenticate,
  requireRole("provider"),
  updateMyService,
);

module.exports = router;
