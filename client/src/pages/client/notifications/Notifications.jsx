import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Bell,
  BriefcaseBusiness,
  CheckCheck,
  CircleDollarSign,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";

import {
  getMyNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../../../services/notificationService";

import "./Notifications.css";

const filters = [
  { label: "All notifications", value: "all" },
  { label: "Unread", value: "unread" },
];

const getNotificationIcon = (type = "") => {
  if (type.includes("message")) return MessageCircle;
  if (type.includes("payment") || type.includes("payout")) {
    return CircleDollarSign;
  }
  if (type.includes("booking") || type.includes("opportunity")) {
    return BriefcaseBusiness;
  }
  if (type.includes("verification") || type.includes("security")) {
    return ShieldCheck;
  }
  return Bell;
};

const getDateGroup = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

const formatTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  }).format(date);
};

const getActionPath = (actionUrl, role) => {
  if (!actionUrl) return "";
  const basePath = role === "provider" ? "/provider" : "/client";
  if (actionUrl.startsWith("/bookings")) return `${basePath}/bookings`;
  if (actionUrl.startsWith("/messages")) return `${basePath}/messages`;
  if (actionUrl.startsWith("/payments")) {
    return role === "provider" ? "/provider/earnings" : "/client/payments";
  }
  if (actionUrl.startsWith("/services")) return `${basePath}/services`;
  if (actionUrl === "/dashboard" || actionUrl.startsWith("/dashboard/")) {
    return `${basePath}/dashboard`;
  }
  if (actionUrl.startsWith(basePath)) return actionUrl;
  return "";
};

function Notifications({ role = "client" }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadNotifications = async () => {
      try {
        const data = await getMyNotifications();
        if (active) setNotifications(data?.notifications || []);
      } catch (loadError) {
        if (active) {
          setError(
            loadError.response?.data?.message ||
              "Unable to load your notifications. Please try again.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadNotifications();
    return () => {
      active = false;
    };
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications],
  );

  const visibleNotifications = useMemo(
    () =>
      notifications.filter(
        (notification) => activeFilter === "all" || !notification.is_read,
      ),
    [activeFilter, notifications],
  );

  const groupedNotifications = useMemo(() => {
    const groups = new Map();

    for (const notification of visibleNotifications) {
      const group = getDateGroup(notification.created_at);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(notification);
    }

    return [...groups.entries()];
  }, [visibleNotifications]);

  const handleOpenNotification = async (notification) => {
    setError("");
    const destination = getActionPath(notification.action_url, role);

    if (!notification.is_read) {
      try {
        await markNotificationAsRead(notification.id);
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id ? { ...item, is_read: true } : item,
          ),
        );
      } catch (readError) {
        setError(
          readError.response?.data?.message ||
            "Unable to mark this notification as read.",
        );
        return;
      }
    }

    if (destination) navigate(destination);
  };

  const handleMarkAllAsRead = async () => {
    if (!unreadCount || updating) return;

    setError("");

    try {
      setUpdating(true);
      await markAllNotificationsAsRead();
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, is_read: true })),
      );
    } catch (readError) {
      setError(
        readError.response?.data?.message ||
          "Unable to mark all notifications as read.",
      );
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="client-notifications">
      <header className="client-notifications__header">
        <div>
          <span className="client-notifications__eyebrow">
            {role === "provider" ? "PROVIDER WORKSPACE" : "YOUR WORKSPACE"}
          </span>
          <h1>Notifications</h1>
          <p>
            {role === "provider"
              ? "Updates about your applications, jobs, payments, and clients."
              : "Updates about your requests, bookings, and messages."}
          </p>
        </div>
        <button
          type="button"
          className="client-notifications__mark-all"
          onClick={handleMarkAllAsRead}
          disabled={!unreadCount || updating}
        >
          <CheckCheck size={16} />
          <span>{updating ? "Updating..." : "Mark all as read"}</span>
        </button>
      </header>

      <div className="client-notifications__toolbar">
        <div
          className="client-notifications__filters"
          role="tablist"
          aria-label="Filter notifications"
        >
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              role="tab"
              aria-selected={activeFilter === filter.value}
              className={
                activeFilter === filter.value
                  ? "client-notifications__filter is-active"
                  : "client-notifications__filter"
              }
              onClick={() => setActiveFilter(filter.value)}
            >
              {filter.label}
              {filter.value === "unread" && <span>{unreadCount}</span>}
            </button>
          ))}
        </div>
        <span className="client-notifications__total">
          {notifications.length} total
        </span>
      </div>

      {error && (
        <p className="client-notifications__error" role="alert">
          <AlertCircle size={17} />
          {error}
        </p>
      )}

      {loading ? (
        <div className="client-notifications__state" role="status">
          Loading notifications...
        </div>
      ) : groupedNotifications.length > 0 ? (
        <div className="client-notifications__groups">
          {groupedNotifications.map(([group, items]) => (
            <section className="client-notifications__group" key={group}>
              <h2>{group}</h2>
              <div className="client-notifications__list">
                {items.map((notification) => {
                  const Icon = getNotificationIcon(notification.type);

                  return (
                    <button
                      type="button"
                      key={notification.id}
                      className={`client-notifications__item ${
                        notification.is_read ? "is-read" : "is-unread"
                      }`}
                      onClick={() => handleOpenNotification(notification)}
                    >
                      <span
                        className={`client-notifications__icon client-notifications__icon--${notification.type}`}
                      >
                        <Icon size={18} strokeWidth={1.7} />
                      </span>
                      <span className="client-notifications__copy">
                        <span className="client-notifications__item-title">
                          {notification.title}
                          {!notification.is_read && (
                            <span className="client-notifications__unread-dot" />
                          )}
                        </span>
                        <span className="client-notifications__message">
                          {notification.message}
                        </span>
                      </span>
                      <time>{formatTime(notification.created_at)}</time>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="client-notifications__empty">
          <span className="client-notifications__empty-icon">
            <Bell size={23} strokeWidth={1.6} />
          </span>
          <h2>
            {activeFilter === "unread"
              ? "You’re all caught up"
              : "No notifications yet"}
          </h2>
          <p>
            {activeFilter === "unread"
              ? "Unread updates will appear here."
              : "Important updates about your activity will appear here."}
          </p>
        </div>
      )}
    </div>
  );
}

export default Notifications;
