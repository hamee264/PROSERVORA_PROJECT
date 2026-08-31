const express = require("express");

const {
  getOrCreateConversation,
  getMyConversations,
  getConversationMessages,
  sendMessage,
  markConversationAsRead,
} = require("../controllers/chatController");

const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// ALL CHAT ROUTES REQUIRE AUTHENTICATION
// ============================================================

// Get existing conversation or create a new one
router.post("/", authenticate, getOrCreateConversation);

// Get my conversations
router.get("/", authenticate, getMyConversations);

// Get messages in a conversation
router.get("/:conversationId/messages", authenticate, getConversationMessages);

// Send a message
router.post("/:conversationId/messages", authenticate, sendMessage);

// Mark messages in a conversation as read
router.patch("/:conversationId/read", authenticate, markConversationAsRead);

module.exports = router;
