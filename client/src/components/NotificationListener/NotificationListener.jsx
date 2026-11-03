import { useEffect, useRef } from "react";

import { getMyNotifications } from "../../services/notificationService";

const POLL_INTERVAL = 15000;

function showBrowserNotification(notification) {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    window.Notification.permission !== "granted"
  ) {
    return;
  }

  const browserNotification = new window.Notification(notification.title, {
    body: notification.message,
    tag: `proservora-${notification.id}`,
  });

  browserNotification.onclick = () => {
    window.focus();
    browserNotification.close();
  };
}

function NotificationListener() {
  const knownIds = useRef(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const data = await getMyNotifications();
        if (!active) return;

        const notifications = data?.notifications || [];
        if (!initialized.current) {
          notifications.forEach(({ id }) => knownIds.current.add(id));
          initialized.current = true;
          return;
        }

        notifications
          .filter(
            (notification) =>
              !knownIds.current.has(notification.id) && !notification.is_read,
          )
          .reverse()
          .forEach(showBrowserNotification);

        notifications.forEach(({ id }) => knownIds.current.add(id));
      } catch (error) {
        if (active) {
          console.error("Unable to check browser notifications.", error);
        }
      }
    };

    poll();
    const intervalId = window.setInterval(poll, POLL_INTERVAL);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return null;
}

export default NotificationListener;
