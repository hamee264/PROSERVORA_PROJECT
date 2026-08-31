const crypto = require("crypto");
const pool = require("../config/database");

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;

// ============================================================
// GENERATE OTP
// ============================================================

const generateVerificationCode = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

// ============================================================
// HASH OTP
// ============================================================

const hashVerificationCode = (code) => {
  return crypto.createHash("sha256").update(code).digest("hex");
};

// ============================================================
// GENERATE VERIFICATION CODE FOR USER
// ============================================================

const generateVerificationCodeForUser = async (userId) => {
  const code = generateVerificationCode();

  const codeHash = hashVerificationCode(code);

  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Remove previous unused verification codes
  await pool.query(
    `
    DELETE FROM email_verification_tokens
    WHERE user_id = $1
    AND used_at IS NULL
    `,
    [userId],
  );

  await pool.query(
    `
    INSERT INTO email_verification_tokens (
      user_id,
      code_hash,
      expires_at
    )
    VALUES ($1, $2, $3)
    `,
    [userId, codeHash, expiresAt],
  );

  return code;
};

// ============================================================
// VERIFY EMAIL CODE
// ============================================================

const verifyEmailCode = async (email, code) => {
  // ----------------------------------------------------------
  // VALIDATE EMAIL
  // ----------------------------------------------------------

  if (!email) {
    const error = new Error("Email is required");
    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // VALIDATE CODE
  // ----------------------------------------------------------

  if (!code) {
    const error = new Error("Verification code is required");
    error.statusCode = 400;
    throw error;
  }

  if (!/^\d{6}$/.test(code)) {
    const error = new Error("Verification code must be 6 digits");

    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();

  // ----------------------------------------------------------
  // FIND USER
  // ----------------------------------------------------------

  const userResult = await pool.query(
    `
    SELECT
      id,
      is_email_verified
    FROM users
    WHERE email = $1
    `,
    [normalizedEmail],
  );

  if (userResult.rows.length === 0) {
    const error = new Error("Invalid verification request");

    error.statusCode = 400;
    throw error;
  }

  const user = userResult.rows[0];

  // ----------------------------------------------------------
  // CHECK ALREADY VERIFIED
  // ----------------------------------------------------------

  if (user.is_email_verified) {
    const error = new Error("Email is already verified");

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // FIND ACTIVE OTP
  // ----------------------------------------------------------

  const result = await pool.query(
    `
    SELECT
      id,
      code_hash,
      expires_at,
      attempts,
      used_at
    FROM email_verification_tokens
    WHERE user_id = $1
    AND used_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [user.id],
  );

  if (result.rows.length === 0) {
    const error = new Error("No active verification code found");

    error.statusCode = 400;
    throw error;
  }

  const verification = result.rows[0];

  // ----------------------------------------------------------
  // CHECK EXPIRATION
  // ----------------------------------------------------------

  if (new Date(verification.expires_at) < new Date()) {
    const error = new Error("Verification code has expired");

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // CHECK MAXIMUM ATTEMPTS
  // ----------------------------------------------------------

  if (verification.attempts >= MAX_ATTEMPTS) {
    const error = new Error(
      "Too many verification attempts. Please request a new code",
    );

    error.statusCode = 429;
    throw error;
  }

  // ----------------------------------------------------------
  // HASH SUBMITTED CODE
  // ----------------------------------------------------------

  const submittedHash = hashVerificationCode(code);

  // ----------------------------------------------------------
  // COMPARE HASHES
  // ----------------------------------------------------------

  const storedHash = Buffer.from(verification.code_hash, "hex");

  const submittedHashBuffer = Buffer.from(submittedHash, "hex");

  const isValid = crypto.timingSafeEqual(submittedHashBuffer, storedHash);

  // ----------------------------------------------------------
  // INVALID CODE
  // ----------------------------------------------------------

  if (!isValid) {
    await pool.query(
      `
      UPDATE email_verification_tokens
      SET attempts = attempts + 1
      WHERE id = $1
      `,
      [verification.id],
    );

    const error = new Error("Invalid verification code");

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // MARK OTP AS USED
  // ----------------------------------------------------------

  await pool.query(
    `
    UPDATE email_verification_tokens
    SET used_at = NOW()
    WHERE id = $1
    `,
    [verification.id],
  );

  // ----------------------------------------------------------
  // VERIFY USER EMAIL
  // ----------------------------------------------------------

  await pool.query(
    `
    UPDATE users
    SET is_email_verified = true
    WHERE id = $1
    `,
    [user.id],
  );

  return true;
};

// ============================================================
// RESEND VERIFICATION CODE
// ============================================================

const resendVerificationCode = async (email) => {
  // ----------------------------------------------------------
  // VALIDATE EMAIL
  // ----------------------------------------------------------

  if (!email) {
    const error = new Error("Email is required");

    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();

  // ----------------------------------------------------------
  // FIND USER
  // ----------------------------------------------------------

  const result = await pool.query(
    `
    SELECT
      id,
      email,
      is_email_verified
    FROM users
    WHERE email = $1
    `,
    [normalizedEmail],
  );

  /*
   * Don't reveal whether an account exists.
   */
  if (result.rows.length === 0) {
    return null;
  }

  const user = result.rows[0];

  // ----------------------------------------------------------
  // CHECK IF ALREADY VERIFIED
  // ----------------------------------------------------------

  if (user.is_email_verified) {
    return null;
  }

  // ----------------------------------------------------------
  // GENERATE NEW CODE
  // ----------------------------------------------------------

  const code = await generateVerificationCodeForUser(user.id);

  return {
    email: user.email,
    code,
  };
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  generateVerificationCodeForUser,
  verifyEmailCode,
  resendVerificationCode,
};
