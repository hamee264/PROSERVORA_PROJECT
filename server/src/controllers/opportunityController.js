const opportunityService = require("../services/opportunityService");

// ============================================================
// CREATE OPPORTUNITY
// ============================================================

const createOpportunity = async (req, res) => {
  try {
    const opportunity = await opportunityService.createOpportunity(
      req.user.id,
      req.body,
      req.files,
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
// GET MY OPPORTUNITY
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

// ============================================================
// UPDATE MY OPPORTUNITY
// ============================================================

const updateMyOpportunity = async (req, res) => {
  try {
    const opportunity = await opportunityService.updateMyOpportunity(
      req.user.id,
      req.params.opportunityId,
      req.body,
      req.files,
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
// WITHDRAW MY OPPORTUNITY
// ============================================================

const withdrawOpportunity = async (req, res) => {
  try {
    const opportunity = await opportunityService.withdrawOpportunity(
      req.user.id,
      req.params.opportunityId,
    );

    res.status(200).json({
      success: true,
      message: "Opportunity withdrawn successfully",
      opportunity,
    });
  } catch (error) {
    console.error("Withdraw opportunity error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to withdraw opportunity",
    });
  }
};

const deleteOpportunity = async (req, res) => {
  try {
    await opportunityService.deleteOpportunity(
      req.user.id,
      req.params.opportunityId,
    );

    res.status(200).json({
      success: true,
      message: "Opportunity deleted successfully",
    });
  } catch (error) {
    console.error("Delete opportunity error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to delete opportunity",
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

const getRequestedOpportunities = async (req, res) => {
  try {
    const opportunities = await opportunityService.getRequestedOpportunities(
      req.user.id,
    );
    res.status(200).json({ success: true, opportunities });
  } catch (error) {
    console.error("Get requested opportunities error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to get requested jobs",
    });
  }
};

// ============================================================
// GET ONE OPEN OPPORTUNITY
// ============================================================

const getOpenOpportunityById = async (req, res) => {
  try {
    const opportunity =
      await opportunityService.getOpenOpportunityById(
        req.params.opportunityId,
      );

    res.status(200).json({
      success: true,
      opportunity,
    });
  } catch (error) {
    console.error("Get open opportunity error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to get opportunity",
    });
  }
};
// ============================================================
// ADD OPPORTUNITY IMAGES
// ============================================================

const addOpportunityImages = async (req, res) => {
  try {
    const media = await opportunityService.addOpportunityImages(
      req.user.id,
      req.params.opportunityId,
      req.files,
    );

    res.status(200).json({
      success: true,
      message: "Opportunity images added successfully",
      media,
    });
  } catch (error) {
    console.error("Add opportunity images error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to add opportunity images",
    });
  }
};

// ============================================================
// DELETE OPPORTUNITY IMAGE
// ============================================================

const deleteOpportunityImage = async (req, res) => {
  try {
    const media = await opportunityService.deleteOpportunityImage(
      req.user.id,
      req.params.opportunityId,
      req.params.mediaId,
    );

    res.status(200).json({
      success: true,
      message: "Opportunity image deleted successfully",
      media,
    });
  } catch (error) {
    console.error("Delete opportunity image error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to delete opportunity image",
    });
  }
};
module.exports = {
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
};