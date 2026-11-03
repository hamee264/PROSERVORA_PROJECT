import { lazy } from "react";
import { Route } from "react-router-dom";

import AuthLayout from "../layouts/AuthLayout/AuthLayout.jsx";

const Login = lazy(() => import("../pages/auth/login/Login.jsx"));
const Register = lazy(() => import("../pages/auth/register/Register.jsx"));
const ForgotPassword = lazy(() => import("../pages/auth/forgot-password/ForgotPassword.jsx"));
const ResetPassword = lazy(() => import("../pages/auth/reset-password/ResetPassword.jsx"));
const VerifyEmail = lazy(() => import("../pages/auth/verify-email/VerifyEmail.jsx"));

const AuthRoutes = (
  <>
    <Route element={<AuthLayout />}>
      <Route path="/login" element={<Login />} />

      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/verify-email" element={<VerifyEmail />} />
    </Route>

    <Route path="/register" element={<Register />} />
  </>
);

export default AuthRoutes;
