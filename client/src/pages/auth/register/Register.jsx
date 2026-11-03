import { BriefcaseBusiness, UserRound } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";

import Input from "../../../components/Input/Input";
import Button from "../../../components/Button/Button";
import { registerUser } from "../../../services/authService";

import "./Register.css";

function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [role, setRole] = useState(
    searchParams.get("role") === "provider" ? "provider" : "client",
  );

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const response = await registerUser({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        role: role === "client" ? "customer" : "provider",
      });

      localStorage.setItem("proservora_verification_email", formData.email);

      console.log("Registration successful:", response);

      navigate("/verify-email");
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to create your account. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="register-page">
      <section className="register-page__image">
        <img src="/images/register.jpg" alt="Professional service provider" />

        <div className="register-page__image-overlay">
          <span>PROSERVORA</span>

          <h1>
            Your next
            <br />
            opportunity starts here.
          </h1>

          <p>
            Create your account and connect with the people and professionals
            you need.
          </p>
        </div>
      </section>

      <section className="register-page__form-section">
        <div className="register-page__form-wrapper">
          <div className="register-page__header">
            <span className="register-page__eyebrow">GET STARTED</span>

            <h2>Create your account</h2>

            <p>Choose how you want to use Proservora.</p>
          </div>

          {error && (
            <p className="register-page__message register-page__message--error">
              {error}
            </p>
          )}

          <div className="register-page__roles">
            <button
              type="button"
              className={`register-page__role ${
                role === "client" ? "is-selected" : ""
              }`}
              onClick={() => setRole("client")}
              disabled={loading}
            >
              <span className="register-page__role-icon">
                <UserRound size={19} strokeWidth={1.8} />
              </span>

              <span className="register-page__role-content">
                <strong>I'm a client</strong>

                <small>Find professionals and get services done.</small>
              </span>

              <span className="register-page__role-radio" />
            </button>

            <button
              type="button"
              className={`register-page__role ${
                role === "provider" ? "is-selected" : ""
              }`}
              onClick={() => setRole("provider")}
              disabled={loading}
            >
              <span className="register-page__role-icon">
                <BriefcaseBusiness size={19} strokeWidth={1.8} />
              </span>

              <span className="register-page__role-content">
                <strong>I'm a provider</strong>

                <small>Offer your skills and connect with clients.</small>
              </span>

              <span className="register-page__role-radio" />
            </button>
          </div>

          <form className="register-page__form" onSubmit={handleSubmit}>
            <div className="register-page__row">
              <Input
                label="First name"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="First name"
                autoComplete="given-name"
                required
                disabled={loading}
              />

              <Input
                label="Last name"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Last name"
                autoComplete="family-name"
                required
                disabled={loading}
              />
            </div>

            <Input
              label="Email address"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              autoComplete="email"
              required
              disabled={loading}
            />

            <Input
              label="Password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create a password"
              autoComplete="new-password"
              required
              disabled={loading}
            />

            <Input
              label="Confirm password"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Repeat your password"
              autoComplete="new-password"
              required
              disabled={loading}
            />

            <Button
              type="submit"
              className="register-page__submit"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="register-page__login">
            Already have an account?
            <Link to="/login">Log in</Link>
          </p>

          <p className="register-page__terms">
            By creating an account, you agree to our{" "}
            <Link to="/terms">Terms of Service</Link> and{" "}
            <Link to="/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}

export default Register;
