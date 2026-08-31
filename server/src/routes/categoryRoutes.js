const express = require("express");

const {
  getCategories,
  getCategory,
} = require("../controllers/categoryController");

const router = express.Router();

// ============================================================
// GET ALL CATEGORIES
// ============================================================

router.get("/", getCategories);

// ============================================================
// GET CATEGORY BY ID
// ============================================================

router.get("/:id", getCategory);

module.exports = router;
