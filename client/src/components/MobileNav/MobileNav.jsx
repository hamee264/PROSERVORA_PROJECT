import { NavLink } from "react-router-dom";
import {
  Home,
  Search,
  ClipboardList,
  MessageCircle,
  UserRound,
  Ellipsis,
  Bell,
  Star,
  Wallet,
  Wrench,
  BadgeCheck,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { useState } from "react";

import "./MobileNav.css";

function MobileNav({ role = "customer" }) {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const clientItems = [
    {
      label: "Home",
      path: "/client/dashboard",
      icon: Home,
    },
    {
      label: "Discover",
      path: "/client/discover",
      icon: Search,
    },
    {
      label: "Requests",
      path: "/client/requests",
      icon: ClipboardList,
    },
    {
      label: "Messages",
      path: "/client/messages",
      icon: MessageCircle,
    },
    {
      label: "Profile",
      path: "/client/profile",
      icon: UserRound,
    },
  ];

  const providerItems = [
    {
      label: "Home",
      path: "/provider/dashboard",
      icon: Home,
    },
    {
      label: "Jobs",
      path: "/provider/jobs",
      icon: ClipboardList,
    },
    {
      label: "Bookings",
      path: "/provider/bookings",
      icon: ClipboardList,
    },
    {
      label: "Messages",
      path: "/provider/messages",
      icon: MessageCircle,
    },
    {
      label: "More",
      icon: Ellipsis,
      more: true,
    },
  ];

  const providerMoreItems = [
    { label: "Services", path: "/provider/services", icon: Wrench },
    { label: "Earnings", path: "/provider/earnings", icon: Wallet },
    { label: "Notifications", path: "/provider/notifications", icon: Bell },
    { label: "Profile", path: "/provider/profile", icon: UserRound },
    { label: "Reviews", path: "/provider/reviews", icon: Star },
    {
      label: "Verification",
      path: "/provider/verification",
      icon: BadgeCheck,
    },
  ];

  const items = role === "provider" ? providerItems : clientItems;
  const isMoreActive = providerMoreItems.some(
    (item) => item.path === location.pathname,
  );

  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <div className="mobile-nav__inner">
        {items.map((item) => {
          const Icon = item.icon;

          if (item.more) {
            return (
              <button
                key={item.label}
                type="button"
                className={`mobile-nav__item ${
                  moreOpen || isMoreActive ? "is-active" : ""
                }`}
                aria-expanded={moreOpen}
                aria-controls="provider-mobile-more"
                onClick={() => setMoreOpen((isOpen) => !isOpen)}
              >
                <span className="mobile-nav__icon">
                  <Icon size={20} strokeWidth={1.8} />
                </span>
                <span className="mobile-nav__label">{item.label}</span>
              </button>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/provider/dashboard"}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                `mobile-nav__item ${isActive ? "is-active" : ""}`
              }
            >
              <span className="mobile-nav__icon">
                <Icon size={20} strokeWidth={1.8} />
              </span>

              <span className="mobile-nav__label">{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      {role === "provider" && moreOpen && (
        <div className="mobile-nav__more-panel" id="provider-mobile-more">
          {providerMoreItems.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                `mobile-nav__more-link ${isActive ? "is-active" : ""}`
              }
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </nav>
  );
}

export default MobileNav;
