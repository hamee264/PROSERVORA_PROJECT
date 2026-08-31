const pool = require("../config/database");

// ============================================================
// GET ALL CATEGORIES
// ============================================================

const getAllCategories = async () => {
  const result = await pool.query(
    `
    SELECT
      id,
      name,
      slug,
      description,
      icon_url,
      is_active,
      created_at
    FROM categories
    WHERE is_active = true
    ORDER BY name ASC
    `,
  );

  return result.rows;
};

// ============================================================
// GET CATEGORY BY ID
// ============================================================

const getCategoryById = async (categoryId) => {
  const result = await pool.query(
    `
    SELECT
      id,
      name,
      slug,
      description,
      icon_url,
      is_active,
      created_at
    FROM categories
    WHERE id = $1
      AND is_active = true
    `,
    [categoryId],
  );

  if (result.rows.length === 0) {
    const error = new Error("Category not found");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};

module.exports = {
  getAllCategories,
  getCategoryById,
};
