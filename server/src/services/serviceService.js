const pool = require("../config/database");

// ============================================================
// CREATE PROVIDER SERVICE
// ============================================================

const createProviderService = async (providerId, data) => {
  const { categoryId, title, description } = data;

  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  if (!categoryId || !title || !description) {
    const error = new Error("Category, title and description are required");

    error.statusCode = 400;
    throw error;
  }

  const normalizedTitle = title.trim();
  const normalizedDescription = description.trim();

  if (!normalizedTitle) {
    const error = new Error("Service title cannot be empty");
    error.statusCode = 400;
    throw error;
  }

  if (!normalizedDescription) {
    const error = new Error("Service description cannot be empty");
    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // CHECK CATEGORY
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // CHECK PROVIDER
  // ----------------------------------------------------------

  const providerResult = await pool.query(
    `
    SELECT user_id
    FROM provider_profiles
    WHERE user_id = $1
    `,
    [providerId],
  );

  if (providerResult.rows.length === 0) {
    const error = new Error("Provider profile not found");
    error.statusCode = 404;
    throw error;
  }

  // ----------------------------------------------------------
  // CREATE SERVICE
  // ----------------------------------------------------------

  const result = await pool.query(
    `
    INSERT INTO services (
      provider_id,
      category_id,
      title,
      description
    )
    VALUES ($1, $2, $3, $4)

    RETURNING
      id,
      provider_id,
      category_id,
      title,
      description,
      is_active,
      created_at,
      updated_at
    `,
    [providerId, categoryId, normalizedTitle, normalizedDescription],
  );

  return result.rows[0];
};

// ============================================================
// GET MY SERVICES
// ============================================================

const getMyServices = async (providerId) => {
  const result = await pool.query(
    `
    SELECT
      s.id,
      s.provider_id,
      s.category_id,
      c.name AS category_name,
      c.slug AS category_slug,
      s.title,
      s.description,
      s.is_active,
      s.created_at,
      s.updated_at

    FROM services s

    INNER JOIN categories c
      ON c.id = s.category_id

    WHERE s.provider_id = $1

    ORDER BY s.created_at DESC
    `,
    [providerId],
  );

  return result.rows;
};
// ============================================================
// GET SERVICE BY ID
// ============================================================

const getServiceById = async (userId, serviceId) => {
  const result = await pool.query(
    `
    SELECT
      s.id,
      s.provider_id,
      s.category_id,
      c.name AS category_name,
      c.slug AS category_slug,
      s.title,
      s.description,
      s.is_active,
      s.created_at,
      s.updated_at

    FROM services s

    INNER JOIN categories c
      ON c.id = s.category_id

    WHERE s.id = $1
      AND s.provider_id = $2
    `,
    [serviceId, userId],
  );

  if (result.rows.length === 0) {
    const error = new Error("Service not found");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};
// ============================================================
// UPDATE PROVIDER SERVICE
// ============================================================

const updateProviderService = async (providerId, serviceId, data) => {
  const { categoryId, title, description } = data;

  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  if (
    categoryId === undefined &&
    title === undefined &&
    description === undefined
  ) {
    const error = new Error("No service fields provided for update");
    error.statusCode = 400;
    throw error;
  }

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      const error = new Error("Service title cannot be empty");
      error.statusCode = 400;
      throw error;
    }
  }

  if (description !== undefined) {
    if (typeof description !== "string" || !description.trim()) {
      const error = new Error("Service description cannot be empty");
      error.statusCode = 400;
      throw error;
    }
  }

  // ----------------------------------------------------------
  // CHECK CATEGORY
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
  // UPDATE SERVICE
  // ----------------------------------------------------------

  const result = await pool.query(
    `
    UPDATE services
    SET
      category_id = COALESCE($1, category_id),
      title = COALESCE($2, title),
      description = COALESCE($3, description)
    WHERE id = $4
      AND provider_id = $5

    RETURNING
      id,
      provider_id,
      category_id,
      title,
      description,
      is_active,
      created_at,
      updated_at
    `,
    [
      categoryId !== undefined ? categoryId : null,
      title !== undefined ? title.trim() : null,
      description !== undefined ? description.trim() : null,
      serviceId,
      providerId,
    ],
  );

  // ----------------------------------------------------------
  // SERVICE NOT FOUND / NOT OWNED
  // ----------------------------------------------------------

  if (result.rows.length === 0) {
    const error = new Error("Service not found");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};
// ============================================================
// UPDATE SERVICE STATUS
// ============================================================

const updateProviderServiceStatus = async (providerId, serviceId, isActive) => {
  if (typeof isActive !== "boolean") {
    const error = new Error("isActive must be true or false");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
    UPDATE services
    SET is_active = $1
    WHERE id = $2
      AND provider_id = $3

    RETURNING
      id,
      provider_id,
      category_id,
      title,
      description,
      is_active,
      created_at,
      updated_at
    `,
    [isActive, serviceId, providerId],
  );

  if (result.rows.length === 0) {
    const error = new Error("Service not found");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};

// ============================================================
// GET PUBLIC SERVICES
// ============================================================

const getPublicServices = async (filters = {}) => {
  const { category, city, search } = filters;

  const values = [];
  const conditions = [
    "s.is_active = true",
    "c.is_active = true",
    "u.is_active = true",
  ];

  // ----------------------------------------------------------
  // CATEGORY FILTER
  // ----------------------------------------------------------

  if (category) {
    values.push(category.trim().toLowerCase());

    conditions.push(`
      c.slug = $${values.length}
    `);
  }

  // ----------------------------------------------------------
  // CITY FILTER
  // ----------------------------------------------------------

  if (city) {
    values.push(city.trim());

    conditions.push(`
      LOWER(p.city) = LOWER($${values.length})
    `);
  }

  // ----------------------------------------------------------
  // SEARCH FILTER
  // ----------------------------------------------------------

  if (search) {
    values.push(`%${search.trim()}%`);

    conditions.push(`
      (
        s.title ILIKE $${values.length}
        OR s.description ILIKE $${values.length}
        OR c.name ILIKE $${values.length}
        OR p.first_name ILIKE $${values.length}
        OR p.last_name ILIKE $${values.length}
      )
    `);
  }

  const query = `
    SELECT
      s.id,
      s.provider_id,
      s.category_id,

      c.name AS category_name,
      c.slug AS category_slug,

      s.title,
      s.description,
      s.is_active,
      s.created_at,
      s.updated_at,

      p.first_name,
      p.last_name,
      p.username,
      p.phone,
      p.avatar_url,
      p.bio,
      p.country,
      p.city,
      p.latitude,
      p.longitude,

      pp.is_verified,
      pp.rating,
      pp.total_reviews,
      pp.total_jobs_completed,
      pp.is_available,
      pp.is_online

    FROM services s

    INNER JOIN categories c
      ON c.id = s.category_id

    INNER JOIN users u
      ON u.id = s.provider_id

    INNER JOIN profiles p
      ON p.user_id = s.provider_id

    INNER JOIN provider_profiles pp
      ON pp.user_id = s.provider_id

    WHERE ${conditions.join(" AND ")}

    ORDER BY
      pp.rating DESC,
      pp.total_reviews DESC,
      s.created_at DESC
  `;

  const result = await pool.query(query, values);

  return result.rows;
};
// ============================================================
// GET PUBLIC SERVICE BY ID
// ============================================================

const getPublicServiceById = async (serviceId) => {
  const result = await pool.query(
    `
    SELECT
      s.id,
      s.provider_id,
      s.category_id,

      c.name AS category_name,
      c.slug AS category_slug,

      s.title,
      s.description,
      s.is_active,
      s.created_at,
      s.updated_at,

      p.first_name,
      p.last_name,
      p.username,
      p.phone,
      p.avatar_url,
      p.bio,
      p.country,
      p.city,
      p.latitude,
      p.longitude,

      pp.is_verified,
      pp.rating,
      pp.total_reviews,
      pp.total_jobs_completed,
      pp.is_available,
      pp.is_online

    FROM services s

    INNER JOIN categories c
      ON c.id = s.category_id

    INNER JOIN profiles p
      ON p.user_id = s.provider_id

    INNER JOIN provider_profiles pp
      ON pp.user_id = s.provider_id

    WHERE s.id = $1
      AND s.is_active = true
      AND c.is_active = true
    `,
    [serviceId],
  );

  if (result.rows.length === 0) {
    const error = new Error("Service not found");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};
module.exports = {
  createProviderService,
  getMyServices,
  getServiceById,
  updateProviderService,
  updateProviderServiceStatus,
  getPublicServices,
  getPublicServiceById,
};
