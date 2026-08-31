const opportunityService = require("../services/opportunityService");

// ============================================================
// CREATE OPPORTUNITY
// ============================================================

const createOpportunity = async (req, res) => {
  try {
    const opportunity = await opportunityService.createOpportunity(
      req.user.id,
      req.body,
    );

    res.status(201).json({
      success: true,
      message: "Opportunity created successfully",
      opportunity,
    });
  } catch (error) {
    console.error("Create opportunity error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to create opportunity",
    });
  }
};

// ============================================================
// GET MY OPPORTUNITIES
// ============================================================

const getMyOpportunities = async (req, res) => {
  try {
    const opportunities = await opportunityService.getMyOpportunities(
      req.user.id,
    );

    res.status(200).json({
      success: true,
      opportunities,
    });
  } catch (error) {
    console.error("Get my opportunities error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to get opportunities",
    });
  }
};

// ============================================================
// GET MY OPPORTUNITY BY ID
// ============================================================

const getMyOpportunityById = async (req, res) => {
  try {
    const opportunity = await opportunityService.getMyOpportunityById(
      req.user.id,
      req.params.opportunityId,
    );

    res.status(200).json({
      success: true,
      opportunity,
    });
  } catch (error) {
    console.error("Get opportunity error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to get opportunity",
    });
  }
};
const updateMyOpportunity = async (req, res) => {
  try {
    const opportunity = await opportunityService.updateMyOpportunity(
      req.user.id,
      req.params.opportunityId,
      req.body,
    );

    res.status(200).json({
      success: true,
      message: "Opportunity updated successfully",
      opportunity,
    });
  } catch (error) {
    console.error("Update opportunity error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to update opportunity",
    });
  }
};
// ============================================================
// GET OPEN OPPORTUNITIES
// ============================================================

const getOpenOpportunities = async (req, res) => {
  try {
    const opportunities = await opportunityService.getOpenOpportunities({
      categoryId: req.query.categoryId,
    });

    res.status(200).json({
      success: true,
      opportunities,
    });
  } catch (error) {
    console.error("Get open opportunities error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to get opportunities",
    });
  }
};
module.exports = {
  createOpportunity,
  getMyOpportunities,
  getMyOpportunityById,
  updateMyOpportunity,
  getOpenOpportunities,
};
