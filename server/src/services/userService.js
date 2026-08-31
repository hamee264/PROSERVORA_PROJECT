const pool = require("../config/database");

const getCurrentUser = async (userId) => {
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

      pp.is_available,
      pp.is_verified,
      pp.rating,
      pp.total_reviews,
      pp.total_jobs_completed

    FROM users u

    LEFT JOIN profiles p
      ON p.user_id = u.id

    LEFT JOIN provider_profiles pp
      ON pp.user_id = u.id

    WHERE u.id = $1
    `,
    [userId],
  );

  if (result.rows.length === 0) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};

const updateProfile = async (userId, profileData) => {
  const {
    firstName,
    lastName,
    username,
    phone,
    bio,
    country,
    city,
    avatarUrl,
  } = profileData;

  const fields = [];
  const values = [];
  let parameterIndex = 1;

  if (firstName !== undefined) {
    if (typeof firstName !== "string") {
      const error = new Error("First name must be a string");
      error.statusCode = 400;
      throw error;
    }

    const value = firstName.trim();

    if (!value) {
      const error = new Error("First name cannot be empty");
      error.statusCode = 400;
      throw error;
    }

    fields.push(`first_name = $${parameterIndex++}`);
    values.push(value);
  }

  if (lastName !== undefined) {
    if (typeof lastName !== "string") {
      const error = new Error("Last name must be a string");
      error.statusCode = 400;
      throw error;
    }

    const value = lastName.trim();

    if (!value) {
      const error = new Error("Last name cannot be empty");
      error.statusCode = 400;
      throw error;
    }

    fields.push(`last_name = $${parameterIndex++}`);
    values.push(value);
  }

  if (username !== undefined) {
    if (typeof username !== "string") {
      const error = new Error("Username must be a string");
      error.statusCode = 400;
      throw error;
    }

    const value = username.trim();

    fields.push(`username = $${parameterIndex++}`);
    values.push(value || null);
  }

  if (phone !== undefined) {
    if (typeof phone !== "string") {
      const error = new Error("Phone must be a string");
      error.statusCode = 400;
      throw error;
    }

    fields.push(`phone = $${parameterIndex++}`);
    values.push(phone.trim() || null);
  }

  if (bio !== undefined) {
    if (typeof bio !== "string") {
      const error = new Error("Bio must be a string");
      error.statusCode = 400;
      throw error;
    }

    fields.push(`bio = $${parameterIndex++}`);
    values.push(bio.trim() || null);
  }

  if (country !== undefined) {
    if (typeof country !== "string") {
      const error = new Error("Country must be a string");
      error.statusCode = 400;
      throw error;
    }

    fields.push(`country = $${parameterIndex++}`);
    values.push(country.trim() || null);
  }

  if (city !== undefined) {
    if (typeof city !== "string") {
      const error = new Error("City must be a string");
      error.statusCode = 400;
      throw error;
    }

    fields.push(`city = $${parameterIndex++}`);
    values.push(city.trim() || null);
  }

  if (avatarUrl !== undefined) {
    if (typeof avatarUrl !== "string") {
      const error = new Error("Avatar URL must be a string");
      error.statusCode = 400;
      throw error;
    }

    fields.push(`avatar_url = $${parameterIndex++}`);
    values.push(avatarUrl.trim() || null);
  }

  if (fields.length === 0) {
    const error = new Error("No profile fields provided");
    error.statusCode = 400;
    throw error;
  }

  values.push(userId);

  const result = await pool.query(
    `
    UPDATE profiles
    SET
      ${fields.join(", ")},
      updated_at = NOW()
    WHERE user_id = $${parameterIndex}
    RETURNING *
    `,
    values,
  );

  if (result.rows.length === 0) {
    const error = new Error("Profile not found");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};

module.exports = {
  getCurrentUser,
  updateProfile,
};
