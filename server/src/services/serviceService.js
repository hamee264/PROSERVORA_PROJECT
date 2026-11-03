const pool = require("../config/database");
const { uploadImage, deleteImage } = require("./cloudinaryService");
const { deleteMedia } = require("./mediaService");

const MAX_SERVICE_IMAGES = 6;

const serviceError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const formatMedia = (media) => ({
  id: media.id,
  url: media.url,
  publicId: media.cloudinary_public_id,
  width: media.width,
  height: media.height,
  format: media.format,
  bytes: media.bytes,
  sortOrder: media.sort_order,
  createdAt: media.created_at,
});

const getServiceMedia = async (serviceId) => {
  const result = await pool.query(
    `
    SELECT
      id,
      url,
      cloudinary_public_id,
      width,
      height,
      format,
      bytes,
      sort_order,
      created_at
    FROM media
    WHERE entity_type = 'service'
      AND entity_id = $1
    ORDER BY sort_order ASC, created_at ASC
    `,
    [serviceId],
  );

  return result.rows.map(formatMedia);
};

const validateImageFiles = (imageFiles) => {
  if (imageFiles === undefined) return;

  if (!Array.isArray(imageFiles)) {
    throw serviceError("Images must be uploaded as an array", 400);
  }

  if (imageFiles.length > MAX_SERVICE_IMAGES) {
    throw serviceError(
      `A service can have a maximum of ${MAX_SERVICE_IMAGES} images`,
      400,
    );
  }
};

