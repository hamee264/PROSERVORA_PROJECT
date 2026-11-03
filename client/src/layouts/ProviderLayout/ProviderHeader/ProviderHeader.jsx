import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Camera,
  ChevronDown,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext";
import Logo from "../../../components/Logo/Logo";
import LogoutModal from "../../../components/LogoutModal/LogoutModal";

import "./ProviderHeader.css";

const pageLabels = {
  "/provider/dashboard": "Overview",
  "/provider/jobs": "Jobs",
  "/provider/requested-jobs": "Requested jobs",
  "/provider/bookings": "Bookings",
  "/provider/earnings": "Earnings",
  "/provider/bank-account": "Bank account",
  "/provider/services": "Services",
  "/provider/messages": "Messages",
  "/provider/notifications": "Notifications",
  "/provider/profile": "Profile",
  "/provider/settings": "Settings",
  "/provider/reviews": "Reviews",
  "/provider/verification": "Verification",
};

function ProviderHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const profileRef = useRef(null);

  const profileImage =
    user?.profileImage ||
    user?.avatar ||
    user?.avatar_url ||
    user?.avatarUrl ||
    user?.profilePicture ||
    user?.image ||
    user?.photoURL;

  const firstName =
    user?.firstName ||
    user?.first_name ||
    user?.name?.split(" ")?.[0] ||
    "Provider";

  const fullName =
    user?.name ||
    [user?.firstName || user?.first_name, user?.lastName || user?.last_name]
      .filter(Boolean)
      .join(" ") ||
    firstName;

  const currentPage = pageLabels[location.pathname] || "Workspace";

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setShowLogoutModal(false);
      setIsProfileOpen(false);
      navigate("/login");
    }
  };

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") setIsProfileOpen(false);
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const openLogoutModal = () => {
    setIsProfileOpen(false);
    setShowLogoutModal(true);
  };

  return (
    <>
      <header className="provider-header">
        <div className="provider-header__inner">
          <div
            className="provider-header__context"
            aria-label={`Provider workspace, ${currentPage}`}
          >
            <span>Provider workspace</span>
            <span
              className="provider-header__context-divider"
              aria-hidden="true"
            >
              /
            </span>
            <strong>{currentPage}</strong>
          </div>

          <Link
            to="/provider/dashboard"
            className="provider-header__brand"
            aria-label="Go to provider dashboard"
          >
            <Logo size={36} animated />
            <span>Proservora</span>
          </Link>

          <div className="provider-header__actions">
            <Link
              to="/provider/notifications"
              className="provider-header__notification"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={19} strokeWidth={1.8} />
            </Link>

            <div className="provider-header__profile-wrapper" ref={profileRef}>
              <button
                type="button"
                className={`provider-header__profile ${
                  isProfileOpen ? "is-open" : ""
                }`}
                onClick={() => setIsProfileOpen((current) => !current)}
                aria-expanded={isProfileOpen}
                aria-haspopup="menu"
              >
                <span className="provider-header__avatar">
                  {profileImage ? (
                    <img src={profileImage} alt={`${fullName}'s profile`} />
                  ) : (
                    <Camera size={17} strokeWidth={1.8} />
                  )}
                </span>
                <span className="provider-header__profile-info">
                  <span className="provider-header__profile-name">
                    {firstName}
                  </span>
                  <span className="provider-header__profile-role">
                    Provider account
                  </span>
                </span>
                <ChevronDown
                  className="provider-header__profile-chevron"
                  size={15}
                  strokeWidth={1.8}
                />
              </button>

              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div
                    className="provider-header__dropdown"
                    initial={{ opacity: 0, y: -5, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.98 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                    role="menu"
                  >
                    <Link
                      to="/provider/profile"
                      className="provider-header__dropdown-item"
                      onClick={() => setIsProfileOpen(false)}
                      role="menuitem"
                    >
                      <UserRound size={17} strokeWidth={1.8} />
                      <span>Profile</span>
                    </Link>

                    <Link
                      to="/provider/settings"
                      className="provider-header__dropdown-item"
                      onClick={() => setIsProfileOpen(false)}
                      role="menuitem"
                    >
                      <Settings size={17} strokeWidth={1.8} />
                      <span>Settings</span>
                    </Link>

                    <div className="provider-header__dropdown-divider" />

                    <button
                      type="button"
                      className="provider-header__dropdown-item provider-header__dropdown-item--logout"
                      onClick={openLogoutModal}
                      role="menuitem"
                    >
                      <LogOut size={17} strokeWidth={1.8} />
                      <span>Sign out</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
      />
    </>
  );
}

export default ProviderHeader;
