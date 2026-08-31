const express = require("express");

const {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} = require("../controllers/notificationController");

const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// GET MY NOTIFICATIONS
// ============================================================

router.get("/", authenticate, getMyNotifications);

// ============================================================
// GET UNREAD COUNT
// ============================================================

router.get("/unread-count", authenticate, getUnreadCount);

// ============================================================
// MARK ALL AS READ
// ============================================================

router.patch("/read-all", authenticate, markAllAsRead);

// ============================================================
// MARK ONE AS READ
// ============================================================

router.patch("/:notificationId/read", authenticate, markAsRead);

module.exports = router;
