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
  return crypto
    .createHash("sha256")
    .update(code)
    .digest("hex");
};

// ============================================================
// GENERATE CODE FOR PENDING REGISTRATION
// ============================================================

const generateVerificationCodeForPendingRegistration = async (
  pendingRegistrationId,
) => {
  const code = generateVerificationCode();

  const codeHash = hashVerificationCode(code);

  const expiresAt = new Date(
    Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
  );

  const result = await pool.query(
    `
    UPDATE pending_registrations
    SET
      verification_code_hash = $1,
      verification_attempts = 0,
      verification_expires_at = $2,
      updated_at = NOW()
    WHERE id = $3
    RETURNING
      id,
      email,
      first_name
    `,
    [codeHash, expiresAt, pendingRegistrationId],
  );

  if (result.rows.length === 0) {
    const error = new Error(
      "Pending registration not found",
    );

    error.statusCode = 404;
    throw error;
  }

  return {
    code,
    email: result.rows[0].email,
    firstName: result.rows[0].first_name,
  };
};

// ============================================================
// VERIFY PENDING REGISTRATION
// ============================================================

const verifyPendingRegistration = async (
  email,
  code,
) => {
  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  if (!email) {
    const error = new Error("Email is required");

    error.statusCode = 400;
    throw error;
  }

  if (!code) {
    const error = new Error(
      "Verification code is required",
    );

    error.statusCode = 400;
    throw error;
  }

  if (!/^\d{6}$/.test(code)) {
    const error = new Error(
      "Verification code must be 6 digits",
    );

    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email
    .trim()
    .toLowerCase();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // --------------------------------------------------------
    // GET + LOCK PENDING REGISTRATION
    // --------------------------------------------------------

    const pendingResult = await client.query(
      `
      SELECT
        id,
        email,
        first_name,
        last_name,
        password_hash,
        role,
        verification_code_hash,
        verification_attempts,
        verification_expires_at,
        expires_at
      FROM pending_registrations
      WHERE email = $1
      FOR UPDATE
      `,
      [normalizedEmail],
    );

    if (pendingResult.rows.length === 0) {
      const error = new Error(
        "Invalid or expired verification request",
      );

      error.statusCode = 400;
      throw error;
    }

    const pending = pendingResult.rows[0];

    // --------------------------------------------------------
    // CHECK REGISTRATION EXPIRATION
    // --------------------------------------------------------

    if (
      !pending.expires_at ||
      new Date(pending.expires_at) < new Date()
    ) {
      await client.query(
        `
        DELETE FROM pending_registrations
        WHERE id = $1
        `,
        [pending.id],
      );

      const error = new Error(
        "Registration has expired. Please sign up again.",
      );

      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------------
    // CHECK OTP EXISTS
    // --------------------------------------------------------

    if (!pending.verification_code_hash) {
      const error = new Error(
        "No active verification code found",
      );

      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------------
    // CHECK OTP EXPIRATION
    // --------------------------------------------------------

    if (
      !pending.verification_expires_at ||
      new Date(pending.verification_expires_at) <
      new Date()
    ) {
      const error = new Error(
        "Verification code has expired",
      );

      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------------
    // CHECK MAX ATTEMPTS
    // --------------------------------------------------------

    if (
      pending.verification_attempts >= MAX_ATTEMPTS
    ) {
      const error = new Error(
        "Too many verification attempts. Please request a new code.",
      );

      error.statusCode = 429;
      throw error;
    }

    // --------------------------------------------------------
    // HASH SUBMITTED OTP
    // --------------------------------------------------------

    const submittedHash =
      hashVerificationCode(code);

    const storedHash = Buffer.from(
      pending.verification_code_hash,
      "hex",
    );

    const submittedHashBuffer =
      Buffer.from(
        submittedHash,
        "hex",
      );

    // --------------------------------------------------------
    // COMPARE OTP
    // --------------------------------------------------------

    const isValid =
      storedHash.length ===
      submittedHashBuffer.length &&
      crypto.timingSafeEqual(
        submittedHashBuffer,
        storedHash,
      );

    // --------------------------------------------------------
    // INVALID OTP
    // --------------------------------------------------------

    if (!isValid) {
      await client.query(
        `
        UPDATE pending_registrations
        SET
          verification_attempts =
            verification_attempts + 1,
          updated_at = NOW()
        WHERE id = $1
        `,
        [pending.id],
      );

      const error = new Error(
        "Invalid verification code",
      );

      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------------
    // CHECK WHETHER USER ALREADY EXISTS
    // --------------------------------------------------------

    const existingUserResult =
      await client.query(
        `
        SELECT id
        FROM users
        WHERE email = $1
        LIMIT 1
        `,
        [normalizedEmail],
      );

    if (existingUserResult.rows.length > 0) {
      const error = new Error(
        "An account with this email already exists",
      );

      error.statusCode = 409;
      throw error;
    }

    // --------------------------------------------------------
    // CREATE ACTUAL USER
    // --------------------------------------------------------

    const userResult = await client.query(
      `
      INSERT INTO users (
        email,
        password_hash,
        role,
        is_email_verified,
        is_active
      )
      VALUES (
        $1,
        $2,
        $3,
        true,
        true
      )
      RETURNING
        id,
        email,
        role,
        is_email_verified,
        is_active,
        created_at,
        updated_at
      `,
      [
        pending.email,
        pending.password_hash,
        pending.role,
      ],
    );

    const user = userResult.rows[0];

    // --------------------------------------------------------
    // CREATE PROFILE
    // --------------------------------------------------------

    await client.query(
      `
      INSERT INTO profiles (
        user_id,
        first_name,
        last_name
      )
      VALUES (
        $1,
        $2,
        $3
      )
      `,
      [
        user.id,
        pending.first_name,
        pending.last_name,
      ],
    );

    // --------------------------------------------------------
    // CREATE PROVIDER PROFILE
    // --------------------------------------------------------

    if (pending.role === "provider") {
      await client.query(
        `
        INSERT INTO provider_profiles (
          user_id
        )
        VALUES ($1)
        `,
        [user.id],
      );
    }

    // --------------------------------------------------------
    // DELETE PENDING REGISTRATION
    // --------------------------------------------------------

    await client.query(
      `
      DELETE FROM pending_registrations
      WHERE id = $1
      `,
      [pending.id],
    );

    // --------------------------------------------------------
    // COMMIT
    // --------------------------------------------------------

    await client.query("COMMIT");

    return {
      user,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// RESEND VERIFICATION CODE
// ============================================================

const resendVerificationCode = async (
  email,
) => {
  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  if (!email) {
    const error = new Error(
      "Email is required",
    );

    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email
    .trim()
    .toLowerCase();

  // ----------------------------------------------------------
  // FIND PENDING REGISTRATION
  // ----------------------------------------------------------

  const result = await pool.query(
    `
    SELECT
      id,
      email,
      first_name,
      expires_at
    FROM pending_registrations
    WHERE email = $1
    LIMIT 1
    `,
    [normalizedEmail],
  );

  // Do not reveal whether a pending registration exists.
  if (result.rows.length === 0) {
    return null;
  }

  const pending = result.rows[0];

  // ----------------------------------------------------------
  // REMOVE EXPIRED REGISTRATION
  // ----------------------------------------------------------

  if (
    !pending.expires_at ||
    new Date(pending.expires_at) < new Date()
  ) {
    await pool.query(
      `
      DELETE FROM pending_registrations
      WHERE id = $1
      `,
      [pending.id],
    );

    return null;
  }

  // ----------------------------------------------------------
  // GENERATE NEW OTP
  // ----------------------------------------------------------

  return await generateVerificationCodeForPendingRegistration(
    pending.id,
  );
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  generateVerificationCode,
  hashVerificationCode,
  generateVerificationCodeForPendingRegistration,
  verifyPendingRegistration,
  resendVerificationCode,
};