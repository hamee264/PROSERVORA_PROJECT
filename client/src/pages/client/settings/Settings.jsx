import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  Check,
  ChevronRight,
  FileText,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { useAuth } from "../../../context/AuthContext";
import LogoutModal from "../../../components/LogoutModal/LogoutModal";
import NotificationPermission from "../../../components/NotificationPermission/NotificationPermission";
import { getMyProfile } from "../../../services/userService";

import "./Settings.css";

const formatDate = (value) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

function Settings() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const data = await getMyProfile();
        if (active && data?.user) setProfile(data.user);
      } catch (loadError) {
        if (active) {
          setError(
            loadError.response?.data?.message ||
              "Some account details could not be refreshed.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  const currentUser = profile || user || {};
  const firstName = currentUser.first_name || currentUser.firstName || "Client";
  const lastName = currentUser.last_name || currentUser.lastName || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const avatar = currentUser.avatar_url || currentUser.avatarUrl || "";
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  const handleLogout = () => {
    setShowLogoutModal(false);
    logout();
  };

  return (
    <div className="client-settings">
      <header className="client-settings__header">
        <div>
          <span className="client-settings__eyebrow">YOUR ACCOUNT</span>
          <h1>Settings</h1>
          <p>Manage your account details and access.</p>
        </div>
      </header>

      {error && (
        <p className="client-settings__notice" role="status">
          <AlertCircle size={16} />
          {error}
        </p>
      )}

      <section
        className="client-settings__account"
        aria-label="Account overview"
      >
        <span className="client-settings__avatar">
          {avatar ? <img src={avatar} alt="" /> : initials || "C"}
        </span>
        <div className="client-settings__account-main">
          <span className="client-settings__section-label">
            ACCOUNT PROFILE
          </span>
          <h2>{fullName}</h2>
          <p>{currentUser.email || "Email unavailable"}</p>
        </div>
        <Link to="/client/profile" className="client-settings__outline-action">
          <span>Edit profile</span>
          <ArrowUpRight size={15} />
        </Link>
      </section>

      <section
        className="client-settings__section"
        aria-labelledby="settings-account-title"
      >
        <div className="client-settings__section-heading">
          <div>
            <span className="client-settings__section-label">ACCOUNT</span>
            <h2 id="settings-account-title">Account details</h2>
          </div>
        </div>

        <div className="client-settings__details">
          <div className="client-settings__detail-row">
            <span>Email address</span>
            <strong>{currentUser.email || "Not available"}</strong>
            <span
              className={`client-settings__verification ${
                currentUser.is_email_verified ? "is-verified" : ""
              }`}
            >
              {currentUser.is_email_verified && <Check size={13} />}
              {currentUser.is_email_verified ? "Verified" : "Unverified"}
            </span>
          </div>
          <div className="client-settings__detail-row">
            <span>Account type</span>
            <strong>
              {currentUser.role === "provider" ? "Service provider" : "Client"}
            </strong>
            <span className="client-settings__detail-hint">Fixed</span>
          </div>
          <div className="client-settings__detail-row">
            <span>Member since</span>
            <strong>{formatDate(currentUser.created_at)}</strong>
            <span className="client-settings__detail-hint">
              {loading ? "Updating" : ""}
            </span>
          </div>
        </div>
      </section>

      <section
        className="client-settings__section"
        aria-labelledby="settings-workspace-title"
      >
        <div className="client-settings__section-heading">
          <div>
            <span className="client-settings__section-label">PREFERENCES</span>
            <h2 id="settings-workspace-title">Your workspace</h2>
          </div>
        </div>

        <Link to="/client/notifications" className="client-settings__link-row">
          <span className="client-settings__link-icon">
            <Bell size={18} />
          </span>
          <span className="client-settings__link-copy">
            <strong>Notifications</strong>
            <small>
              Review updates about bookings, payments, and messages.
            </small>
          </span>
          <ChevronRight size={17} />
        </Link>

        <Link to="/client/profile" className="client-settings__link-row">
          <span className="client-settings__link-icon">
            <UserRound size={18} />
          </span>
          <span className="client-settings__link-copy">
            <strong>Profile information</strong>
            <small>
              Update your name, photo, contact details, and location.
            </small>
          </span>
          <ChevronRight size={17} />
        </Link>
      </section>

      <section
        className="client-settings__section"
        aria-labelledby="settings-notifications-title"
      >
        <div className="client-settings__section-heading">
          <div>
            <span className="client-settings__section-label">ALERTS</span>
            <h2 id="settings-notifications-title">Notification preferences</h2>
          </div>
        </div>
        <NotificationPermission />
      </section>

      <section
        className="client-settings__section"
        aria-labelledby="settings-legal-title"
      >
        <div className="client-settings__section-heading">
          <div>
            <span className="client-settings__section-label">INFORMATION</span>
            <h2 id="settings-legal-title">Privacy and terms</h2>
          </div>
        </div>

        <Link to="/privacy" className="client-settings__link-row">
          <span className="client-settings__link-icon">
            <ShieldCheck size={18} />
          </span>
          <span className="client-settings__link-copy">
            <strong>Privacy policy</strong>
            <small>How account and activity data is handled.</small>
          </span>
          <ChevronRight size={17} />
        </Link>

        <Link to="/terms" className="client-settings__link-row">
          <span className="client-settings__link-icon">
            <FileText size={18} />
          </span>
          <span className="client-settings__link-copy">
            <strong>Terms of service</strong>
            <small>Review the terms for using Proservora.</small>
          </span>
          <ChevronRight size={17} />
        </Link>
      </section>

      <div className="client-settings__signout-row">
        <div>
          <strong>Sign out of this account</strong>
          <span>You’ll need to sign in again to access your workspace.</span>
        </div>
        <button
          type="button"
          className="client-settings__signout"
          onClick={() => setShowLogoutModal(true)}
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>

      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
      />
    </div>
  );
}

export default Settings;
