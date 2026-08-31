const bcrypt = require("bcrypt");
const pool = require("../config/database");

const {
  generateVerificationCodeForUser,
  verifyEmailCode,
  resendVerificationCode,
} = require("./emailVerificationService");

const { sendVerificationEmail } = require("./emailService");

const { generateAccessToken } = require("../config/jwt");

// ============================================================
// REGISTER USER
// ============================================================

const registerUser = async ({ firstName, lastName, email, password, role }) => {
  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  if (!firstName || !lastName || !email || !password || !role) {
    const error = new Error(
      "First name, last name, email, password and role are required",
    );

    error.statusCode = 400;
    throw error;
  }

  const normalizedFirstName = firstName.trim();
  const normalizedLastName = lastName.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedFirstName || !normalizedLastName) {
    const error = new Error("First name and last name cannot be empty");

    error.statusCode = 400;
    throw error;
  }

  if (!["customer", "provider"].includes(role)) {
    const error = new Error("Invalid account role");

    error.statusCode = 400;
    throw error;
  }

  if (password.length < 8) {
    const error = new Error("Password must be at least 8 characters");

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // CHECK EXISTING USER
  // ----------------------------------------------------------

  const existingUser = await pool.query(
    `
    SELECT id
    FROM users
    WHERE email = $1
    `,
    [normalizedEmail],
  );

  if (existingUser.rows.length > 0) {
    const error = new Error("An account with this email already exists");

    error.statusCode = 409;
    throw error;
  }

  // ----------------------------------------------------------
  // HASH PASSWORD
  // ----------------------------------------------------------

  const passwordHash = await bcrypt.hash(password, 12);

  // ----------------------------------------------------------
  // DATABASE TRANSACTION
  // ----------------------------------------------------------

  const client = await pool.connect();

  let user;

  try {
    await client.query("BEGIN");

    // --------------------------------------------------------
    // CREATE USER
    // --------------------------------------------------------

    const userResult = await client.query(
      `
      INSERT INTO users (
        email,
        password_hash,
        role
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        email,
        role,
        is_email_verified,
        is_active,
        created_at
      `,
      [normalizedEmail, passwordHash, role],
    );

    user = userResult.rows[0];

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
      VALUES ($1, $2, $3)
      `,
      [user.id, normalizedFirstName, normalizedLastName],
    );

    // --------------------------------------------------------
    // CREATE PROVIDER PROFILE
    // --------------------------------------------------------

    if (role === "provider") {
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

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  // ----------------------------------------------------------
  // GENERATE VERIFICATION CODE
  // ----------------------------------------------------------

  const verificationCode = await generateVerificationCodeForUser(user.id);

  // ----------------------------------------------------------
  // SEND VERIFICATION EMAIL
  // ----------------------------------------------------------

  await sendVerificationEmail(
    user.email,
    verificationCode,
    normalizedFirstName,
  );

  // ----------------------------------------------------------
  // RETURN USER
  // ----------------------------------------------------------

  return {
    user,
  };
};

// ============================================================
// LOGIN USER
// ============================================================

const loginUser = async ({ email, password }) => {
  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  if (!email || !password) {
    const error = new Error("Email and password are required");

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

  if (result.rows.length === 0) {
    const error = new Error("Invalid email or password");

    error.statusCode = 401;
    throw error;
  }

  const user = result.rows[0];

  // ----------------------------------------------------------
  // CHECK ACCOUNT STATUS
  // ----------------------------------------------------------

  if (!user.is_active) {
    const error = new Error("Your account is inactive");

    error.statusCode = 403;
    throw error;
  }

  // ----------------------------------------------------------
  // CHECK PASSWORD
  // ----------------------------------------------------------

  const passwordMatch = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatch) {
    const error = new Error("Invalid email or password");

    error.statusCode = 401;
    throw error;
  }

  // ----------------------------------------------------------
  // REMOVE PASSWORD HASH
  // ----------------------------------------------------------

  delete user.password_hash;

  // ----------------------------------------------------------
  // GENERATE JWT
  // ----------------------------------------------------------

  const token = generateAccessToken(user);

  return {
    user,
    token,
  };
};

// ============================================================
// VERIFY EMAIL
// ============================================================

const verifyEmail = async (email, code) => {
  return await verifyEmailCode(email, code);
};

// ============================================================
// RESEND VERIFICATION EMAIL
// ============================================================

const resendVerificationEmail = async (email) => {
  // ----------------------------------------------------------
  // GENERATE NEW CODE
  // ----------------------------------------------------------

  const result = await resendVerificationCode(email);

  /*
   * Don't reveal whether the email exists.
   */
  if (!result) {
    return;
  }

  // ----------------------------------------------------------
  // GET USER'S FIRST NAME
  // ----------------------------------------------------------

  const profileResult = await pool.query(
    `
    SELECT first_name
    FROM profiles
    WHERE user_id = (
      SELECT id
      FROM users
      WHERE email = $1
    )
    `,
    [result.email],
  );

  const firstName = profileResult.rows[0]?.first_name || "there";

  // ----------------------------------------------------------
  // SEND NEW VERIFICATION EMAIL
  // ----------------------------------------------------------

  await sendVerificationEmail(result.email, result.code, firstName);
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
