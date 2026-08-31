const categoryService = require("../services/categoryService");

// ============================================================
// GET ALL CATEGORIES
// ============================================================

const getCategories = async (req, res) => {
  try {
    const categories = await categoryService.getAllCategories();

    res.status(200).json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error("Get categories error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to get categories",
    });
  }
};

// ============================================================
// GET CATEGORY BY ID
// ============================================================

const getCategory = async (req, res) => {
  try {
    const category = await categoryService.getCategoryById(req.params.id);

    res.status(200).json({
      success: true,
      category,
    });
  } catch (error) {
    console.error("Get category error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to get category",
    });
  }
};

module.exports = {
  getCategories,
  getCategory,
};
