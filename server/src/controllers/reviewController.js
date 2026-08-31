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

module.exports = {
  createReview,
};
