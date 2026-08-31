const pool = require("../config/database");

// ============================================================
// CREATE NOTIFICATION
// ============================================================
//
// client:
// - Optional PostgreSQL client.
// - Pass the transaction client when notification should be
//   committed together with another database operation.
//
// ============================================================

const createNotification = async ({
  userId,
  type,
  title,
  message,
  actionUrl = null,
  client = pool,
}) => {
  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  if (!userId || !type || !title || !message) {
    const error = new Error("User, type, title and message are required");

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // CREATE NOTIFICATION
  // ----------------------------------------------------------

  const result = await client.query(
    `
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      action_url
    )

    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5
    )

    RETURNING
      id,
      user_id,
      type,
      title,
      message,
      action_url,
      is_read,
      created_at
    `,
    [userId, type, title, message, actionUrl],
  );

  return result.rows[0];
};

// ============================================================
// CREATE NOTIFICATION FOR MULTIPLE USERS
// ============================================================

const createNotificationForUsers = async ({
  userIds,
  type,
  title,
  message,
  actionUrl = null,
  client = pool,
}) => {
  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  if (!Array.isArray(userIds) || userIds.length === 0) {
    const error = new Error("At least one user is required");

    error.statusCode = 400;
    throw error;
  }

  if (!type || !title || !message) {
    const error = new Error("Type, title and message are required");

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // REMOVE DUPLICATE USER IDS
  // ----------------------------------------------------------

  const uniqueUserIds = [...new Set(userIds)];

  // ----------------------------------------------------------
  // CREATE PLACEHOLDERS
  // ----------------------------------------------------------

  const values = [];
  const placeholders = [];

  uniqueUserIds.forEach((userId, index) => {
    const offset = index * 5;

    placeholders.push(
      `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`,
    );

    values.push(userId, type, title, message, actionUrl);
  });

  // ----------------------------------------------------------
  // INSERT
  // ----------------------------------------------------------

  const result = await client.query(
    `
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      action_url
    )

    VALUES ${placeholders.join(", ")}

    RETURNING
      id,
      user_id,
      type,
      title,
      message,
      action_url,
      is_read,
      created_at
    `,
    values,
  );

  return result.rows;
};

// ============================================================
// CREATE GENERAL ADMIN ANNOUNCEMENT
// ============================================================

const createAdminAnnouncement = async ({
  title,
  message,
  actionUrl = "/dashboard",
  client = pool,
}) => {
  if (!title || !message) {
    const error = new Error("Title and message are required");

    error.statusCode = 400;
    throw error;
  }

  const result = await client.query(
    `
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      action_url
    )

    SELECT
      id,
      'admin_announcement',
      $1,
      $2,
      $3

    FROM users

    WHERE is_active = true

    RETURNING
      id,
      user_id,
      type,
      title,
      message,
      action_url,
      is_read,
      created_at
    `,
    [title, message, actionUrl],
  );

  return result.rows;
};

// ============================================================
// CREATE ADMIN NOTIFICATION FOR SINGLE USER
// ============================================================

const createAdminUserNotification = async ({
  userId,
  type = "admin_message",
  title,
  message,
  actionUrl = "/dashboard",
  client = pool,
}) => {
  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  if (!userId || !title || !message) {
    const error = new Error("User, title and message are required");

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // CHECK USER
  // ----------------------------------------------------------

  const userResult = await client.query(
    `
    SELECT
      id,
      is_active

    FROM users

    WHERE id = $1
    `,
    [userId],
  );

  if (userResult.rows.length === 0) {
    const error = new Error("User not found");

    error.statusCode = 404;
    throw error;
  }

  // ----------------------------------------------------------
  // CREATE
  // ----------------------------------------------------------

  return createNotification({
    userId,
    type,
    title,
    message,
    actionUrl,
    client,
  });
};

// ============================================================
// GET MY NOTIFICATIONS
// ============================================================

const getMyNotifications = async (userId) => {
  const result = await pool.query(
    `
    SELECT
      id,
      user_id,
      type,
      title,
      message,
      action_url,
      is_read,
      created_at

    FROM notifications

    WHERE user_id = $1

    ORDER BY created_at DESC
    `,
    [userId],
  );

  return result.rows;
};

// ============================================================
// GET MY UNREAD NOTIFICATIONS
// ============================================================

const getMyUnreadNotifications = async (userId) => {
  const result = await pool.query(
    `
    SELECT
      id,
      user_id,
      type,
      title,
      message,
      action_url,
      is_read,
      created_at

    FROM notifications

    WHERE user_id = $1
      AND is_read = false

    ORDER BY created_at DESC
    `,
    [userId],
  );

  return result.rows;
};

// ============================================================
// GET UNREAD COUNT
// ============================================================

const getUnreadCount = async (userId) => {
  const result = await pool.query(
    `
    SELECT
      COUNT(*)::INTEGER AS unread_count

    FROM notifications

    WHERE user_id = $1
      AND is_read = false
    `,
    [userId],
  );

  return result.rows[0].unread_count;
};

// ============================================================
// MARK NOTIFICATION AS READ
// ============================================================

const markAsRead = async (userId, notificationId) => {
  const result = await pool.query(
    `
    UPDATE notifications

    SET
      is_read = true

    WHERE id = $1
      AND user_id = $2
      AND is_read = false

    RETURNING
      id,
      user_id,
      type,
      title,
      message,
      action_url,
      is_read,
      created_at
    `,
    [notificationId, userId],
  );

  if (result.rows.length === 0) {
    const error = new Error("Notification not found");

    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};

// ============================================================
// MARK ALL AS READ
// ============================================================

const markAllAsRead = async (userId) => {
  const result = await pool.query(
    `
    UPDATE notifications

    SET
      is_read = true

    WHERE user_id = $1
      AND is_read = false
    `,
    [userId],
  );

  return {
    updatedCount: result.rowCount,
  };
};

// ============================================================
// DELETE NOTIFICATION
// ============================================================

const deleteNotification = async (userId, notificationId) => {
  const result = await pool.query(
    `
    DELETE FROM notifications

    WHERE id = $1
      AND user_id = $2

    RETURNING
      id,
      user_id,
      type,
      title,
      message,
      action_url,
      is_read,
      created_at
    `,
    [notificationId, userId],
  );

  if (result.rows.length === 0) {
    const error = new Error("Notification not found");

    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};

// ============================================================
// DELETE ALL READ NOTIFICATIONS
// ============================================================

const deleteReadNotifications = async (userId) => {
  const result = await pool.query(
    `
    DELETE FROM notifications

    WHERE user_id = $1
      AND is_read = true
    `,
    [userId],
  );

  return {
    deletedCount: result.rowCount,
  };
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createNotification,
  createNotificationForUsers,
  createAdminAnnouncement,
  createAdminUserNotification,

  getMyNotifications,
  getMyUnreadNotifications,
  getUnreadCount,

  markAsRead,
  markAllAsRead,

  deleteNotification,
  deleteReadNotifications,
};
