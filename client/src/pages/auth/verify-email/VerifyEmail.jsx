import { MailCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

import Button from "../../../components/Button/Button";
import Input from "../../../components/Input/Input";
import { verifyEmail, resendVerification } from "../../../services/authService";

import "./VerifyEmail.css";

function VerifyEmail() {
  const navigate = useNavigate();

  const [email, setEmail] = useState(
    localStorage.getItem("proservora_verification_email") || "",
  );

  const [code, setCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleVerify = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Your email address is required.");
      return;
    }

    if (!code.trim()) {
      setError("Enter the verification code sent to your email.");
      return;
    }

    try {
      setLoading(true);

      const response = await verifyEmail({
        email: email.trim(),
        code: code.trim(),
      });

      setMessage(
        response.message || "Your email has been verified successfully.",
      );

      localStorage.removeItem("proservora_verification_email");

      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to verify your email. Please check the code and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Enter your email address before requesting a new code.");
      return;
    }

    try {
      setResending(true);

      const response = await resendVerification({
        email: email.trim(),
      });

      setMessage(response.message || "A new verification code has been sent.");
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to resend the verification code.",
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="verify-email-page">
      <div className="verify-email-page__container">
        <Link
          to="/"
          className="verify-email-page__brand"
          aria-label="Proservora home"
        >
          <img
            src="/images/proservora-mark.png"
            alt=""
            className="verify-email-page__brand-mark"
          />

          <span>PROSERVORA</span>
        </Link>

        <div className="verify-email-page__icon">
          <MailCheck size={26} strokeWidth={1.7} />
        </div>

        <div className="verify-email-page__header">
          <span className="verify-email-page__eyebrow">EMAIL VERIFICATION</span>

          <h1>Verify your email address</h1>

          <p>
            Enter the verification code we sent to your email address to
            activate your Proservora account.
          </p>
        </div>

        {error && (
          <p className="verify-email-page__message verify-email-page__message--error">
            {error}
          </p>
        )}

        {message && (
          <p className="verify-email-page__message verify-email-page__message--success">
            {message}
          </p>
        )}

        <form className="verify-email-page__form" onSubmit={handleVerify}>
          <Input
            label="Email address"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            disabled={loading || resending}
          />

          <Input
            label="Verification code"
            name="code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Enter your verification code"
            autoComplete="one-time-code"
            required
            disabled={loading}
          />

          <Button
            type="submit"
            className="verify-email-page__submit"
            disabled={loading}
          >
            {loading ? "Verifying..." : "Verify email"}
          </Button>
        </form>

        <div className="verify-email-page__resend">
          <span>Didn't receive a code?</span>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending || loading}
          >
            {resending ? "Sending..." : "Resend code"}
          </button>
        </div>

        <Link to="/login" className="verify-email-page__login">
          Return to login
        </Link>
      </div>
    </main>
  );
}

export default VerifyEmail;
