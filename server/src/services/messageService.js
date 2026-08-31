const pool = require("../config/database");

// ============================================================
// CREATE OR GET CONVERSATION
// ============================================================

const getOrCreateConversation = async (customerId, providerId) => {
  if (!customerId || !providerId) {
    const error = new Error("Customer and provider are required");
    error.statusCode = 400;
    throw error;
  }

  if (customerId === providerId) {
    const error = new Error("You cannot create a conversation with yourself");
    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // VERIFY CUSTOMER
  // ----------------------------------------------------------

  const customerResult = await pool.query(
    `
    SELECT id, role
    FROM users
    WHERE id = $1
    `,
    [customerId],
  );

  if (customerResult.rows.length === 0) {
    const error = new Error("Customer not found");
    error.statusCode = 404;
    throw error;
  }

  if (customerResult.rows[0].role !== "customer") {
    const error = new Error("Invalid customer account");
    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // VERIFY PROVIDER
  // ----------------------------------------------------------

  const providerResult = await pool.query(
    `
    SELECT id, role
    FROM users
    WHERE id = $1
    `,
    [providerId],
  );

  if (providerResult.rows.length === 0) {
    const error = new Error("Provider not found");
    error.statusCode = 404;
    throw error;
  }

  if (providerResult.rows[0].role !== "provider") {
    const error = new Error("Invalid provider account");
    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // GET OR CREATE
  // ----------------------------------------------------------

  const result = await pool.query(
    `
    INSERT INTO conversations (
      customer_id,
      provider_id
    )

    VALUES ($1, $2)

    ON CONFLICT (customer_id, provider_id)

    DO UPDATE SET
      customer_id = EXCLUDED.customer_id

    RETURNING
      id,
      customer_id,
      provider_id,
      created_at
    `,
    [customerId, providerId],
  );

  return result.rows[0];
};

// ============================================================
// GET MY CONVERSATIONS
// ============================================================

const getMyConversations = async (userId) => {
  if (!userId) {
    const error = new Error("User ID is required");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
    SELECT
      c.id,
      c.customer_id,
      c.provider_id,
      c.created_at,

      CASE
        WHEN c.customer_id = $1
        THEN provider_profile.full_name

        ELSE customer_profile.full_name
      END AS other_user_name,

      CASE
        WHEN c.customer_id = $1
        THEN c.provider_id

        ELSE c.customer_id
      END AS other_user_id,

      (
        SELECT m.message
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) AS last_message,

      (
        SELECT m.created_at
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) AS last_message_at,

      (
        SELECT COUNT(*)
        FROM messages m
        WHERE m.conversation_id = c.id
          AND m.sender_id != $1
          AND m.is_read = false
      ) AS unread_count

    FROM conversations c

    LEFT JOIN profiles customer_profile
      ON customer_profile.user_id = c.customer_id

    LEFT JOIN profiles provider_profile
      ON provider_profile.user_id = c.provider_id

    WHERE
      c.customer_id = $1
      OR c.provider_id = $1

    ORDER BY
      COALESCE(
        (
          SELECT m.created_at
          FROM messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ),
        c.created_at
      ) DESC
    `,
    [userId],
  );

  return result.rows;
};

// ============================================================
// GET CONVERSATION
// ============================================================

const getConversationById = async (userId, conversationId) => {
  if (!userId || !conversationId) {
    const error = new Error("User ID and conversation ID are required");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
    SELECT
      c.id,
      c.customer_id,
      c.provider_id,
      c.created_at

    FROM conversations c

    WHERE c.id = $1

      AND (
        c.customer_id = $2
        OR c.provider_id = $2
      )
    `,
    [conversationId, userId],
  );

  if (result.rows.length === 0) {
    const error = new Error("Conversation not found");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};

// ============================================================
// GET MESSAGES
// ============================================================

const getMessages = async (userId, conversationId) => {
  await getConversationById(userId, conversationId);

  const result = await pool.query(
    `
    SELECT
      id,
      conversation_id,
      sender_id,
      message,
      is_read,
      created_at

    FROM messages

    WHERE conversation_id = $1

    ORDER BY created_at ASC
    `,
    [conversationId],
  );

  return result.rows;
};

// ============================================================
// SEND MESSAGE
// ============================================================

const sendMessage = async (userId, conversationId, message) => {
  if (!userId || !conversationId) {
    const error = new Error("User ID and conversation ID are required");

    error.statusCode = 400;
    throw error;
  }

  if (typeof message !== "string" || !message.trim()) {
    const error = new Error("Message is required");
    error.statusCode = 400;
    throw error;
  }

  const cleanMessage = message.trim();

  if (cleanMessage.length > 5000) {
    const error = new Error("Message cannot exceed 5000 characters");
    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // VERIFY USER BELONGS TO CONVERSATION
  // ----------------------------------------------------------

  await getConversationById(userId, conversationId);

  // ----------------------------------------------------------
  // CREATE MESSAGE
  // ----------------------------------------------------------

  const result = await pool.query(
    `
    INSERT INTO messages (
      conversation_id,
      sender_id,
      message
    )

    VALUES ($1, $2, $3)

    RETURNING
      id,
      conversation_id,
      sender_id,
      message,
      is_read,
      created_at
    `,
    [conversationId, userId, cleanMessage],
  );

  return result.rows[0];
};

// ============================================================
// MARK CONVERSATION MESSAGES AS READ
// ============================================================

const markMessagesAsRead = async (userId, conversationId) => {
  await getConversationById(userId, conversationId);

  const result = await pool.query(
    `
    UPDATE messages

    SET is_read = true

    WHERE conversation_id = $1

      AND sender_id != $2

      AND is_read = false

    RETURNING id
    `,
    [conversationId, userId],
  );

  return {
    updatedCount: result.rowCount,
  };
};

// ============================================================
// GET UNREAD MESSAGE COUNT
// ============================================================

const getUnreadCount = async (userId) => {
  if (!userId) {
    const error = new Error("User ID is required");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
    SELECT COUNT(*) AS unread_count

    FROM messages m

    INNER JOIN conversations c
      ON c.id = m.conversation_id

    WHERE
      (
        c.customer_id = $1
        OR c.provider_id = $1
      )

      AND m.sender_id != $1

      AND m.is_read = false
    `,
    [userId],
  );

  return Number(result.rows[0].unread_count);
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  getOrCreateConversation,
  getMyConversations,
  getConversationById,
  getMessages,
  sendMessage,
  markMessagesAsRead,
  getUnreadCount,
};
