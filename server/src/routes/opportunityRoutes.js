const express = require("express");
const {
  createOpportunity,
  getMyOpportunities,
  getMyOpportunityById,
  updateMyOpportunity,
  withdrawOpportunity,
  deleteOpportunity,
  getOpenOpportunities,
  getRequestedOpportunities,
  getOpenOpportunityById,
  addOpportunityImages,
  deleteOpportunityImage,
} = require("../controllers/opportunityController");
const {
  authenticate,
  requireRole,
} = require("../middleware/authMiddleware");

const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

// ============================================================
// CUSTOMER OPPORTUNITIES
// ============================================================

// Create opportunity
router.post(
  "/",
  authenticate,
  requireRole("customer"),
  upload.array("images", 6),
  createOpportunity,
);

// Get my opportunities
router.get(
  "/me",
  authenticate,
  requireRole("customer"),
  getMyOpportunities,
);

// Get one of my opportunities
router.get(
  "/me/:opportunityId",
  authenticate,
  requireRole("customer"),
  getMyOpportunityById,
);

// Update my opportunity + optional new images
router.patch(
  "/:opportunityId",
  authenticate,
  requireRole("customer"),
  upload.array("images", 6),
  updateMyOpportunity,
);

// Withdraw my opportunity
router.patch(
  "/:opportunityId/withdraw",
  authenticate,
  requireRole("customer"),
  withdrawOpportunity,
);

router.delete(
  "/:opportunityId",
  authenticate,
  requireRole("customer"),
  deleteOpportunity,
);

// ============================================================
// PROVIDER OPPORTUNITY DISCOVERY
// ============================================================

// Get open opportunities
router.get(
  "/",
  authenticate,
  requireRole("provider"),
  getOpenOpportunities,
);

router.get(
  "/requested",
  authenticate,
  requireRole("provider"),
  getRequestedOpportunities,
);

// Add images to my opportunity
router.post(
  "/:opportunityId/images",
  authenticate,
  requireRole("customer"),
  upload.array("images", 6),
  addOpportunityImages,
);

// Delete an image from my opportunity
router.delete(
  "/:opportunityId/images/:mediaId",
  authenticate,
  requireRole("customer"),
  deleteOpportunityImage,
);

// Get one open opportunity
// Keep this dynamic route after named provider routes such as /requested.
router.get(
  "/:opportunityId",
  authenticate,
  requireRole("provider"),
  getOpenOpportunityById,
);
module.exports = router;