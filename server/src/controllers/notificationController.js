const notificationService = require("../services/notificationService");

// ============================================================
// GET MY NOTIFICATIONS
// ============================================================

const getMyNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const notifications = await notificationService.getMyNotifications(userId);

    res.status(200).json({
      success: true,
      notifications,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET UNREAD NOTIFICATION COUNT
// ============================================================

const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const unreadCount = await notificationService.getUnreadCount(userId);

    res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// MARK ONE NOTIFICATION AS READ
// ============================================================

const markAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    if (!notificationId) {
      const error = new Error("Notification ID is required");
      error.statusCode = 400;
      throw error;
    }

    const notification = await notificationService.markAsRead(
      userId,
      notificationId,
    );

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// MARK ALL NOTIFICATIONS AS READ
// ============================================================

const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await notificationService.markAllAsRead(userId);

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      updatedCount: result.updatedCount,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
