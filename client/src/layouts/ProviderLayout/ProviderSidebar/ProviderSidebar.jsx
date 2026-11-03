import { NavLink } from "react-router-dom";
import {
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  Camera,
  CalendarCheck,
  ClipboardList,
  ChevronRight,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Star,
  UserRound,
  Wallet,
  Wrench,
} from "lucide-react";

import { Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import Logo from "../../../components/Logo/Logo";

import "./ProviderSidebar.css";

const navigationGroups = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", path: "/provider/dashboard", icon: LayoutDashboard },
      { label: "Jobs", path: "/provider/jobs", icon: BriefcaseBusiness },
      { label: "Requested jobs", path: "/provider/requested-jobs", icon: ClipboardList },
      { label: "Bookings", path: "/provider/bookings", icon: CalendarCheck },
      { label: "Services", path: "/provider/services", icon: Wrench },
      { label: "Earnings", path: "/provider/earnings", icon: Wallet },
      { label: "Bank account", path: "/provider/bank-account", icon: Wallet },
      { label: "Messages", path: "/provider/messages", icon: MessageCircle },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Notifications", path: "/provider/notifications", icon: Bell },
      { label: "Profile", path: "/provider/profile", icon: UserRound },
      { label: "Settings", path: "/provider/settings", icon: Settings },
      { label: "Reviews", path: "/provider/reviews", icon: Star },
      {
        label: "Verification",
        path: "/provider/verification",
        icon: BadgeCheck,
      },
    ],
  },
];

function ProviderSidebar() {
  const { user } = useAuth();

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

  return (
    <aside className="provider-sidebar">
      <div className="provider-sidebar__header">
        <div className="provider-sidebar__brand">
          <Logo size={40} animated />
          <span>Proservora</span>
        </div>
      </div>

      <Link to="/provider/profile" className="provider-sidebar__user">
        <span className="provider-sidebar__avatar">
          {profileImage ? (
            <img src={profileImage} alt={`${firstName}'s profile`} />
          ) : (
            <Camera size={17} strokeWidth={1.8} />
          )}
        </span>
        <span className="provider-sidebar__user-info">
          <span className="provider-sidebar__welcome">Welcome back</span>
          <strong>{firstName}</strong>
        </span>
      </Link>

      <nav className="provider-sidebar__nav" aria-label="Provider navigation">
        {navigationGroups.map((group) => (
          <section className="provider-sidebar__section" key={group.label}>
            <span className="provider-sidebar__section-label">
              {group.label}
            </span>

            <div className="provider-sidebar__links">
              {group.items.map(({ label, path, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === "/provider/dashboard"}
                  className={({ isActive }) =>
                    `provider-sidebar__link ${isActive ? "is-active" : ""}`
                  }
                >
                  <span className="provider-sidebar__icon">
                    <Icon size={18} strokeWidth={1.8} />
                  </span>
                  <span className="provider-sidebar__label">{label}</span>
                  <ChevronRight
                    className="provider-sidebar__arrow"
                    size={15}
                    strokeWidth={1.8}
                  />
                </NavLink>
              ))}
            </div>
          </section>
        ))}
      </nav>

      <div className="provider-sidebar__footer">
        <span className="provider-sidebar__status-dot" />
        Provider workspace
      </div>
    </aside>
  );
}

export default ProviderSidebar;
