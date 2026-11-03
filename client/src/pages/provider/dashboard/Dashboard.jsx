import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  MessageCircle,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext";
import { getMyBookings } from "../../../services/bookingService";
import { getMyNotifications } from "../../../services/notificationService";
import { getMyServices } from "../../../services/serviceService";

import "./Dashboard.css";

const quickActions = [
  { label: "View jobs", path: "/provider/jobs" },
  { label: "Manage services", path: "/provider/services" },
  { label: "Bookings", path: "/provider/bookings" },
];

const formatMoney = (value, currency = "NGN") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatStatus = (value) => {
  if (!value) return "Unknown";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

function Dashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const firstName = user?.firstName || user?.first_name || "Provider";

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      try {
        const [bookingsResponse, servicesResponse, notificationsResponse] =
          await Promise.all([
            getMyBookings(),
            getMyServices(),
            getMyNotifications(),
          ]);

        if (!active) return;

        setBookings(bookingsResponse?.bookings || []);
        setServices(servicesResponse?.services || []);
        setNotifications(notificationsResponse?.notifications || []);
      } catch (loadError) {
        if (!active) return;

        setError(
          loadError.response?.data?.message ||
            "Unable to load your dashboard data right now.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const currency = bookings[0]?.currency || "NGN";
    const activeJobs = bookings.filter(({ status }) =>
      ["pending", "accepted", "in_progress"].includes(status),
    );
    const upcomingBookings = bookings.filter(({ status }) =>
      ["accepted", "in_progress"].includes(status),
    );
    const unreadMessages = notifications.filter((notification) => {
      const isRead = notification.is_read ?? notification.isRead ?? false;
      return !isRead;
    }).length;
    const earnedRevenue = bookings
      .filter(({ status }) => ["completed", "confirmed", "paid"].includes(status))
      .reduce((sum, booking) => sum + Number(booking.agreed_amount || 0), 0);

    return [
      {
        label: "Open jobs",
        value: String(activeJobs.length),
        detail: `${services.length} services live`,
        icon: BriefcaseBusiness,
      },
      {
        label: "Upcoming bookings",
        value: String(upcomingBookings.length),
        detail: `${bookings.length} total bookings`,
        icon: CalendarDays,
      },
      {
        label: "Unread messages",
        value: String(unreadMessages),
        detail: unreadMessages === 1 ? "needs attention" : "need replies",
        icon: MessageCircle,
      },
      {
        label: "Earnings",
        value: formatMoney(earnedRevenue, currency),
        detail: `${bookings.filter(({ status }) => status === "completed").length} completed jobs`,
        icon: CircleDollarSign,
      },
    ];
  }, [bookings, notifications, services.length]);

  const recentJobs = useMemo(
    () =>
      bookings
        .slice(0, 3)
        .map((booking) => ({
          title: booking.service_title || booking.opportunity_title || "Service request",
          client: booking.customer_first_name || "Customer",
          status: formatStatus(booking.status),
        })),
    [bookings],
  );

  const upcoming = useMemo(
    () =>
      bookings
        .filter(({ status }) => ["accepted", "in_progress"].includes(status))
        .slice(0, 3)
        .map((booking) => ({
          label: booking.service_title || booking.opportunity_title || "Service",
          time: booking.session_start_at || booking.started_at
            ? new Intl.DateTimeFormat("en", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }).format(new Date(booking.started_at))
            : "Flexible schedule",
          amount: formatMoney(booking.agreed_amount, booking.currency),
        })),
    [bookings],
  );

  return (
    <main className="provider-dashboard">
      <section className="provider-dashboard__welcome">
        <div>
          <span className="provider-dashboard__eyebrow">Provider workspace</span>
          <h1>Good to see you, {firstName}.</h1>
          <p>
            Keep your pipeline moving, manage bookings, and stay on top of what
            needs your attention today.
          </p>
        </div>

        <div className="provider-dashboard__welcome-actions">
          <Link to="/provider/jobs" className="provider-dashboard__primary-action">
            View jobs
            <ArrowRight size={16} strokeWidth={1.8} />
          </Link>
          <Link
            to="/provider/services"
            className="provider-dashboard__secondary-action"
          >
            Add service
          </Link>
        </div>
      </section>

      {error ? (
        <div className="provider-dashboard__error">{error}</div>
      ) : (
        <>
          <section
            className="provider-dashboard__stats"
            aria-label="Provider overview stats"
          >
            {stats.map(({ label, value, detail, icon: Icon }) => (
              <article key={label} className="provider-dashboard__stat">
                <div className="provider-dashboard__stat-icon">
                  <Icon size={19} strokeWidth={1.7} />
                </div>

                <div className="provider-dashboard__stat-copy">
                  <span>{label}</span>
                  <strong>{loading ? "--" : value}</strong>
                  <small>{loading ? "Loading" : detail}</small>
                </div>
              </article>
            ))}
          </section>

          <section className="provider-dashboard__content">
            <div className="provider-dashboard__panel provider-dashboard__panel--wide">
              <div className="provider-dashboard__panel-header">
                <div>
                  <span className="provider-dashboard__panel-label">
                    Quick actions
                  </span>
                  <h2>Keep momentum going</h2>
                </div>
              </div>

              <div className="provider-dashboard__quick-actions">
                {quickActions.map(({ label, path }) => (
                  <Link
                    key={label}
                    to={path}
                    className="provider-dashboard__quick-action"
                  >
                    <span>{label}</span>
                    <ArrowRight size={15} strokeWidth={1.8} />
                  </Link>
                ))}
              </div>
            </div>

            <div className="provider-dashboard__panel provider-dashboard__panel--accent">
              <div className="provider-dashboard__panel-header">
                <div>
                  <span className="provider-dashboard__panel-label">
                    Performance
                  </span>
                  <h2>Weekly trend</h2>
                </div>
                <TrendingUp size={18} strokeWidth={1.8} />
              </div>

              <div className="provider-dashboard__trend">
                <strong>+24%</strong>
                <span>Bookings this week compared to last week</span>
              </div>

              <div className="provider-dashboard__mini-bars" aria-hidden="true">
                <span style={{ height: "28%" }} />
                <span style={{ height: "38%" }} />
                <span style={{ height: "52%" }} />
                <span style={{ height: "66%" }} />
                <span style={{ height: "78%" }} />
                <span style={{ height: "100%" }} />
                <span style={{ height: "88%" }} />
              </div>
            </div>
          </section>

          <section className="provider-dashboard__bottom-grid">
            <div className="provider-dashboard__panel">
              <div className="provider-dashboard__panel-header">
                <div>
                  <span className="provider-dashboard__panel-label">
                    Recent jobs
                  </span>
                  <h2>Latest requests</h2>
                </div>
              </div>

              <ul className="provider-dashboard__list">
                {recentJobs.length ? (
                  recentJobs.map(({ title, client, status }) => (
                    <li key={`${title}-${client}`} className="provider-dashboard__list-item">
                      <div>
                        <strong>{title}</strong>
                        <span>{client}</span>
                      </div>
                      <em>{status}</em>
                    </li>
                  ))
                ) : (
                  <li className="provider-dashboard__empty-row">
                    No recent jobs yet.
                  </li>
                )}
              </ul>
            </div>

            <div className="provider-dashboard__panel">
              <div className="provider-dashboard__panel-header">
                <div>
                  <span className="provider-dashboard__panel-label">Schedule</span>
                  <h2>Upcoming</h2>
                </div>
              </div>

              <ul className="provider-dashboard__schedule">
                {upcoming.length ? (
                  upcoming.map(({ label, time, amount }) => (
                    <li key={`${label}-${time}`} className="provider-dashboard__schedule-item">
                      <div>
                        <strong>{label}</strong>
                        <span>{time}</span>
                      </div>
                      <em>{amount}</em>
                    </li>
                  ))
                ) : (
                  <li className="provider-dashboard__empty-row">
                    No upcoming bookings.
                  </li>
                )}
              </ul>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default Dashboard;
