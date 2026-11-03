import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

import Input from "../../../components/Input/Input";
import Button from "../../../components/Button/Button";

import "./ForgotPassword.css";

function ForgotPassword() {
  return (
    <main className="forgot-password-page">
      <div className="forgot-password-page__container">
        <Link
          to="/"
          className="forgot-password-page__brand"
          aria-label="Proservora home"
        >
          <img
            src="/images/proservora-mark.png"
            alt=""
            className="forgot-password-page__brand-mark"
          />

          <span>PROSERVORA</span>
        </Link>

        {/* <div className="forgot-password-page__icon">
          <ArrowLeft size={22} strokeWidth={1.7} />
        </div> */}

        <div className="forgot-password-page__header">
          <span className="forgot-password-page__eyebrow">
            ACCOUNT RECOVERY
          </span>

          <h1>Forgot your password?</h1>

          <p>
            Enter the email address associated with your Proservora account and
            we'll send you a link to reset your password.
          </p>
        </div>

        <form className="forgot-password-page__form">
          <Input
            label="Email address"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <Button type="submit" className="forgot-password-page__submit">
            Send reset link
          </Button>
        </form>

        <p className="forgot-password-page__footer">
          Remember your password?
          <Link to="/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}

export default ForgotPassword;
