const pool = require("../config/database");

// ============================================================
// CREATE OPPORTUNITY
// ============================================================

const createOpportunity = async (customerId, data) => {
  const {
    categoryId,
    title,
    description,
    locationText,
    latitude,
    longitude,
    expiresAt,
  } = data;

  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  if (!categoryId || !title || !description || !expiresAt) {
    const error = new Error(
      "Category, title, description and expiration date are required",
    );

    error.statusCode = 400;
    throw error;
  }

  const normalizedTitle = title.trim();
  const normalizedDescription = description.trim();

  if (!normalizedTitle) {
    const error = new Error("Opportunity title cannot be empty");

    error.statusCode = 400;
    throw error;
  }

  if (!normalizedDescription) {
    const error = new Error("Opportunity description cannot be empty");

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // VALIDATE EXPIRATION DATE
  // ----------------------------------------------------------

  const expirationDate = new Date(expiresAt);

  if (Number.isNaN(expirationDate.getTime())) {
    const error = new Error("Invalid expiration date");

    error.statusCode = 400;
    throw error;
  }

  if (expirationDate <= new Date()) {
    const error = new Error("Expiration date must be in the future");

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // CHECK CATEGORY
  // ----------------------------------------------------------

  const categoryResult = await pool.query(
    `
    SELECT
      id,
      name,
      slug
    FROM categories
    WHERE id = $1
      AND is_active = true
    `,
    [categoryId],
  );

  if (categoryResult.rows.length === 0) {
    const error = new Error("Category not found");

    error.statusCode = 404;
    throw error;
  }

  // ----------------------------------------------------------
  // CHECK CUSTOMER
  // ----------------------------------------------------------

  const customerResult = await pool.query(
    `
    SELECT id
    FROM users
    WHERE id = $1
      AND role = 'customer'
      AND is_active = true
    `,
    [customerId],
  );

  if (customerResult.rows.length === 0) {
    const error = new Error("Customer account not found");

    error.statusCode = 404;
    throw error;
  }

  // ----------------------------------------------------------
  // CREATE OPPORTUNITY
  // ----------------------------------------------------------

  const result = await pool.query(
    `
    INSERT INTO opportunities (
      customer_id,
      category_id,
      title,
      description,
      location_text,
      latitude,
      longitude,
      expires_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)

    RETURNING
      id,
      customer_id,
      category_id,
      title,
      description,
      location_text,
      latitude,
      longitude,
      status,
      expires_at,
      created_at,
      updated_at
    `,
    [
      customerId,
      categoryId,
      normalizedTitle,
      normalizedDescription,
      locationText ? locationText.trim() : null,
      latitude ?? null,
      longitude ?? null,
      expirationDate,
    ],
  );

  return result.rows[0];
};

// ============================================================
// GET MY OPPORTUNITIES
// ============================================================

const getMyOpportunities = async (customerId) => {
  const result = await pool.query(
    `
    SELECT
      o.id,
      o.customer_id,
      o.category_id,

      c.name AS category_name,
      c.slug AS category_slug,

      o.title,
      o.description,
      o.location_text,
      o.latitude,
      o.longitude,
      o.status,
      o.expires_at,
      o.created_at,
      o.updated_at

    FROM opportunities o

    INNER JOIN categories c
      ON c.id = o.category_id

    WHERE o.customer_id = $1

    ORDER BY o.created_at DESC
    `,
    [customerId],
  );

  return result.rows;
};

// ============================================================
// GET MY OPPORTUNITY BY ID
// ============================================================

const getMyOpportunityById = async (customerId, opportunityId) => {
  const result = await pool.query(
    `
    SELECT
      o.id,
      o.customer_id,
      o.category_id,

      c.name AS category_name,
      c.slug AS category_slug,

      o.title,
      o.description,
      o.location_text,
      o.latitude,
      o.longitude,
      o.status,
      o.expires_at,
      o.created_at,
      o.updated_at

    FROM opportunities o

    INNER JOIN categories c
      ON c.id = o.category_id

    WHERE o.id = $1
      AND o.customer_id = $2
    `,
    [opportunityId, customerId],
  );

  if (result.rows.length === 0) {
    const error = new Error("Opportunity not found");

    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};
// ============================================================
// UPDATE MY OPPORTUNITY
// ============================================================

const updateMyOpportunity = async (customerId, opportunityId, data) => {
  const {
    categoryId,
    title,
    description,
    locationText,
    latitude,
    longitude,
    expiresAt,
  } = data;

  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  if (
    categoryId === undefined &&
    title === undefined &&
    description === undefined &&
    locationText === undefined &&
    latitude === undefined &&
    longitude === undefined &&
    expiresAt === undefined
  ) {
    const error = new Error("No opportunity fields provided for update");

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // CHECK OPPORTUNITY OWNERSHIP + STATUS
  // ----------------------------------------------------------

  const existingResult = await pool.query(
    `
    SELECT
      id,
      status,
      expires_at
    FROM opportunities
    WHERE id = $1
      AND customer_id = $2
    `,
    [opportunityId, customerId],
  );

  if (existingResult.rows.length === 0) {
    const error = new Error("Opportunity not found");
    error.statusCode = 404;
    throw error;
  }

  const existingOpportunity = existingResult.rows[0];

  if (existingOpportunity.status !== "open") {
    const error = new Error("Only open opportunities can be updated");

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // VALIDATE CATEGORY
  // ----------------------------------------------------------

  if (categoryId !== undefined) {
    const categoryResult = await pool.query(
      `
      SELECT id
      FROM categories
      WHERE id = $1
        AND is_active = true
      `,
      [categoryId],
    );

    if (categoryResult.rows.length === 0) {
      const error = new Error("Category not found");
      error.statusCode = 404;
      throw error;
    }
  }

  // ----------------------------------------------------------
  // VALIDATE TITLE
  // ----------------------------------------------------------

  if (title !== undefined && !title.trim()) {
    const error = new Error("Opportunity title cannot be empty");
    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // VALIDATE DESCRIPTION
  // ----------------------------------------------------------

  if (description !== undefined && !description.trim()) {
    const error = new Error("Opportunity description cannot be empty");

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // VALIDATE EXPIRATION
  // ----------------------------------------------------------

  let expirationDate = null;

  if (expiresAt !== undefined) {
    expirationDate = new Date(expiresAt);

    if (Number.isNaN(expirationDate.getTime())) {
      const error = new Error("Invalid expiration date");
      error.statusCode = 400;
      throw error;
    }

    if (expirationDate <= new Date()) {
      const error = new Error("Expiration date must be in the future");

      error.statusCode = 400;
      throw error;
    }
  }

  // ----------------------------------------------------------
  // UPDATE
  // ----------------------------------------------------------

  const result = await pool.query(
    `
    UPDATE opportunities
    SET
      category_id = COALESCE($1, category_id),
      title = COALESCE($2, title),
      description = COALESCE($3, description),
      location_text = COALESCE($4, location_text),
      latitude = COALESCE($5, latitude),
      longitude = COALESCE($6, longitude),
      expires_at = COALESCE($7, expires_at)
    WHERE id = $8
      AND customer_id = $9
      AND status = 'open'

    RETURNING
      id,
      customer_id,
      category_id,
      title,
      description,
      location_text,
      latitude,
      longitude,
      status,
      expires_at,
      created_at,
      updated_at
    `,
    [
      categoryId ?? null,
      title !== undefined ? title.trim() : null,
      description !== undefined ? description.trim() : null,
      locationText !== undefined ? locationText.trim() : null,
      latitude ?? null,
      longitude ?? null,
      expirationDate,
      opportunityId,
      customerId,
    ],
  );

  if (result.rows.length === 0) {
    const error = new Error("Unable to update opportunity");
    error.statusCode = 400;
    throw error;
  }

  return result.rows[0];
};
// ============================================================
// GET PUBLIC OPPORTUNITIES FOR PROVIDERS
// ============================================================

const getOpenOpportunities = async (filters = {}) => {
  const { categoryId } = filters;

  const values = [];
  const conditions = ["o.status = 'open'", "o.expires_at > NOW()"];

  if (categoryId) {
    values.push(categoryId);
    conditions.push(`o.category_id = $${values.length}`);
  }

  const result = await pool.query(
    `
    SELECT
      o.id,
      o.category_id,

      c.name AS category_name,
      c.slug AS category_slug,

      o.title,
      o.description,
      o.location_text,
      o.latitude,
      o.longitude,
      o.status,
      o.expires_at,
      o.created_at

    FROM opportunities o

    INNER JOIN categories c
      ON c.id = o.category_id

    WHERE ${conditions.join(" AND ")}

    ORDER BY o.created_at DESC
    `,
    values,
  );

  return result.rows;
};
module.exports = {
  createOpportunity,
  getMyOpportunities,
  getMyOpportunityById,
  updateMyOpportunity,
  getOpenOpportunities,
};
