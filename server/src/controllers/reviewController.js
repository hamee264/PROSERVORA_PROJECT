const reviewService = require("../services/reviewService");

// ============================================================
// CREATE REVIEW
// ============================================================

const createReview = async (req, res) => {
  try {
    const review = await reviewService.createReview(req.user.id, req.body);

    res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      ...review,
    });
  } catch (error) {
    console.error("Create review error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to submit review",
    });
  }
};

// ============================================================
// GET PROVIDER REVIEWS
// ============================================================

const getProviderReviews = async (req, res) => {
  try {
    const reviews = await reviewService.getProviderReviews(req.user.id);

    res.status(200).json({
      success: true,
      reviews,
    });
  } catch (error) {
    console.error("Get provider reviews error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to fetch reviews",
    });
  }
};

module.exports = {
  createReview,
  getProviderReviews,
};
