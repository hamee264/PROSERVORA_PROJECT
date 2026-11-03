const pool = require("../config/database");
const {
  createMedia,
  getMediaForEntity,
  deleteMedia,
} = require("./mediaService");

const MAX_OPPORTUNITY_IMAGES = 6;

// ============================================================
// HELPERS
// ============================================================

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getOpportunityMedia = async (opportunityId) => {
  return getMediaForEntity({
    entityType: "opportunity",
    entityId: opportunityId,
  });
};

const attachMedia = async (opportunity) => {
  const media = await getOpportunityMedia(opportunity.id);

  return {
    ...opportunity,
    media,
  };
};

const validateImageFiles = (files) => {
  if (!files) {
    return [];
  }

  if (!Array.isArray(files)) {
    throw createError("Invalid image files", 400);
  }

  if (files.length > MAX_OPPORTUNITY_IMAGES) {
    throw createError(
      `You can upload a maximum of ${MAX_OPPORTUNITY_IMAGES} images`,
      400,
    );
  }

  for (const file of files) {
    if (!file || !file.buffer) {
      throw createError("Invalid image file", 400);
    }
  }

  return files;
};

const uploadOpportunityImages = async (opportunityId, files) => {
  const imageFiles = validateImageFiles(files);

  const uploadedMedia = [];

  for (let index = 0; index < imageFiles.length; index++) {
    const media = await createMedia({
      file: imageFiles[index],
      entityType: "opportunity",
      entityId: opportunityId,
      folder: "naijafix/opportunities",
      sortOrder: index,
    });

    uploadedMedia.push(media);
  }

  return uploadedMedia;
};

// ============================================================
// CREATE OPPORTUNITY
// ============================================================

const createOpportunity = async (customerId, data, imageFiles = []) => {
  const {
    categoryId,
    title,
    description,
    locationText,
    latitude,
    longitude,
    expiresAt,
    providerId,
  } = data;

  if (!categoryId || !title || !description || !expiresAt) {
    throw createError(
      "Category, title, description and expiration date are required",
      400,
    );
  }

  const normalizedTitle = String(title).trim();
  const normalizedDescription = String(description).trim();

  if (!normalizedTitle) {
    throw createError("Opportunity title cannot be empty", 400);
  }

  if (!normalizedDescription) {
    throw createError("Opportunity description cannot be empty", 400);
  }

  const expirationDate = new Date(expiresAt);

  if (Number.isNaN(expirationDate.getTime())) {
    throw createError("Invalid expiration date", 400);
  }

  if (expirationDate <= new Date()) {
    throw createError("Expiration date must be in the future", 400);
  }

  const categoryResult = await pool.query(
    `
    SELECT id, name, slug
    FROM categories
    WHERE id = $1
      AND is_active = true
    `,
    [categoryId],
  );

  if (categoryResult.rows.length === 0) {
    throw createError("Category not found", 404);
  }

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
    throw createError("Customer account not found", 404);
  }

  if (providerId) {
    const providerResult = await pool.query(
      `
      SELECT id
      FROM users
      WHERE id = $1
        AND role = 'provider'
        AND is_active = true
      `,
      [providerId],
    );

    if (providerResult.rows.length === 0) {
      throw createError("Requested provider account not found", 404);
    }
  }

  const files = validateImageFiles(imageFiles);

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
      expires_at,
      target_provider_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)

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
      updated_at,
      target_provider_id
    `,
    [
      customerId,
      categoryId,
      normalizedTitle,
      normalizedDescription,
      locationText !== undefined && locationText !== null
        ? String(locationText).trim() || null
        : null,
      latitude !== undefined && latitude !== null && latitude !== ""
        ? Number(latitude)
        : null,
      longitude !== undefined && longitude !== null && longitude !== ""
        ? Number(longitude)
        : null,
      expirationDate,
      providerId || null,
    ],
  );

  const opportunity = result.rows[0];

  try {
    await uploadOpportunityImages(opportunity.id, files);
  } catch (error) {
    // Remove the opportunity if image upload fails.
    await pool.query(
      `
      DELETE FROM opportunities
      WHERE id = $1
      `,
      [opportunity.id],
    );

    throw error;
  }

  return attachMedia({
    ...opportunity,
    category_name: categoryResult.rows[0].name,
    category_slug: categoryResult.rows[0].slug,
  });
};

// ============================================================
// GET MY OPPORTUNITIES
// ============================================================

const getMyOpportunities = async (customerId) => {
  const result = await pool.query(
    `
    UPDATE opportunities
    SET
      status = 'expired',
      updated_at = NOW()
    WHERE customer_id = $1
      AND status = 'open'
      AND expires_at <= NOW()
    `,
    [customerId],
  );

  const opportunitiesResult = await pool.query(
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
      o.updated_at,
      COUNT(b.id)::integer AS application_count,
      COUNT(b.id) FILTER (WHERE b.status = 'accepted')::integer AS accepted_application_count

    FROM opportunities o

    INNER JOIN categories c
      ON c.id = o.category_id
    LEFT JOIN bookings b
      ON b.opportunity_id = o.id

    WHERE o.customer_id = $1

    GROUP BY o.id, c.name, c.slug

    ORDER BY o.created_at DESC
    `,
    [customerId],
  );

  const opportunities = [];

  for (const opportunity of opportunitiesResult.rows) {
    opportunities.push(await attachMedia(opportunity));
  }

  return opportunities;
};

