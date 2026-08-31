const pool = require("../config/database");

// ============================================================
// PROVIDER-ONLY TEST
// ============================================================

const providerTest = async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Provider authorization works",
    user: {
      id: req.user.id,
      role: req.user.role,
    },
  });
};
// ============================================================
// GET CURRENT USER
// ============================================================

const getCurrentUser = async (req, res) => {
  try {
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
        p.last_name
      FROM users u
      LEFT JOIN profiles p
        ON p.user_id = u.id
      WHERE u.id = $1
      `,
      [req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = result.rows[0];

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get current user error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve user",
    });
  }
};

module.exports = {
  getCurrentUser,
  providerTest,
};
