const pool = require("../config/database");
const { uploadImage } = require("./cloudinaryService");

// ============================================================
// GET PUBLIC PROVIDER PROFILE
// ============================================================

const getPublicProviderProfile = async (providerId) => {
  const result = await pool.query(
    `
    SELECT
      u.id,

      p.first_name,
      p.last_name,
      p.username,
      p.avatar_url,
      p.bio,
      p.country,
      p.city,
      p.latitude,
      p.longitude,

      pp.is_available,
      pp.is_online,
      pp.is_verified,
      pp.rating,
      pp.total_reviews,
      pp.total_jobs_completed

    FROM users u

    INNER JOIN profiles p
      ON p.user_id = u.id

    INNER JOIN provider_profiles pp
      ON pp.user_id = u.id

    WHERE u.id = $1
      AND u.role = 'provider'
      AND u.is_active = true
      AND pp.is_verified = true
    `,
    [providerId],
  );

  if (result.rows.length === 0) {
    const error = new Error("Provider not found");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};

// ============================================================
// GET PROVIDER PROFILE
// ============================================================

const getProviderProfile = async (userId) => {
  const result = await pool.query(
    `
    SELECT
      u.id,
      u.email,
      u.role,
      u.is_email_verified,
      u.is_active,
      u.created_at,

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

      pp.is_available,
      pp.is_online,
      pp.is_verified,
      pp.verification_status,
      pp.verification_submitted_at,
      pp.verification_reviewed_at,
      pp.verification_rejection_reason,
      pp.date_of_birth,
      pp.residential_address,
      pp.id_type,
      pp.id_number,
      pp.id_document_url,
      pp.rating,
      pp.total_reviews,
      pp.total_jobs_completed,
      pp.created_at AS provider_created_at,
      pp.updated_at AS provider_updated_at

    FROM users u

    INNER JOIN profiles p
      ON p.user_id = u.id

    INNER JOIN provider_profiles pp
      ON pp.user_id = u.id

    WHERE u.id = $1
      AND u.role = 'provider'
    `,
    [userId],
  );

  if (result.rows.length === 0) {
    const error = new Error("Provider profile not found");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};

const submitProviderVerification = async (userId, data, file) => {
  const {
    dateOfBirth,
    residentialAddress,
    idType,
    idNumber,
  } = data;

  if (!dateOfBirth || !residentialAddress || !idType || !idNumber) {
    const error = new Error(
      "Date of birth, address, ID type, and ID number are required",
    );
    error.statusCode = 400;
    throw error;
  }

  if (!file) {
    const error = new Error("An ID document is required");
    error.statusCode = 400;
    throw error;
  }

  const parsedDate = new Date(dateOfBirth);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate > new Date()) {
    const error = new Error("Enter a valid date of birth");
    error.statusCode = 400;
    throw error;
  }

  const uploaded = await uploadImage(
    file.buffer,
    "proservora/provider-verification",
  );

  const result = await pool.query(
    `
    UPDATE provider_profiles
    SET
      date_of_birth = $1,
      residential_address = $2,
      id_type = $3,
      id_number = $4,
      id_document_url = COALESCE($5, id_document_url),
      verification_status = 'submitted',
      verification_submitted_at = NOW(),
      verification_reviewed_at = NULL,
      verification_rejection_reason = NULL,
      updated_at = NOW()
    WHERE user_id = $6
    RETURNING
      is_verified,
      verification_status,
      verification_submitted_at,
      verification_reviewed_at,
      verification_rejection_reason,
      date_of_birth,
      residential_address,
      id_type,
      id_number,
      id_document_url
    `,
    [
      dateOfBirth,
      residentialAddress.trim(),
      idType.trim(),
      idNumber.trim(),
      uploaded?.url || null,
      userId,
    ],
  );

  if (!result.rows.length) {
    const error = new Error("Provider profile not found");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};

// ============================================================
// UPDATE PROVIDER PROFILE
// ============================================================

const updateProviderProfile = async (userId, data) => {
  const {
    firstName,
    lastName,
    username,
    phone,
    bio,
    country,
    city,
    latitude,
    longitude,
  } = data;

  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  if (
    firstName === undefined &&
    lastName === undefined &&
    username === undefined &&
    phone === undefined &&
    bio === undefined &&
    country === undefined &&
    city === undefined &&
    latitude === undefined &&
    longitude === undefined
  ) {
    const error = new Error(
      "No profile fields provided for update",
    );
    error.statusCode = 400;
    throw error;
  }

  if (firstName !== undefined && !firstName.trim()) {
    const error = new Error("First name cannot be empty");
    error.statusCode = 400;
    throw error;
  }

  if (lastName !== undefined && !lastName.trim()) {
    const error = new Error("Last name cannot be empty");
    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // CHECK PROVIDER
  // ----------------------------------------------------------

  const providerCheck = await pool.query(
    `
    SELECT id
    FROM provider_profiles
    WHERE user_id = $1
    `,
    [userId],
  );

  if (providerCheck.rows.length === 0) {
    const error = new Error("Provider profile not found");
    error.statusCode = 404;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // --------------------------------------------------------
    // UPDATE PROFILE
    // --------------------------------------------------------

    const result = await client.query(
      `
      UPDATE profiles
      SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        username = COALESCE($3, username),
        phone = COALESCE($4, phone),
        bio = COALESCE($5, bio),
        country = COALESCE($6, country),
        city = COALESCE($7, city),
        latitude = COALESCE($8, latitude),
        longitude = COALESCE($9, longitude)
      WHERE user_id = $10

      RETURNING
        user_id,
        first_name,
        last_name,
        username,
        phone,
        avatar_url,
        bio,
        country,
        city,
        latitude,
        longitude
      `,
      [
        firstName !== undefined ? firstName.trim() : null,
        lastName !== undefined ? lastName.trim() : null,
        username !== undefined ? username.trim() : null,
        phone !== undefined ? phone.trim() : null,
        bio !== undefined ? bio.trim() : null,
        country !== undefined ? country.trim() : null,
        city !== undefined ? city.trim() : null,
        latitude !== undefined ? latitude : null,
        longitude !== undefined ? longitude : null,
        userId,
      ],
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      const usernameError = new Error(
        "Username is already taken",
      );
      usernameError.statusCode = 409;
      throw usernameError;
    }

    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// UPDATE PROVIDER AVAILABILITY
// ============================================================

const updateProviderAvailability = async (
  userId,
  isAvailable,
) => {
  if (typeof isAvailable !== "boolean") {
    const error = new Error(
      "isAvailable must be true or false",
    );
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
    UPDATE provider_profiles
    SET is_available = $1
    WHERE user_id = $2

    RETURNING
      user_id,
      is_available,
      is_online
    `,
    [isAvailable, userId],
  );

  if (result.rows.length === 0) {
    const error = new Error("Provider profile not found");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};

// ============================================================
// UPDATE PROVIDER ONLINE STATUS
// ============================================================

const updateProviderOnlineStatus = async (
  userId,
  isOnline,
) => {
  if (typeof isOnline !== "boolean") {
    const error = new Error(
      "isOnline must be true or false",
    );
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
    UPDATE provider_profiles
    SET is_online = $1
    WHERE user_id = $2

    RETURNING
      user_id,
      is_available,
      is_online
    `,
    [isOnline, userId],
  );

  if (result.rows.length === 0) {
    const error = new Error("Provider profile not found");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};
const getPublicProviderServices = async (providerId) => {
  const providerResult = await pool.query(
    `
    SELECT u.id
    FROM users u
    INNER JOIN provider_profiles pp
      ON pp.user_id = u.id
    WHERE u.id = $1
      AND u.role = 'provider'
      AND u.is_active = true
      AND pp.is_verified = true
    `,
    [providerId],
  );

  if (providerResult.rows.length === 0) {
    const error = new Error("Provider not found");
    error.statusCode = 404;
    throw error;
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
      s.updated_at

    FROM services s

    INNER JOIN categories c
      ON c.id = s.category_id

    INNER JOIN users u
      ON u.id = s.provider_id

    INNER JOIN provider_profiles pp
      ON pp.user_id = s.provider_id

    WHERE s.provider_id = $1
      AND s.is_active = true
      AND c.is_active = true
      AND u.is_active = true
      AND pp.is_verified = true

    ORDER BY s.created_at DESC
    `,
    [providerId],
  );

  return Promise.all(
    result.rows.map(async (service) => ({
      ...service,

      media: await getServiceMedia(
        service.id,
      ),
    })),
  );
};
module.exports = {
  getPublicProviderProfile,
  getProviderProfile,
  submitProviderVerification,
  updateProviderProfile,
  updateProviderAvailability,
  updateProviderOnlineStatus,
  getPublicProviderServices
};