const uploadServiceImages = async (
  serviceId,
  imageFiles,
  startOrder = 0,
) => {
  validateImageFiles(imageFiles);

  if (!imageFiles?.length) return [];

  const uploaded = [];

  try {
    for (let index = 0; index < imageFiles.length; index += 1) {
      const image = await uploadImage(
        imageFiles[index].buffer,
        "naijafix/services",
      );

      uploaded.push(image);

      await pool.query(
        `
        INSERT INTO media (
          entity_type,
          entity_id,
          cloudinary_public_id,
          url,
          width,
          height,
          format,
          bytes,
          sort_order
        )
        VALUES ('service', $1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          serviceId,
          image.publicId,
          image.url,
          image.width,
          image.height,
          image.format,
          image.bytes,
          startOrder + index,
        ],
      );
    }
  } catch (error) {
    for (const image of uploaded) {
      try {
        await deleteImage(image.publicId);
      } catch (cleanupError) {
        console.error(
          "Failed to clean up service image:",
          cleanupError,
        );
      }
    }

    throw error;
  }

  return getServiceMedia(serviceId);
};

// ============================================================
// CREATE PROVIDER SERVICE
// ============================================================

const createProviderService = async (
  providerId,
  data,
  imageFiles = [],
) => {
  const { categoryId, title, description } = data;

  if (!categoryId || !title || !description) {
    throw serviceError(
      "Category, title and description are required",
      400,
    );
  }

  if (
    typeof title !== "string" ||
    typeof description !== "string"
  ) {
    throw serviceError(
      "Title and description must be strings",
      400,
    );
  }

  const normalizedTitle = title.trim();
  const normalizedDescription = description.trim();

  if (!normalizedTitle) {
    throw serviceError(
      "Service title cannot be empty",
      400,
    );
  }

  if (normalizedTitle.length > 150) {
    throw serviceError(
      "Service title must not exceed 150 characters",
      400,
    );
  }

  if (!normalizedDescription) {
    throw serviceError(
      "Service description cannot be empty",
      400,
    );
  }

  if (normalizedDescription.length > 5000) {
    throw serviceError(
      "Service description must not exceed 5000 characters",
      400,
    );
  }

  validateImageFiles(imageFiles);

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
    throw serviceError("Category not found", 404);
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
    throw serviceError(
      "Provider profile not found",
      404,
    );
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
    [
      providerId,
      categoryId,
      normalizedTitle,
      normalizedDescription,
    ],
  );

  const service = result.rows[0];

  try {
    await uploadServiceImages(
      service.id,
      imageFiles,
    );
  } catch (error) {
    await pool.query(
      `DELETE FROM services WHERE id = $1`,
      [service.id],
    );

    throw error;
  }

  return {
    ...service,
    media: await getServiceMedia(service.id),
  };
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

  return Promise.all(
    result.rows.map(async (service) => ({
      ...service,
      media: await getServiceMedia(service.id),
    })),
  );
};

// ============================================================
// GET MY SERVICE BY ID
// ============================================================

const getServiceById = async (
  userId,
  serviceId,
) => {
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
    throw serviceError(
      "Service not found",
      404,
    );
  }

  return {
    ...result.rows[0],
    media: await getServiceMedia(serviceId),
  };
};

// ============================================================
// UPDATE PROVIDER SERVICE
// ============================================================

const updateProviderService = async (
  providerId,
  serviceId,
  data,
) => {
  const {
    categoryId,
    title,
    description,
  } = data;

  if (
    categoryId === undefined &&
    title === undefined &&
    description === undefined
  ) {
    throw serviceError(
      "No service fields provided for update",
      400,
    );
  }

  if (
    categoryId !== undefined &&
    !categoryId
  ) {
    throw serviceError(
      "Category ID cannot be empty",
      400,
    );
  }

  if (title !== undefined) {
    if (
      typeof title !== "string" ||
      !title.trim()
    ) {
      throw serviceError(
        "Service title cannot be empty",
        400,
      );
    }

    if (title.trim().length > 150) {
      throw serviceError(
        "Service title must not exceed 150 characters",
        400,
      );
    }
  }

  if (description !== undefined) {
    if (
      typeof description !== "string" ||
      !description.trim()
    ) {
      throw serviceError(
        "Service description cannot be empty",
        400,
      );
    }

    if (description.trim().length > 5000) {
      throw serviceError(
        "Service description must not exceed 5000 characters",
        400,
      );
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
      throw serviceError(
        "Category not found",
        404,
      );
    }
  }

  // ----------------------------------------------------------
  // UPDATE
  // ----------------------------------------------------------

  const result = await pool.query(
    `
    UPDATE services
    SET
      category_id = COALESCE($1, category_id),
      title = COALESCE($2, title),
      description = COALESCE($3, description),
      updated_at = now()

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
      categoryId !== undefined
        ? categoryId
        : null,

      title !== undefined
        ? title.trim()
        : null,

      description !== undefined
        ? description.trim()
        : null,

      serviceId,
      providerId,
    ],
  );

  if (result.rows.length === 0) {
    throw serviceError(
      "Service not found",
      404,
    );
  }

  return {
    ...result.rows[0],
    media: await getServiceMedia(serviceId),
  };
};

// ============================================================
// UPDATE SERVICE STATUS
// ============================================================

const updateProviderServiceStatus = async (
  providerId,
  serviceId,
  isActive,
) => {
  if (typeof isActive !== "boolean") {
    throw serviceError(
      "isActive must be true or false",
      400,
    );
  }

  const result = await pool.query(
    `
    UPDATE services
    SET
      is_active = $1,
      updated_at = now()

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
    [
      isActive,
      serviceId,
      providerId,
    ],
  );

  if (result.rows.length === 0) {
    throw serviceError(
      "Service not found",
      404,
    );
  }

  return {
    ...result.rows[0],
    media: await getServiceMedia(serviceId),
  };
};

// ============================================================
// DELETE PROVIDER SERVICE
// ============================================================

const deleteProviderService = async (
  providerId,
  serviceId,
) => {
  const serviceResult = await pool.query(
    `
    SELECT id, title
    FROM services
    WHERE id = $1
      AND provider_id = $2
    `,
    [serviceId, providerId],
  );

  if (serviceResult.rows.length === 0) {
    throw serviceError(
      "Service not found",
      404,
    );
  }

  const bookingResult = await pool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM bookings
    WHERE service_id = $1
    `,
    [serviceId],
  );

  if (bookingResult.rows[0].count > 0) {
    throw serviceError(
      "This service has booking history and cannot be deleted. Deactivate it instead.",
      409,
    );
  }

  const mediaResult = await pool.query(
    `
    SELECT id, cloudinary_public_id
    FROM media
    WHERE entity_type = 'service'
      AND entity_id = $1
    `,
    [serviceId],
  );

  await pool.query(
    `
    DELETE FROM services
    WHERE id = $1
      AND provider_id = $2
    `,
    [serviceId, providerId],
  );

  for (const media of mediaResult.rows) {
    try {
      await deleteImage(
        media.cloudinary_public_id,
      );
    } catch (error) {
      console.error(
        "Failed to clean up deleted service image:",
        error,
      );
    }
  }

  await pool.query(
    `
    DELETE FROM media
    WHERE entity_type = 'service'
      AND entity_id = $1
    `,
    [serviceId],
  );

  return {
    serviceId,
    deleted: true,
  };
};

// ============================================================
// ADD SERVICE IMAGES
// ============================================================

const addServiceImages = async (
  providerId,
  serviceId,
  imageFiles,
) => {
  validateImageFiles(imageFiles);

  const ownershipResult = await pool.query(
    `
    SELECT id
    FROM services
    WHERE id = $1
      AND provider_id = $2
    `,
    [serviceId, providerId],
  );

  if (ownershipResult.rows.length === 0) {
    throw serviceError(
      "Service not found",
      404,
    );
  }

  const currentCountResult = await pool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM media
    WHERE entity_type = 'service'
      AND entity_id = $1
    `,
    [serviceId],
  );

  const currentCount =
    currentCountResult.rows[0].count;

  if (
    currentCount + imageFiles.length >
    MAX_SERVICE_IMAGES
  ) {
    throw serviceError(
      `A service can have a maximum of ${MAX_SERVICE_IMAGES} images`,
      400,
    );
  }

  return uploadServiceImages(
    serviceId,
    imageFiles,
    currentCount,
  );
};

// ============================================================
// DELETE SERVICE IMAGE
// ============================================================

const deleteServiceImage = async (
  providerId,
  serviceId,
  mediaId,
) => {
  const result = await pool.query(
    `
    SELECT m.id
    FROM media m

    INNER JOIN services s
      ON s.id = m.entity_id

    WHERE m.id = $1
      AND m.entity_type = 'service'
      AND m.entity_id = $2
      AND s.provider_id = $3
    `,
    [
      mediaId,
      serviceId,
      providerId,
    ],
  );

  if (result.rows.length === 0) {
    throw serviceError(
      "Service image not found",
      404,
    );
  }

  await deleteMedia(mediaId);

  return {
    mediaId,
    deleted: true,
  };
};

// ============================================================
// REORDER SERVICE IMAGES
// ============================================================

const reorderServiceImages = async (
  providerId,
  serviceId,
  mediaIds,
) => {
  if (
    !Array.isArray(mediaIds) ||
    mediaIds.length === 0
  ) {
    throw serviceError(
      "mediaIds must be a non-empty array",
      400,
    );
  }

  if (
    new Set(mediaIds).size !==
    mediaIds.length
  ) {
    throw serviceError(
      "mediaIds must not contain duplicates",
      400,
    );
  }

  const serviceResult = await pool.query(
    `
    SELECT id
    FROM services
    WHERE id = $1
      AND provider_id = $2
    `,
    [serviceId, providerId],
  );

  if (serviceResult.rows.length === 0) {
    throw serviceError(
      "Service not found",
      404,
    );
  }

  const mediaResult = await pool.query(
    `
    SELECT id
    FROM media
    WHERE entity_type = 'service'
      AND entity_id = $1
    ORDER BY sort_order ASC, created_at ASC
    `,
    [serviceId],
  );

  const existingIds =
    mediaResult.rows.map(
      (row) => row.id,
    );

  if (
    existingIds.length !==
    mediaIds.length ||
    existingIds.some(
      (id) => !mediaIds.includes(id),
    )
  ) {
    throw serviceError(
      "mediaIds must contain every image belonging to this service",
      400,
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (
      let index = 0;
      index < mediaIds.length;
      index += 1
    ) {
      await client.query(
        `
        UPDATE media
        SET sort_order = $1
        WHERE id = $2
          AND entity_type = 'service'
          AND entity_id = $3
        `,
        [
          index,
          mediaIds[index],
          serviceId,
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return getServiceMedia(serviceId);
};

// ============================================================
// PUBLIC SERVICE DISCOVERY
// ============================================================

const getPublicServices = async (
  filters = {},
) => {
  const {
    category,
    city,
    search,
  } = filters;

  const values = [];

  const conditions = [
    "s.is_active = true",
    "c.is_active = true",
    "u.is_active = true",
    "pp.is_verified = true",
  ];

  if (category) {
    values.push(
      category.trim().toLowerCase(),
    );

    conditions.push(
      `c.slug = $${values.length}`,
    );
  }

  if (city) {
    values.push(city.trim());

    conditions.push(
      `LOWER(p.city) = LOWER($${values.length})`,
    );
  }

  if (search) {
    values.push(
      `%${search.trim()}%`,
    );

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
    `,
    values,
  );

  return Promise.all(
    result.rows.map(
      async (service) => ({
        ...service,
        media:
          await getServiceMedia(
            service.id,
          ),
      }),
    ),
  );
};