// ============================================================
// GET MY OPPORTUNITY BY ID
// ============================================================

const getMyOpportunityById = async (customerId, opportunityId) => {
  await pool.query(
    `
    UPDATE opportunities
    SET
      status = 'expired',
      updated_at = NOW()
    WHERE id = $1
      AND customer_id = $2
      AND status = 'open'
      AND expires_at <= NOW()
    `,
    [opportunityId, customerId],
  );

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
    throw createError("Opportunity not found", 404);
  }

  return attachMedia(result.rows[0]);
};

// ============================================================
// UPDATE MY OPPORTUNITY
// ============================================================

const updateMyOpportunity = async (
  customerId,
  opportunityId,
  data,
  imageFiles = [],
) => {
  const {
    categoryId,
    title,
    description,
    locationText,
    latitude,
    longitude,
    expiresAt,
  } = data;

  const hasFieldUpdate =
    categoryId !== undefined ||
    title !== undefined ||
    description !== undefined ||
    locationText !== undefined ||
    latitude !== undefined ||
    longitude !== undefined ||
    expiresAt !== undefined;

  const files = validateImageFiles(imageFiles);

  if (!hasFieldUpdate && files.length === 0) {
    throw createError("No opportunity fields provided for update", 400);
  }

  // ----------------------------------------------------------
  // GET + LOCK OPPORTUNITY
  // ----------------------------------------------------------

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingResult = await client.query(
      `
      SELECT
        id,
        category_id,
        title,
        description,
        location_text,
        latitude,
        longitude,
        status,
        expires_at
      FROM opportunities
      WHERE id = $1
        AND customer_id = $2
      FOR UPDATE
      `,
      [opportunityId, customerId],
    );

    if (existingResult.rows.length === 0) {
      throw createError("Opportunity not found", 404);
    }

    const existing = existingResult.rows[0];

    if (existing.status === "open" && new Date(existing.expires_at) <= new Date()) {
      await client.query(
        `
        UPDATE opportunities
        SET
          status = 'expired',
          updated_at = NOW()
        WHERE id = $1
        `,
        [opportunityId],
      );

      await client.query("COMMIT");

      throw createError("Expired opportunities cannot be updated", 400);
    }

    if (existing.status !== "open") {
      throw createError("Only open opportunities can be updated", 400);
    }

    // --------------------------------------------------------
    // VALIDATE CATEGORY
    // --------------------------------------------------------

    if (categoryId !== undefined) {
      const categoryResult = await client.query(
        `
        SELECT id
        FROM categories
        WHERE id = $1
          AND is_active = true
        `,
        [categoryId],
      );

      if (categoryResult.rows.length === 0) {
        throw createError("Category not found", 404);
      }
    }

    // --------------------------------------------------------
    // VALIDATE TITLE
    // --------------------------------------------------------

    if (title !== undefined && !String(title).trim()) {
      throw createError("Opportunity title cannot be empty", 400);
    }

    // --------------------------------------------------------
    // VALIDATE DESCRIPTION
    // --------------------------------------------------------

    if (description !== undefined && !String(description).trim()) {
      throw createError("Opportunity description cannot be empty", 400);
    }

    // --------------------------------------------------------
    // VALIDATE EXPIRATION
    // --------------------------------------------------------

    let expirationDate;

    if (expiresAt !== undefined) {
      expirationDate = new Date(expiresAt);

      if (Number.isNaN(expirationDate.getTime())) {
        throw createError("Invalid expiration date", 400);
      }

      if (expirationDate <= new Date()) {
        throw createError("Expiration date must be in the future", 400);
      }
    }

    // --------------------------------------------------------
    // BUILD UPDATE DYNAMICALLY
    // --------------------------------------------------------

    const updates = [];
    const values = [];

    const addUpdate = (column, value) => {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    };

    if (categoryId !== undefined) {
      addUpdate("category_id", categoryId);
    }

    if (title !== undefined) {
      addUpdate("title", String(title).trim());
    }

    if (description !== undefined) {
      addUpdate("description", String(description).trim());
    }

    if (locationText !== undefined) {
      addUpdate(
        "location_text",
        locationText === null ? null : String(locationText).trim() || null,
      );
    }

    if (latitude !== undefined) {
      addUpdate(
        "latitude",
        latitude === null || latitude === "" ? null : Number(latitude),
      );
    }

    if (longitude !== undefined) {
      addUpdate(
        "longitude",
        longitude === null || longitude === "" ? null : Number(longitude),
      );
    }

    if (expiresAt !== undefined) {
      addUpdate("expires_at", expirationDate);
    }

    if (updates.length > 0) {
      addUpdate("updated_at", new Date());

      values.push(opportunityId);
      values.push(customerId);

      const result = await client.query(
        `
        UPDATE opportunities
        SET ${updates.join(", ")}
        WHERE id = $${values.length - 1}
          AND customer_id = $${values.length}
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
        values,
      );

      if (result.rows.length === 0) {
        throw createError("Unable to update opportunity", 400);
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Opportunity rollback error:", rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }

  // ----------------------------------------------------------
  // ADD NEW IMAGES
  // ----------------------------------------------------------

  if (files.length > 0) {
    const existingMedia = await getOpportunityMedia(opportunityId);

    if (existingMedia.length + files.length > MAX_OPPORTUNITY_IMAGES) {
      throw createError(
        `An opportunity can have a maximum of ${MAX_OPPORTUNITY_IMAGES} images`,
        400,
      );
    }

    await uploadOpportunityImages(opportunityId, files);
  }

  return getMyOpportunityById(customerId, opportunityId);
};

// ============================================================
// WITHDRAW OPPORTUNITY
// ============================================================

const withdrawOpportunity = async (customerId, opportunityId) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      SELECT
        id,
        status,
        expires_at
      FROM opportunities
      WHERE id = $1
        AND customer_id = $2
      FOR UPDATE
      `,
      [opportunityId, customerId],
    );

    if (result.rows.length === 0) {
      throw createError("Opportunity not found", 404);
    }

    const opportunity = result.rows[0];

    if (opportunity.status === "open" &&
      new Date(opportunity.expires_at) <= new Date()) {
      await client.query(
        `
        UPDATE opportunities
        SET
          status = 'expired',
          updated_at = NOW()
        WHERE id = $1
        `,
        [opportunityId],
      );

      await client.query("COMMIT");

      throw createError("This opportunity has already expired", 400);
    }

    if (opportunity.status !== "open") {
      throw createError(
        `This opportunity cannot be withdrawn because it is ${opportunity.status}`,
        400,
      );
    }

    const updateResult = await client.query(
      `
  UPDATE opportunities
  SET
    status = 'withdrawn',
    updated_at = NOW()
  WHERE id = $1
    AND customer_id = $2
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
      [opportunityId, customerId],
    );

    if (updateResult.rows.length === 0) {
      throw createError("Unable to withdraw opportunity", 400);
    }

    await client.query("COMMIT");

    return attachMedia(updateResult.rows[0]);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Withdraw opportunity rollback error:", rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// GET OPEN OPPORTUNITIES FOR PROVIDERS
// ============================================================

const getOpenOpportunities = async (filters = {}) => {
  const { categoryId } = filters;

  const values = [];
  const conditions = [
    "o.status = 'open'",
    "o.expires_at > NOW()",
    "c.is_active = true",
    "o.target_provider_id IS NULL",
  ];

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
      o.created_at,
      o.updated_at

    FROM opportunities o

    INNER JOIN categories c
      ON c.id = o.category_id

    WHERE ${conditions.join(" AND ")}

    ORDER BY o.created_at DESC
    `,
    values,
  );

  const opportunities = [];

  for (const opportunity of result.rows) {
    opportunities.push(await attachMedia(opportunity));
  }

  return opportunities;
};

const getRequestedOpportunities = async (providerId) => {
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
      o.created_at,
      o.updated_at,
      o.target_provider_id
    FROM opportunities o
    INNER JOIN categories c ON c.id = o.category_id
    WHERE o.target_provider_id = $1
      AND o.status = 'open'
      AND o.expires_at > NOW()
      AND c.is_active = true
    ORDER BY o.created_at DESC
    `,
    [providerId],
  );

  return Promise.all(result.rows.map(attachMedia));
};

// ============================================================
// GET ONE OPEN OPPORTUNITY FOR PROVIDER
// ============================================================

const getOpenOpportunityById = async (opportunityId) => {
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
      o.created_at,
      o.updated_at

    FROM opportunities o

    INNER JOIN categories c
      ON c.id = o.category_id

    WHERE o.id = $1
      AND o.status = 'open'
      AND o.expires_at > NOW()
      AND c.is_active = true
    `,
    [opportunityId],
  );

  if (result.rows.length === 0) {
    throw createError("Opportunity not found or no longer available", 404);
  }

  return attachMedia(result.rows[0]);
};
// ============================================================
// ADD IMAGES TO OPPORTUNITY
// ============================================================

