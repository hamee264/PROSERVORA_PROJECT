import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import Logo from "../Logo/Logo";
import Button from "../Button/Button";

import "./Navbar.css";

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => {
    setMenuOpen(false);
  };

  return (
    <header className="navbar">
      <div className="navbar__container">
        {/* Brand */}
        <Link
          to="/"
          className="navbar__brand"
          onClick={closeMenu}
          aria-label="Proservora home"
        >
          <Logo size={46} animated />
        </Link>

        {/* Desktop navigation */}
        <nav className="navbar__desktop-nav" aria-label="Main navigation">
          <NavLink to="/" end className="navbar__link">
            Home
          </NavLink>

          <NavLink to="/how-it-works" className="navbar__link">
            How it works
          </NavLink>

          <NavLink to="/about" className="navbar__link">
            About
          </NavLink>

          <NavLink to="/become-a-provider" className="navbar__link">
            Become a provider
          </NavLink>
        </nav>

        {/* Desktop actions */}
        <div className="navbar__actions">
          <Link to="/login" className="navbar__login">
            Log in
          </Link>

          <Button to="/register">Get started</Button>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          className={`navbar__menu-button ${menuOpen ? "is-open" : ""}`}
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
        >
          {menuOpen ? (
            <X size={21} strokeWidth={1.8} />
          ) : (
            <Menu size={21} strokeWidth={1.8} />
          )}
        </button>
      </div>

      {/* Mobile navigation */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="mobile-navigation"
            className="navbar__mobile-menu"
            initial={{
              opacity: 0,
              y: -8,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -8,
            }}
            transition={{
              duration: 0.2,
              ease: "easeOut",
            }}
          >
            <nav className="navbar__mobile-nav" aria-label="Mobile navigation">
              <div className="navbar__mobile-links">
                <NavLink
                  to="/"
                  end
                  className="navbar__mobile-link"
                  onClick={closeMenu}
                >
                  <span>Home</span>
                  <span className="navbar__mobile-index">01</span>
                </NavLink>

                <NavLink
                  to="/how-it-works"
                  className="navbar__mobile-link"
                  onClick={closeMenu}
                >
                  <span>How it works</span>
                  <span className="navbar__mobile-index">02</span>
                </NavLink>

                <NavLink
                  to="/about"
                  className="navbar__mobile-link"
                  onClick={closeMenu}
                >
                  <span>About</span>
                  <span className="navbar__mobile-index">03</span>
                </NavLink>

                <NavLink
                  to="/become-a-provider"
                  className="navbar__mobile-link"
                  onClick={closeMenu}
                >
                  <span>Become a provider</span>
                  <span className="navbar__mobile-index">04</span>
                </NavLink>
              </div>

              <div className="navbar__mobile-actions">
                <Link
                  to="/login"
                  className="navbar__mobile-login"
                  onClick={closeMenu}
                >
                  Log in
                </Link>

                <Button to="/register" className="navbar__mobile-cta">
                  Get started
                </Button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default Navbar;
