const pool = require("../config/database");
const {

  uploadImage,

  deleteImage,

} = require("./cloudinaryService");
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
const updateProfileImage = async (userId, file) => {
  const client = await pool.connect();
  let uploadedImage = null;
  let oldMedia = [];

  try {
    await client.query("BEGIN");

    const profileResult = await client.query(
      `
      SELECT avatar_url
      FROM profiles
      WHERE user_id = $1
      FOR UPDATE
      `,
      [userId],
    );

    if (profileResult.rows.length === 0) {
      const error = new Error("Profile not found");
      error.statusCode = 404;
      throw error;
    }

    const oldMediaResult = await client.query(
      `
      SELECT id, cloudinary_public_id
      FROM media
      WHERE entity_type = 'profile'
        AND entity_id = $1
      `,
      [userId],
    );

    oldMedia = oldMediaResult.rows;

    uploadedImage = await uploadImage(
      file.buffer,
      "naijafix/profiles",
    );

    await client.query(
      `
      UPDATE profiles
      SET avatar_url = $1,
          updated_at = NOW()
      WHERE user_id = $2
      `,
      [uploadedImage.url, userId],
    );

    // Remove all previous profile media records.
    await client.query(
      `
      DELETE FROM media
      WHERE entity_type = 'profile'
        AND entity_id = $1
      `,
      [userId],
    );

    const mediaResult = await client.query(
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
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING
        id,
        entity_type,
        entity_id,
        cloudinary_public_id,
        url,
        width,
        height,
        format,
        bytes,
        sort_order,
        created_at
      `,
      [
        "profile",
        userId,
        uploadedImage.publicId,
        uploadedImage.url,
        uploadedImage.width,
        uploadedImage.height,
        uploadedImage.format,
        uploadedImage.bytes,
        0,
      ],
    );

    await client.query("COMMIT");

    // Delete old Cloudinary assets only after the DB transaction succeeds.
    for (const media of oldMedia) {
      if (media.cloudinary_public_id) {
        try {
          await deleteImage(media.cloudinary_public_id);
        } catch (cleanupError) {
          console.error(
            "Failed to delete old profile image from Cloudinary:",
            cleanupError,
          );
        }
      }
    }

    return {
      profile: {
        user_id: userId,
        avatar_url: uploadedImage.url,
      },
      media: mediaResult.rows[0],
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Profile image rollback error:",
        rollbackError,
      );
    }

    if (uploadedImage?.publicId) {
      try {
        await deleteImage(uploadedImage.publicId);
      } catch (cleanupError) {
        console.error(
          "Failed to clean up uploaded profile image:",
          cleanupError,
        );
      }
    }

    throw error;
  } finally {
    client.release();
  }
};
module.exports = {
  getCurrentUser,
  updateProfile,
  updateProfileImage
};