const addOpportunityImages = async (
  customerId,
  opportunityId,
  imageFiles = [],
) => {
  const files = validateImageFiles(imageFiles);

  if (files.length === 0) {
    throw createError("At least one image is required", 400);
  }

  const result = await pool.query(
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

  if (result.rows.length === 0) {
    throw createError("Opportunity not found", 404);
  }

  const opportunity = result.rows[0];

  if (
    opportunity.status === "open" &&
    new Date(opportunity.expires_at) <= new Date()
  ) {
    await pool.query(
      `
      UPDATE opportunities
      SET
        status = 'expired',
        updated_at = NOW()
      WHERE id = $1
      `,
      [opportunityId],
    );

    throw createError("Expired opportunities cannot be updated", 400);
  }

  if (opportunity.status !== "open") {
    throw createError(
      `Only open opportunities can be updated because this opportunity is ${opportunity.status}`,
      400,
    );
  }

  const existingMedia = await getOpportunityMedia(opportunityId);

  if (existingMedia.length + files.length > MAX_OPPORTUNITY_IMAGES) {
    throw createError(
      `An opportunity can have a maximum of ${MAX_OPPORTUNITY_IMAGES} images`,
      400,
    );
  }

  const startSortOrder = existingMedia.length;

  const uploadedMedia = [];

  for (let index = 0; index < files.length; index++) {
    const media = await createMedia({
      file: files[index],
      entityType: "opportunity",
      entityId: opportunityId,
      folder: "naijafix/opportunities",
      sortOrder: startSortOrder + index,
    });

    uploadedMedia.push(media);
  }

  return uploadedMedia;
};

// ============================================================
// DELETE OPPORTUNITY IMAGE
// ============================================================

const deleteOpportunityImage = async (
  customerId,
  opportunityId,
  mediaId,
) => {
  const opportunityResult = await pool.query(
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

  if (opportunityResult.rows.length === 0) {
    throw createError("Opportunity not found", 404);
  }

  const opportunity = opportunityResult.rows[0];

  if (
    opportunity.status === "open" &&
    new Date(opportunity.expires_at) <= new Date()
  ) {
    await pool.query(
      `
      UPDATE opportunities
      SET
        status = 'expired',
        updated_at = NOW()
      WHERE id = $1
      `,
      [opportunityId],
    );

    throw createError("Expired opportunities cannot be updated", 400);
  }

  if (opportunity.status !== "open") {
    throw createError(
      `Only open opportunities can be updated because this opportunity is ${opportunity.status}`,
      400,
    );
  }

  const mediaResult = await pool.query(
    `
    SELECT id
    FROM media
    WHERE id = $1
      AND entity_type = 'opportunity'
      AND entity_id = $2
    `,
    [mediaId, opportunityId],
  );

  if (mediaResult.rows.length === 0) {
    throw createError("Opportunity image not found", 404);
  }

  await deleteMedia(mediaId);

  // Re-number the remaining images so their sort order stays clean.
  const remainingMedia = await getOpportunityMedia(opportunityId);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (let index = 0; index < remainingMedia.length; index++) {
      await client.query(
        `
        UPDATE media
        SET sort_order = $1
        WHERE id = $2
        `,
        [index, remainingMedia[index].id],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return getOpportunityMedia(opportunityId);
};

const deleteOpportunity = async (customerId, opportunityId) => {
  const client = await pool.connect();
  let mediaIds = [];

  try {
    await client.query("BEGIN");

    const opportunityResult = await client.query(
      `
      SELECT id
      FROM opportunities
      WHERE id = $1
        AND customer_id = $2
      FOR UPDATE
      `,
      [opportunityId, customerId],
    );

    if (opportunityResult.rows.length === 0) {
      throw createError("Opportunity not found", 404);
    }

    const bookingResult = await client.query(
      `
      SELECT id
      FROM bookings
      WHERE opportunity_id = $1
      LIMIT 1
      `,
      [opportunityId],
    );

    if (bookingResult.rows.length > 0) {
      throw createError(
        "Requests with provider applications or bookings cannot be deleted. Withdraw this request instead.",
        409,
      );
    }

    const mediaResult = await client.query(
      `
      SELECT id
      FROM media
      WHERE entity_type = 'opportunity'
        AND entity_id = $1
      `,
      [opportunityId],
    );
    mediaIds = mediaResult.rows.map((media) => media.id);

    await client.query(
      `
      DELETE FROM opportunities
      WHERE id = $1
        AND customer_id = $2
      `,
      [opportunityId, customerId],
    );

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Opportunity deletion rollback error:", rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }

  for (const mediaId of mediaIds) {
    try {
      await deleteMedia(mediaId);
    } catch (error) {
      console.error("Deleted opportunity media cleanup error:", error);
    }
  }
};

module.exports = {
  createOpportunity,
  getMyOpportunities,
  getMyOpportunityById,
  updateMyOpportunity,
  withdrawOpportunity,
  getOpenOpportunities,
  getRequestedOpportunities,
  getOpenOpportunityById,
  addOpportunityImages,
  deleteOpportunityImage,
  deleteOpportunity,
};