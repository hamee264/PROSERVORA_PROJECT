const crypto = require("crypto");
const bcrypt = require("bcrypt");

const pool = require("../config/database");

const RESET_CODE_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;

const generateResetCode = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

const hashResetCode = (code) => {
  return crypto.createHash("sha256").update(code).digest("hex");
};

// ============================================================
// REQUEST PASSWORD RESET
// ============================================================

const generatePasswordResetCode = async (email) => {
  if (!email) {
    const error = new Error("Email is required");
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();

  const result = await pool.query(
    `
    SELECT
      id,
      email,
      is_active
    FROM users
    WHERE email = $1
    `,
    [normalizedEmail],
  );

  /*
   * IMPORTANT:
   * We intentionally return the same response whether
   * the email exists or not.
   *
   * This prevents attackers from discovering which
   * emails have NaijaFix accounts.
   */
  if (result.rows.length === 0) {
    return null;
  }

  const user = result.rows[0];

  if (!user.is_active) {
    return null;
  }

  const code = generateResetCode();
  const codeHash = hashResetCode(code);

  const expiresAt = new Date(
    Date.now() + RESET_CODE_EXPIRY_MINUTES * 60 * 1000,
  );

  // Invalidate previous unused reset codes
  await pool.query(
    `
    UPDATE password_reset_tokens
    SET used_at = NOW()
    WHERE user_id = $1
    AND used_at IS NULL
    `,
    [user.id],
  );

  await pool.query(
    `
    INSERT INTO password_reset_tokens (
      user_id,
      code_hash,
      expires_at
    )
    VALUES ($1, $2, $3)
    `,
    [user.id, codeHash, expiresAt],
  );

  // Development only.
  // Remove this once email sending is implemented.
  return {
    userId: user.id,
    code,
  };
};

// ============================================================
// VERIFY RESET CODE
// ============================================================

const verifyPasswordResetCode = async (email, code) => {
  if (!email || !code) {
    const error = new Error("Email and reset code are required");

    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!/^\d{6}$/.test(code)) {
    const error = new Error("Reset code must be 6 digits");

    error.statusCode = 400;
    throw error;
  }

  const userResult = await pool.query(
    `
    SELECT id
    FROM users
    WHERE email = $1
    `,
    [normalizedEmail],
  );

  if (userResult.rows.length === 0) {
    const error = new Error("Invalid or expired reset code");

    error.statusCode = 400;
    throw error;
  }

  const userId = userResult.rows[0].id;

  const result = await pool.query(
    `
    SELECT
      id,
      code_hash,
      expires_at,
      attempts,
      used_at
    FROM password_reset_tokens
    WHERE user_id = $1
    AND used_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [userId],
  );

  if (result.rows.length === 0) {
    const error = new Error("Invalid or expired reset code");

    error.statusCode = 400;
    throw error;
  }

  const resetToken = result.rows[0];

  if (new Date(resetToken.expires_at) < new Date()) {
    const error = new Error("Reset code has expired");

    error.statusCode = 400;
    throw error;
  }

  if (resetToken.attempts >= MAX_ATTEMPTS) {
    const error = new Error(
      "Too many attempts. Please request a new reset code",
    );

    error.statusCode = 429;
    throw error;
  }

  const submittedHash = hashResetCode(code);

  const isValid = crypto.timingSafeEqual(
    Buffer.from(submittedHash, "hex"),
    Buffer.from(resetToken.code_hash, "hex"),
  );

  if (!isValid) {
    await pool.query(
      `
      UPDATE password_reset_tokens
      SET attempts = attempts + 1
      WHERE id = $1
      `,
      [resetToken.id],
    );

    const error = new Error("Invalid or expired reset code");

    error.statusCode = 400;
    throw error;
  }

  return {
    userId,
    resetTokenId: resetToken.id,
  };
};

// ============================================================
// RESET PASSWORD
// ============================================================

const resetPassword = async (email, code, newPassword) => {
  if (!email || !code || !newPassword) {
    const error = new Error("Email, reset code and new password are required");

    error.statusCode = 400;
    throw error;
  }

  if (newPassword.length < 8) {
    const error = new Error("Password must be at least 8 characters");

    error.statusCode = 400;
    throw error;
  }

  const { userId, resetTokenId } = await verifyPasswordResetCode(email, code);

  const passwordHash = await bcrypt.hash(newPassword, 12);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Change password
    await client.query(
      `
      UPDATE users
      SET
        password_hash = $1,
        updated_at = NOW()
      WHERE id = $2
      `,
      [passwordHash, userId],
    );

    // Invalidate the reset code
    await client.query(
      `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE id = $1
      `,
      [resetTokenId],
    );

    // Invalidate any other unused reset codes
    await client.query(
      `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE user_id = $1
      AND used_at IS NULL
      `,
      [userId],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return true;
};

module.exports = {
  generatePasswordResetCode,
  verifyPasswordResetCode,
  resetPassword,
};
