import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

import Input from "../../../components/Input/Input";
import Button from "../../../components/Button/Button";

import { useAuth } from "../../../context/AuthContext";
import { loginUser } from "../../../services/authService";

import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
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

    try {
      setLoading(true);

      const response = await loginUser({
        email: formData.email,
        password: formData.password,
      });

      const role = response.user?.role;

      if (role !== "provider" && role !== "customer") {
        setError("Your account role could not be determined.");
        return;
      }

      login({
        token: response.token,
        user: response.user,
      });

      if (role === "provider") {
        navigate("/provider/dashboard");
        return;
      }

      navigate("/client/dashboard");
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to log in. Please check your email and password.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-page__container">
        <Link to="/" className="login-page__brand" aria-label="Proservora home">
          <img
            src="/images/proservora-mark.png"
            alt=""
            className="login-page__brand-mark"
          />

          <span>PROSERVORA</span>
        </Link>

        <div className="login-page__header">
          <span className="login-page__eyebrow">WELCOME BACK</span>

          <h1>Log in to Proservora</h1>

          <p>Continue to your account and manage your Proservora experience.</p>
        </div>

        {error && <p className="login-page__message">{error}</p>}

        <form className="login-page__form" onSubmit={handleSubmit}>
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

          <div className="login-page__password">
            <Input
              label="Password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              disabled={loading}
            />

            <Link to="/forgot-password" className="login-page__forgot">
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            className="login-page__submit"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Log in"}
          </Button>
        </form>

        <div className="login-page__divider">
          <span>OR</span>
        </div>

        <p className="login-page__register">
          Don't have an account?
          <Link to="/register">Create an account</Link>
        </p>

        <p className="login-page__legal">
          By continuing, you agree to our{" "}
          <Link to="/terms">Terms of Service</Link> and{" "}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </div>
    </main>
  );
}

export default Login;
