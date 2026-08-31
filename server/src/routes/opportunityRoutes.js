const express = require("express");

const {
  createOpportunity,
  getMyOpportunities,
  getMyOpportunityById,
  updateMyOpportunity,
  getOpenOpportunities,
} = require("../controllers/opportunityController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// CUSTOMER OPPORTUNITIES
// ============================================================

// Create opportunity
router.post("/", authenticate, requireRole("customer"), createOpportunity);

// Get my opportunities
router.get("/me", authenticate, requireRole("customer"), getMyOpportunities);

// Get one of my opportunities
router.get(
  "/me/:opportunityId",
  authenticate,
  requireRole("customer"),
  getMyOpportunityById,
);
router.patch(
  "/:opportunityId",
  authenticate,
  requireRole("customer"),
  updateMyOpportunity,
);
// ============================================================
// PROVIDER OPPORTUNITY DISCOVERY
// ============================================================

router.get("/", authenticate, requireRole("provider"), getOpenOpportunities);
module.exports = router;
