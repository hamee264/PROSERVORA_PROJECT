import { LockKeyhole } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

import Input from "../../../components/Input/Input";
import Button from "../../../components/Button/Button";

import { resetPassword, verifyResetCode } from "../../../services/authService";

import "./ResetPassword.css";

function ResetPassword() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: localStorage.getItem("proservora_reset_email") || "",
    code: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);

  const [codeVerified, setCodeVerified] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    if (name === "code") {
      setCodeVerified(false);
    }
  };

  const handleVerifyCode = async () => {
    setError("");
    setMessage("");

    if (!formData.email.trim()) {
      setError("Enter the email address associated with your account.");
      return;
    }

    if (!formData.code.trim()) {
      setError("Enter the reset code sent to your email.");
      return;
    }

    try {
      setVerifyingCode(true);

      const response = await verifyResetCode({
        email: formData.email.trim(),
        code: formData.code.trim(),
      });

      setCodeVerified(true);

      setMessage(
        response.message || "Code verified. You can now create a new password.",
      );
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "The reset code is invalid or has expired.",
      );
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!codeVerified) {
      setError("Verify your reset code before creating a new password.");
      return;
    }

    try {
      setLoading(true);

      const response = await resetPassword({
        email: formData.email.trim(),
        code: formData.code.trim(),
        newPassword: formData.password,
      });

      localStorage.removeItem("proservora_reset_email");

      setMessage(
        response.message || "Your password has been reset successfully.",
      );

      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to reset your password. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="reset-password-page">
      <div className="reset-password-page__container">
        <Link
          to="/"
          className="reset-password-page__brand"
          aria-label="Proservora home"
        >
          <img
            src="/images/proservora-mark.png"
            alt=""
            className="reset-password-page__brand-mark"
          />

          <span>PROSERVORA</span>
        </Link>

        <div className="reset-password-page__icon">
          <LockKeyhole size={22} strokeWidth={1.7} />
        </div>

        <div className="reset-password-page__header">
          <span className="reset-password-page__eyebrow">PASSWORD RESET</span>

          <h1>Create a new password</h1>

          <p>
            Enter the reset code sent to your email, then choose a new password
            for your Proservora account.
          </p>
        </div>

        {error && (
          <p className="reset-password-page__message reset-password-page__message--error">
            {error}
          </p>
        )}

        {message && (
          <p className="reset-password-page__message reset-password-page__message--success">
            {message}
          </p>
        )}

        <form className="reset-password-page__form" onSubmit={handleSubmit}>
          <Input
            label="Email address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="you@example.com"
            autoComplete="email"
            required
            disabled={loading || verifyingCode}
          />

          <div className="reset-password-page__code">
            <Input
              label="Reset code"
              name="code"
              value={formData.code}
              onChange={handleChange}
              placeholder="Enter your reset code"
              autoComplete="one-time-code"
              required
              disabled={loading || verifyingCode}
            />

            <button
              type="button"
              className="reset-password-page__verify-code"
              onClick={handleVerifyCode}
              disabled={
                loading || verifyingCode || !formData.email || !formData.code
              }
            >
              {verifyingCode
                ? "Verifying..."
                : codeVerified
                  ? "Code verified"
                  : "Verify code"}
            </button>
          </div>

          <Input
            label="New password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter your new password"
            autoComplete="new-password"
            required
            disabled={loading || !codeVerified}
          />

          <Input
            label="Confirm password"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Repeat your new password"
            autoComplete="new-password"
            required
            disabled={loading || !codeVerified}
          />

          <Button
            type="submit"
            className="reset-password-page__submit"
            disabled={loading || !codeVerified}
          >
            {loading ? "Resetting password..." : "Reset password"}
          </Button>
        </form>

        <p className="reset-password-page__footer">
          <Link to="/login">Return to login</Link>
        </p>
      </div>
    </main>
  );
}

export default ResetPassword;
