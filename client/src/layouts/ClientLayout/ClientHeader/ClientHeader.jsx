import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Camera,
  ChevronDown,
  CreditCard,
  CalendarCheck,
  FolderKanban,
  BriefcaseBusiness,
  Settings,
  UserRound,
  LogOut,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext";
import Logo from "../../../components/Logo/Logo";
import LogoutModal from "../../../components/LogoutModal/LogoutModal";

import "./ClientHeader.css";

function ClientHeader() {
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
    "Customer";

  const fullName =
    user?.name ||
    [user?.firstName || user?.first_name, user?.lastName || user?.last_name]
      .filter(Boolean)
      .join(" ") ||
    firstName;

  const pageLabels = {
    "/client/dashboard": "Overview",
    "/client/discover": "Discover",
    "/client/services": "Services",
    "/client/categories": "Categories",
    "/client/providers": "Providers",
    "/client/requests": "Requests",
    "/client/bookings": "Bookings",
    "/client/messages": "Messages",
    "/client/notifications": "Notifications",
    "/client/payments": "Payments",
    "/client/profile": "Profile",
    "/client/reviews": "Reviews",
  };
  const currentPage =
    pageLabels[location.pathname] ||
    (location.pathname.startsWith("/client/service-details/")
      ? "Service details"
      : location.pathname.startsWith("/client/provider-profile/")
        ? "Provider profile"
        : "Workspace");
  const accountType =
    user?.role === "provider" ? "Provider account" : "Client account";

  /*
   * MobileNav already contains:
   * Home
   * Discover
   * Requests
   * Messages
   * Profile
   *
   * Therefore these are the ONLY additional client routes
   * displayed from the mobile profile menu.
   */
  const mobileAdditionalLinks = [
    {
      label: "Services",
      path: "/client/services",
      icon: BriefcaseBusiness,
    },
    {
      label: "Categories",
      path: "/client/categories",
      icon: FolderKanban,
    },
    {
      label: "Bookings",
      path: "/client/bookings",
      icon: CalendarCheck,
    },
    {
      label: "Notifications",
      path: "/client/notifications",
      icon: Bell,
    },
    {
      label: "Payments",
      path: "/client/payments",
      icon: CreditCard,
    },
    {
      label: "Settings",
      path: "/client/settings",
      icon: Settings,
    },
  ];

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

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const openLogoutModal = () => {
    setIsProfileOpen(false);
    setShowLogoutModal(true);
  };

  return (
    <>
      <header className="client-header">
        <div className="client-header__inner">
          <div
            className="client-header__context"
            aria-label={`Client workspace, ${currentPage}`}
          >
            <span>Client workspace</span>
            <span className="client-header__context-divider" aria-hidden="true">
              /
            </span>
            <strong>{currentPage}</strong>
          </div>

          <Link
            to="/client/dashboard"
            className="client-header__brand"
            aria-label="Go to dashboard"
          >
            <Logo size={36} animated />

            <span>Proservora</span>
          </Link>

          {/* =========================================
              ACTIONS
          ========================================= */}

          <div className="client-header__actions">
            <Link
              to="/client/notifications"
              className="client-header__notification"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={19} strokeWidth={1.8} />
            </Link>

            <div className="client-header__profile-wrapper" ref={profileRef}>
              <button
                type="button"
                className={`client-header__profile ${
                  isProfileOpen ? "is-open" : ""
                }`}
                onClick={() => setIsProfileOpen((current) => !current)}
                aria-expanded={isProfileOpen}
                aria-haspopup="menu"
              >
                <span className="client-header__avatar">
                  {profileImage ? (
                    <img src={profileImage} alt={`${fullName}'s profile`} />
                  ) : (
                    <Camera size={17} strokeWidth={1.8} />
                  )}
                </span>

                <span className="client-header__profile-info">
                  <span className="client-header__profile-name">
                    {firstName}
                  </span>
                  <span className="client-header__profile-role">
                    {accountType}
                  </span>
                </span>

                <ChevronDown
                  className="client-header__profile-chevron"
                  size={15}
                  strokeWidth={1.8}
                />
              </button>

              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div
                    className="client-header__dropdown"
                    initial={{
                      opacity: 0,
                      y: -5,
                      scale: 0.98,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      y: -5,
                      scale: 0.98,
                    }}
                    transition={{
                      duration: 0.16,
                      ease: "easeOut",
                    }}
                    role="menu"
                  >
                    {/* =========================
                        DESKTOP
                    ========================= */}

                    <div className="client-header__desktop-menu">
                      <Link
                        to="/client/profile"
                        className="client-header__dropdown-item"
                        onClick={() => setIsProfileOpen(false)}
                        role="menuitem"
                      >
                        <UserRound size={17} strokeWidth={1.8} />

                        <span>Profile</span>
                      </Link>
                    </div>

                    {/* =========================
                        MOBILE
                    ========================= */}

                    <div className="client-header__mobile-menu">
                      {mobileAdditionalLinks.map(
                        ({ label, path, icon: Icon }) => (
                          <Link
                            key={path}
                            to={path}
                            className="client-header__dropdown-item"
                            onClick={() => setIsProfileOpen(false)}
                            role="menuitem"
                          >
                            <Icon size={17} strokeWidth={1.8} />

                            <span>{label}</span>
                          </Link>
                        ),
                      )}

                      <Link
                        to="/client/profile"
                        className="client-header__dropdown-item"
                        onClick={() => setIsProfileOpen(false)}
                        role="menuitem"
                      >
                        <UserRound size={17} strokeWidth={1.8} />

                        <span>Profile</span>
                      </Link>
                    </div>

                    <div className="client-header__dropdown-divider" />

                    <button
                      type="button"
                      className="client-header__dropdown-item client-header__dropdown-item--logout"
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

export default ClientHeader;
