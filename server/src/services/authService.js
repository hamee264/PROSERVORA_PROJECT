const crypto = require("crypto");
const bcrypt = require("bcrypt");
const pool = require("../config/database");

const {
  verifyPendingRegistration,
  resendVerificationCode,
} = require("./emailVerificationService");

const {
  sendVerificationEmail,
} = require("./emailService");

const {
  generateAccessToken,
} = require("../config/jwt");

const OTP_EXPIRY_MINUTES = 10;
const PENDING_REGISTRATION_EXPIRY_HOURS = 24;

// ============================================================
// REGISTER USER
// ============================================================

const registerUser = async ({
  firstName,
  lastName,
  email,
  password,
  role,
}) => {
  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  if (
    !firstName ||
    !lastName ||
    !email ||
    !password ||
    !role
  ) {
    const error = new Error(
      "First name, last name, email, password and role are required",
    );

    error.statusCode = 400;
    throw error;
  }

  const normalizedFirstName =
    firstName.trim();

  const normalizedLastName =
    lastName.trim();

  const normalizedEmail =
    email.trim().toLowerCase();

  // ----------------------------------------------------------
  // NAME VALIDATION
  // ----------------------------------------------------------

  if (
    !normalizedFirstName ||
    !normalizedLastName
  ) {
    const error = new Error(
      "First name and last name cannot be empty",
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // EMAIL VALIDATION
  // ----------------------------------------------------------

  if (
    normalizedEmail.length > 254 ||
    !normalizedEmail.includes("@")
  ) {
    const error = new Error(
      "Please provide a valid email address",
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // ROLE VALIDATION
  // ----------------------------------------------------------

  if (
    !["customer", "provider"].includes(role)
  ) {
    const error = new Error(
      "Invalid account role",
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // PASSWORD VALIDATION
  // ----------------------------------------------------------

  if (password.length < 8) {
    const error = new Error(
      "Password must be at least 8 characters",
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // CHECK EXISTING REAL ACCOUNT
  // ----------------------------------------------------------

  const existingUser =
    await pool.query(
      `
      SELECT id
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [normalizedEmail],
    );

  if (existingUser.rows.length > 0) {
    const error = new Error(
      "An account with this email already exists",
    );

    error.statusCode = 409;
    throw error;
  }

  // ----------------------------------------------------------
  // HASH PASSWORD
  // ----------------------------------------------------------

  const passwordHash =
    await bcrypt.hash(
      password,
      12,
    );

  // ----------------------------------------------------------
  // GENERATE OTP
  // ----------------------------------------------------------

  const verificationCode =
    crypto.randomInt(
      100000,
      1000000,
    ).toString();

  const verificationCodeHash =
    crypto
      .createHash("sha256")
      .update(verificationCode)
      .digest("hex");

  // ----------------------------------------------------------
  // EXPIRATION TIMES
  // ----------------------------------------------------------

  const verificationExpiresAt =
    new Date(
      Date.now() +
      OTP_EXPIRY_MINUTES *
      60 *
      1000,
    );

  const pendingRegistrationExpiresAt =
    new Date(
      Date.now() +
      PENDING_REGISTRATION_EXPIRY_HOURS *
      60 *
      60 *
      1000,
    );

  // ----------------------------------------------------------
  // CREATE PENDING REGISTRATION
  // ----------------------------------------------------------

  const pendingClient =
    await pool.connect();

  let pendingRegistration;

  try {
    await pendingClient.query(
      "BEGIN",
    );

    // --------------------------------------------------------
    // REMOVE OLD EXPIRED REGISTRATION
    // --------------------------------------------------------

    await pendingClient.query(
      `
      DELETE FROM pending_registrations
      WHERE email = $1
      AND expires_at < NOW()
      `,
      [normalizedEmail],
    );

    // --------------------------------------------------------
    // CHECK EXISTING PENDING REGISTRATION
    // --------------------------------------------------------

    const existingPending =
      await pendingClient.query(
        `
        SELECT id
        FROM pending_registrations
        WHERE email = $1
        LIMIT 1
        `,
        [normalizedEmail],
      );

    if (
      existingPending.rows.length > 0
    ) {
      const error = new Error(
        "A verification is already pending for this email. Please check your email or request a new code.",
      );

      error.statusCode = 409;

      throw error;
    }

    // --------------------------------------------------------
    // INSERT PENDING REGISTRATION
    // --------------------------------------------------------

    const pendingResult =
      await pendingClient.query(
        `
        INSERT INTO pending_registrations (
          email,
          first_name,
          last_name,
          password_hash,
          role,
          verification_code_hash,
          verification_attempts,
          verification_expires_at,
          expires_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          0,
          $7,
          $8
        )
        RETURNING
          id,
          email,
          first_name
        `,
        [
          normalizedEmail,
          normalizedFirstName,
          normalizedLastName,
          passwordHash,
          role,
          verificationCodeHash,
          verificationExpiresAt,
          pendingRegistrationExpiresAt,
        ],
      );

    pendingRegistration =
      pendingResult.rows[0];

    await pendingClient.query(
      "COMMIT",
    );
  } catch (error) {
    await pendingClient.query(
      "ROLLBACK",
    );

    throw error;
  } finally {
    pendingClient.release();
  }

  // ----------------------------------------------------------
  // SEND VERIFICATION EMAIL
  // ----------------------------------------------------------

  try {
    await sendVerificationEmail(
      pendingRegistration.email,
      verificationCode,
      pendingRegistration.first_name,
    );
  } catch (error) {
    /*
     * Keep the pending registration.
     *
     * The user can request another code.
     */

    throw error;
  }

  // ----------------------------------------------------------
  // RETURN
  // ----------------------------------------------------------

  return {
    pending: true,
    email: pendingRegistration.email,
  };
};

// ============================================================
// LOGIN USER
// ============================================================

const loginUser = async ({
  email,
  password,
}) => {
  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  if (!email || !password) {
    const error = new Error(
      "Email and password are required",
    );

    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail =
    email.trim().toLowerCase();

  // ----------------------------------------------------------
  // FIND USER
  // ----------------------------------------------------------

  const result =
    await pool.query(
      `
      SELECT
        id,
        email,
        password_hash,
        role,
        is_email_verified,
        is_active,
        created_at
      FROM users
      WHERE email = $1
      `,
      [normalizedEmail],
    );

  // ----------------------------------------------------------
  // INVALID LOGIN
  // ----------------------------------------------------------

  if (result.rows.length === 0) {
    const error = new Error(
      "Invalid email or password",
    );

    error.statusCode = 401;
    throw error;
  }

  const user = result.rows[0];

  // ----------------------------------------------------------
  // EMAIL VERIFICATION
  // ----------------------------------------------------------

  if (!user.is_email_verified) {
    const error = new Error(
      "Please verify your email before signing in",
    );

    error.statusCode = 403;
    throw error;
  }

  // ----------------------------------------------------------
  // ACCOUNT STATUS
  // ----------------------------------------------------------

  if (!user.is_active) {
    const error = new Error(
      "Your account is inactive",
    );

    error.statusCode = 403;
    throw error;
  }

  // ----------------------------------------------------------
  // PASSWORD
  // ----------------------------------------------------------

  const passwordMatch =
    await bcrypt.compare(
      password,
      user.password_hash,
    );

  if (!passwordMatch) {
    const error = new Error(
      "Invalid email or password",
    );

    error.statusCode = 401;
    throw error;
  }

  // ----------------------------------------------------------
  // REMOVE PASSWORD HASH FROM RESPONSE
  // ----------------------------------------------------------

  delete user.password_hash;

  // ----------------------------------------------------------
  // GENERATE JWT
  // ----------------------------------------------------------

  const token =
    generateAccessToken(user);

  return {
    user,
    token,
  };
};

// ============================================================
// VERIFY EMAIL
// ============================================================

const verifyEmail = async (
  email,
  code,
) => {
  return await verifyPendingRegistration(
    email,
    code,
  );
};

// ============================================================
// RESEND VERIFICATION EMAIL
// ============================================================

const resendVerificationEmail = async (
  email,
) => {
  const result =
    await resendVerificationCode(
      email,
    );

  /*
   * Do not reveal whether a pending
   * registration exists.
   */
  if (!result) {
    return;
  }

  await sendVerificationEmail(
    result.email,
    result.code,
    result.firstName,
  );
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  registerUser,
  loginUser,
  verifyEmail,
  resendVerificationEmail,
};