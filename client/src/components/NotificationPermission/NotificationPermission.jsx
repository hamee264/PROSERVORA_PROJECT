import { useEffect, useState } from "react";
import { AlertCircle, Bell, Check, LockKeyhole } from "lucide-react";

import "./NotificationPermission.css";

const getPermission = () =>
  typeof window !== "undefined" && "Notification" in window
    ? window.Notification.permission
    : "unsupported";

function NotificationPermission() {
  const [permission, setPermission] = useState(getPermission);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleVisibilityChange = () => setPermission(getPermission());
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const requestPermission = async () => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    setError("");
    setRequesting(true);
    try {
      const nextPermission = await window.Notification.requestPermission();
      setPermission(nextPermission);
    } catch {
      setError("Your browser could not update notification permission.");
    } finally {
      setRequesting(false);
    }
  };

  const isAllowed = permission === "granted";
  const isDenied = permission === "denied";
  const isUnsupported = permission === "unsupported";

  return (
    <div className="notification-permission">
      <div className="notification-permission__icon">
        {isAllowed ? <Check size={18} /> : <Bell size={18} />}
      </div>
      <div className="notification-permission__copy">
        <strong>Browser notifications</strong>
        <p>
          {isAllowed
            ? "You will receive alerts for new bookings, payments, messages, and account updates."
            : isDenied
              ? "Notifications are blocked in your browser. Allow them from the site permissions to turn alerts back on."
              : isUnsupported
                ? "This browser does not support desktop notifications. You can still view updates in the Notifications page."
                : "Allow Proservora to show alerts when new activity arrives."}
        </p>
        {error && (
          <span className="notification-permission__error" role="alert">
            <AlertCircle size={14} />
            {error}
          </span>
        )}
      </div>
      <div className="notification-permission__action">
        {isAllowed ? (
          <span className="notification-permission__status">
            <Check size={14} /> Enabled
          </span>
        ) : isDenied ? (
          <span className="notification-permission__status notification-permission__status--muted">
            <LockKeyhole size={14} /> Blocked
          </span>
        ) : (
          <button
            type="button"
            className="notification-permission__button"
            onClick={requestPermission}
            disabled={requesting || isUnsupported}
          >
            {requesting ? "Requesting..." : "Allow notifications"}
          </button>
        )}
      </div>
    </div>
  );
}

export default NotificationPermission;
