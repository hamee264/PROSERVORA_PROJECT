import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Compass,
  BriefcaseBusiness,
  FolderKanban,
  ClipboardList,
  CalendarCheck,
  MessageCircle,
  Bell,
  CreditCard,
  UserRound,
  Settings,
  ChevronRight,
  X,
  Camera,
} from "lucide-react";

import { useAuth } from "../../../context/AuthContext";
import Logo from "../../../components/Logo/Logo";

import "./ClientSidebar.css";

function ClientSidebar({ isOpen = false, onClose }) {
  const { user } = useAuth();

  const marketplaceLinks = [
    {
      label: "Home",
      path: "/client/dashboard",
      icon: LayoutDashboard,
      end: true,
    },
    {
      label: "Discover",
      path: "/client/discover",
      icon: Compass,
    },
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
      label: "My Requests",
      path: "/client/requests",
      icon: ClipboardList,
    },
    {
      label: "Bookings",
      path: "/client/bookings",
      icon: CalendarCheck,
    },
    {
      label: "Messages",
      path: "/client/messages",
      icon: MessageCircle,
    },
  ];

  const accountLinks = [
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
      label: "Profile",
      path: "/client/profile",
      icon: UserRound,
    },
    {
      label: "Settings",
      path: "/client/settings",
      icon: Settings,
    },
  ];

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

  const renderLinks = (links) =>
    links.map(({ label, path, icon: Icon, end }) => (
      <NavLink
        key={path}
        to={path}
        end={end}
        onClick={onClose}
        className={({ isActive }) =>
          `client-sidebar__link ${isActive ? "is-active" : ""}`
        }
      >
        <span className="client-sidebar__icon">
          <Icon size={18} strokeWidth={1.8} />
        </span>

        <span className="client-sidebar__label">{label}</span>

        <ChevronRight
          className="client-sidebar__arrow"
          size={15}
          strokeWidth={1.8}
        />
      </NavLink>
    ));

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="client-sidebar__overlay"
          onClick={onClose}
          aria-label="Close navigation"
        />
      )}

      <aside
        className={`client-sidebar ${isOpen ? "client-sidebar--open" : ""}`}
      >
        {/* =========================================
            BRAND
        ========================================= */}

        <div className="client-sidebar__header">
          <div className="client-sidebar__brand">
            <Logo size={40} animated />

            <span className="client-sidebar__brand-name">Proservora</span>
          </div>

          <button
            type="button"
            className="client-sidebar__close"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X size={19} strokeWidth={1.8} />
          </button>
        </div>

        {/* =========================================
            USER
        ========================================= */}

        <div className="client-sidebar__user">
          <div className="client-sidebar__avatar">
            {profileImage ? (
              <img src={profileImage} alt={`${firstName}'s profile`} />
            ) : (
              <Camera size={17} strokeWidth={1.8} />
            )}
          </div>

          <div className="client-sidebar__user-info">
            <span className="client-sidebar__welcome">Welcome back</span>

            <strong>{firstName}</strong>
          </div>
        </div>

        {/* =========================================
            NAVIGATION
        ========================================= */}

        <nav className="client-sidebar__nav" aria-label="Client navigation">
          <div className="client-sidebar__section">
            <span className="client-sidebar__section-title">Marketplace</span>

            <div className="client-sidebar__links">
              {renderLinks(marketplaceLinks)}
            </div>
          </div>

          <div className="client-sidebar__section">
            <span className="client-sidebar__section-title">Account</span>

            <div className="client-sidebar__links">
              {renderLinks(accountLinks)}
            </div>
          </div>
        </nav>

        {/* =========================================
            FOOTER
        ========================================= */}

        <div className="client-sidebar__bottom">
          <div className="client-sidebar__version">
            <span className="client-sidebar__status-dot" />

            <span>Proservora</span>
          </div>
        </div>
      </aside>
    </>
  );
}

export default ClientSidebar;
