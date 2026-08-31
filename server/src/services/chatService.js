const pool = require("../config/database");
const { createNotification } = require("./notificationService");

// ============================================================
// GET OR CREATE CONVERSATION
// ============================================================

const getOrCreateConversation = async (userId, otherUserId) => {
  if (!otherUserId) {
    const error = new Error("Other user ID is required");
    error.statusCode = 400;
    throw error;
  }

  if (userId === otherUserId) {
    const error = new Error("You cannot start a conversation with yourself");
    error.statusCode = 400;
    throw error;
  }

  // Check the other user exists
  const userResult = await pool.query(
    `
    SELECT id
    FROM users
    WHERE id = $1
      AND is_active = true
    `,
    [otherUserId],
  );

  if (userResult.rows.length === 0) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  // Find existing conversation
  const existingResult = await pool.query(
    `
    SELECT
      id,
      customer_id,
      provider_id,
      created_at
    FROM conversations
    WHERE
      (customer_id = $1 AND provider_id = $2)
      OR
      (customer_id = $2 AND provider_id = $1)
    LIMIT 1
    `,
    [userId, otherUserId],
  );

  if (existingResult.rows.length > 0) {
    return existingResult.rows[0];
  }

  // Determine customer/provider
  const rolesResult = await pool.query(
    `
    SELECT id, role
    FROM users
    WHERE id IN ($1, $2)
    `,
    [userId, otherUserId],
  );

  const currentUser = rolesResult.rows.find((user) => user.id === userId);
  const otherUser = rolesResult.rows.find((user) => user.id === otherUserId);

  if (!currentUser || !otherUser) {
    const error = new Error("Unable to determine conversation participants");
    error.statusCode = 400;
    throw error;
  }

  let customerId;
  let providerId;

  if (currentUser.role === "customer" && otherUser.role === "provider") {
    customerId = userId;
    providerId = otherUserId;
  } else if (currentUser.role === "provider" && otherUser.role === "customer") {
    customerId = otherUserId;
    providerId = userId;
  } else {
    const error = new Error(
      "Conversations can only be between a customer and a provider",
    );

    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
    INSERT INTO conversations (
      customer_id,
      provider_id
    )
    VALUES ($1, $2)
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
  const result = await pool.query(
    `
    SELECT
      c.id,
      c.customer_id,
      c.provider_id,
      c.created_at,

      customer_profile.first_name AS customer_first_name,
      customer_profile.last_name AS customer_last_name,
      customer_profile.avatar_url AS customer_avatar_url,

      provider_profile.first_name AS provider_first_name,
      provider_profile.last_name AS provider_last_name,
      provider_profile.avatar_url AS provider_avatar_url,

      latest_message.message AS latest_message,
      latest_message.created_at AS latest_message_at,
      latest_message.sender_id AS latest_message_sender_id

    FROM conversations c

    INNER JOIN profiles customer_profile
      ON customer_profile.user_id = c.customer_id

    INNER JOIN profiles provider_profile
      ON provider_profile.user_id = c.provider_id

    LEFT JOIN LATERAL (
      SELECT
        message,
        created_at,
        sender_id
      FROM messages
      WHERE conversation_id = c.id
      ORDER BY created_at DESC
      LIMIT 1
    ) latest_message ON true

    WHERE
      c.customer_id = $1
      OR c.provider_id = $1

    ORDER BY
      latest_message.created_at DESC NULLS LAST,
      c.created_at DESC
    `,
    [userId],
  );

  return result.rows;
};

// ============================================================
// CHECK CONVERSATION ACCESS
// ============================================================

const getConversationForUser = async (conversationId, userId) => {
  const result = await pool.query(
    `
    SELECT
      id,
      customer_id,
      provider_id,
      created_at
    FROM conversations
    WHERE id = $1
      AND (
        customer_id = $2
        OR provider_id = $2
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
// GET CONVERSATION MESSAGES
// ============================================================

const getConversationMessages = async (conversationId, userId) => {
  await getConversationForUser(conversationId, userId);

  const result = await pool.query(
    `
    SELECT
      m.id,
      m.conversation_id,
      m.sender_id,
      m.message,
      m.is_read,
      m.created_at,

      p.first_name,
      p.last_name,
      p.avatar_url

    FROM messages m

    INNER JOIN profiles p
      ON p.user_id = m.sender_id

    WHERE m.conversation_id = $1

    ORDER BY m.created_at ASC
    `,
    [conversationId],
  );

  return result.rows;
};

// ============================================================
// SEND MESSAGE
// ============================================================

const sendMessage = async (conversationId, senderId, message) => {
  const cleanMessage = String(message || "").trim();

  if (!cleanMessage) {
    const error = new Error("Message cannot be empty");
    error.statusCode = 400;
    throw error;
  }

  if (cleanMessage.length > 5000) {
    const error = new Error("Message cannot exceed 5000 characters");
    error.statusCode = 400;
    throw error;
  }

  const conversation = await getConversationForUser(conversationId, senderId);

  const receiverId =
    conversation.customer_id === senderId
      ? conversation.provider_id
      : conversation.customer_id;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Create message
    const messageResult = await client.query(
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
      [conversationId, senderId, cleanMessage],
    );

    const newMessage = messageResult.rows[0];

    // --------------------------------------------------------
    // NEW MESSAGE NOTIFICATION
    // --------------------------------------------------------
    //
    // For now we notify the receiver whenever a message is sent.
    //
    // We are NOT adding complicated online/presence tracking yet.
    //
    // The frontend can later suppress/handle this when the
    // receiver is actively viewing the conversation.
    //

    // Get sender's name for the notification
    const senderResult = await client.query(
      `
  SELECT
    first_name,
    last_name
  FROM profiles
  WHERE user_id = $1
  `,
      [senderId],
    );

    const sender = senderResult.rows[0];

    const senderName = sender
      ? `${sender.first_name} ${sender.last_name}`.trim()
      : "Someone";

    await createNotification({
      userId: receiverId,
      type: "new_message",
      title: "New message",
      message: `You have a new message from ${senderName}`,
      actionUrl: `/messages/${conversationId}`,
      client,
    });

    await client.query("COMMIT");

    return newMessage;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Message rollback error:", rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// MARK CONVERSATION AS READ
// ============================================================

const markConversationAsRead = async (conversationId, userId) => {
  await getConversationForUser(conversationId, userId);

  const result = await pool.query(
    `
    UPDATE messages

    SET is_read = true

    WHERE conversation_id = $1
      AND sender_id != $2
      AND is_read = false
    `,
    [conversationId, userId],
  );

  return {
    updatedCount: result.rowCount,
  };
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  getOrCreateConversation,
  getMyConversations,
  getConversationForUser,
  getConversationMessages,
  sendMessage,
  markConversationAsRead,
};
