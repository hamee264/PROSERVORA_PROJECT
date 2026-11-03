import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

import Logo from "../Logo/Logo";

import "./Footer.css";

function Footer() {
  return (
    <footer className="footer">
      <div className="footer__container">
        <div className="footer__main">
          <div className="footer__brand">
            <Link to="/" className="footer__logo" aria-label="Proservora home">
              <Logo variant="full" />
            </Link>

            <p>
              Proservora connects customers with skilled professionals for
              everyday services, specialized work, and everything in between.
            </p>

            <Link to="/become-a-provider" className="footer__brand-link">
              Start offering your services
              <ArrowUpRight size={15} strokeWidth={1.8} />
            </Link>
          </div>

          <div className="footer__links">
            <div className="footer__group">
              <h3>Discover</h3>

              <Link to="/how-it-works">How it works</Link>

              <Link to="/register">Find a service</Link>

              <Link to="/register">Create an account</Link>

              <Link to="/login">Log in</Link>
            </div>

            <div className="footer__group">
              <h3>Professionals</h3>

              <Link to="/become-a-provider">Become a provider</Link>

              <Link to="/register">Join Proservora</Link>
            </div>

            <div className="footer__group">
              <h3>Company</h3>

              <Link to="/about">About Proservora</Link>

              <Link to="/terms">Terms of service</Link>

              <Link to="/privacy">Privacy policy</Link>
            </div>
          </div>
        </div>

        <div className="footer__bottom">
          <span>
            © {new Date().getFullYear()} Proservora. All rights reserved.
          </span>

          <span className="footer__tagline">
            Find the right professional. Get the job done.
          </span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
