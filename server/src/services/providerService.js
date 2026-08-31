const pool = require("../config/database");

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
    const error = new Error("No profile fields provided for update");
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

    // PostgreSQL unique username violation
    if (error.code === "23505") {
      const usernameError = new Error("Username is already taken");
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

const updateProviderAvailability = async (userId, isAvailable) => {
  if (typeof isAvailable !== "boolean") {
    const error = new Error("isAvailable must be true or false");
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

const updateProviderOnlineStatus = async (userId, isOnline) => {
  if (typeof isOnline !== "boolean") {
    const error = new Error("isOnline must be true or false");
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

module.exports = {
  getProviderProfile,
  updateProviderProfile,
  updateProviderAvailability,
  updateProviderOnlineStatus,
};
