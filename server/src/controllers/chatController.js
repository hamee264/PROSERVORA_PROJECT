const chatService = require("../services/chatService");

// ============================================================
// GET OR CREATE CONVERSATION
// ============================================================

const getOrCreateConversation = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { otherUserId } = req.body;

    const conversation = await chatService.getOrCreateConversation(
      userId,
      otherUserId,
    );

    res.status(200).json({
      success: true,
      conversation,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET MY CONVERSATIONS
// ============================================================

const getMyConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const conversations = await chatService.getMyConversations(userId);

    res.status(200).json({
      success: true,
      conversations,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET CONVERSATION MESSAGES
// ============================================================

const getConversationMessages = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;

    if (!conversationId) {
      const error = new Error("Conversation ID is required");
      error.statusCode = 400;
      throw error;
    }

    const messages = await chatService.getConversationMessages(
      conversationId,
      userId,
    );

    res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// SEND MESSAGE
// ============================================================

const sendMessage = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { message } = req.body;

    if (!conversationId) {
      const error = new Error("Conversation ID is required");
      error.statusCode = 400;
      throw error;
    }

    if (!message) {
      const error = new Error("Message is required");
      error.statusCode = 400;
      throw error;
    }

    const newMessage = await chatService.sendMessage(
      conversationId,
      userId,
      message,
    );

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: newMessage,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// MARK CONVERSATION AS READ
// ============================================================

const markConversationAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;

    if (!conversationId) {
      const error = new Error("Conversation ID is required");
      error.statusCode = 400;
      throw error;
    }

    const result = await chatService.markConversationAsRead(
      conversationId,
      userId,
    );

    res.status(200).json({
      success: true,
      message: "Messages marked as read",
      updatedCount: result.updatedCount,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOrCreateConversation,
  getMyConversations,
  getConversationMessages,
  sendMessage,
  markConversationAsRead,
};