// ============================================================
// PUBLIC SERVICE BY ID
// ============================================================

const getPublicServiceById = async (
  serviceId,
) => {
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

    INNER JOIN users u
      ON u.id = s.provider_id

    INNER JOIN profiles p
      ON p.user_id = s.provider_id

    INNER JOIN provider_profiles pp
      ON pp.user_id = s.provider_id

    WHERE s.id = $1
      AND s.is_active = true
      AND c.is_active = true
      AND u.is_active = true
      AND pp.is_verified = true
    `,
    [serviceId],
  );

  if (result.rows.length === 0) {
    throw serviceError(
      "Service not found",
      404,
    );
  }

  return {
    ...result.rows[0],
    media:
      await getServiceMedia(serviceId),
  };
};
// ============================================================
// SEARCH SUGGESTIONS
// ============================================================

// ============================================================
// SEARCH SUGGESTIONS
// ============================================================

const getSearchSuggestions = async (query) => {
  if (
    typeof query !== "string" ||
    !query.trim()
  ) {
    return [];
  }

  const searchTerm = query.trim();

  if (searchTerm.length < 2) {
    return [];
  }

  const result = await pool.query(
    `
    WITH suggestions AS (

      -- ======================================================
      -- SERVICE TITLES
      -- ======================================================

      SELECT
        'service' AS type,
        s.title AS label,
        s.id::text AS id,
        c.name AS category_name,
        c.slug AS category_slug,
        1 AS priority

      FROM services s

      INNER JOIN categories c
        ON c.id = s.category_id

      INNER JOIN users u
        ON u.id = s.provider_id

      INNER JOIN provider_profiles pp
        ON pp.user_id = s.provider_id

      WHERE s.is_active = true
        AND c.is_active = true
        AND u.is_active = true
        AND pp.is_verified = true
        AND s.title ILIKE $1


      UNION


      -- ======================================================
      -- CATEGORIES
      -- ======================================================

      SELECT
        'category' AS type,
        c.name AS label,
        c.id::text AS id,
        c.name AS category_name,
        c.slug AS category_slug,
        2 AS priority

      FROM categories c

      WHERE c.is_active = true
        AND c.name ILIKE $1


      UNION


      -- ======================================================
      -- PROVIDER NAMES
      -- ======================================================

      SELECT
        'provider' AS type,

        TRIM(
          CONCAT(
            p.first_name,
            ' ',
            p.last_name
          )
        ) AS label,

        u.id::text AS id,

        NULL AS category_name,
        NULL AS category_slug,
        3 AS priority

      FROM users u

      INNER JOIN profiles p
        ON p.user_id = u.id

      INNER JOIN provider_profiles pp
        ON pp.user_id = u.id

      WHERE u.role = 'provider'
        AND u.is_active = true
        AND pp.is_verified = true

        AND (
          p.first_name ILIKE $1
          OR p.last_name ILIKE $1
          OR p.username ILIKE $1
        )


      UNION


      -- ======================================================
      -- LOCATIONS
      -- ======================================================

      SELECT
        'location' AS type,

        p.city AS label,

        p.city AS id,

        NULL AS category_name,
        NULL AS category_slug,
        4 AS priority

      FROM profiles p

      INNER JOIN users u
        ON u.id = p.user_id

      INNER JOIN provider_profiles pp
        ON pp.user_id = p.user_id

      WHERE u.role = 'provider'
        AND u.is_active = true
        AND pp.is_verified = true
        AND p.city IS NOT NULL
        AND p.city <> ''
        AND p.city ILIKE $1
    )

    SELECT DISTINCT ON (type, label)
      type,
      label,
      id,
      category_name,
      category_slug

    FROM suggestions

    ORDER BY
      type,
      label,
      priority

    LIMIT 10
    `,
    [`%${searchTerm}%`],
  );

  return result.rows;
};
module.exports = {
  MAX_SERVICE_IMAGES,
  createProviderService,
  getMyServices,
  getServiceById,
  updateProviderService,
  updateProviderServiceStatus,
  deleteProviderService,
  addServiceImages,
  deleteServiceImage,
  reorderServiceImages,
  getSearchSuggestions,
  getPublicServices,
  getPublicServiceById,
  getServiceMedia,
};