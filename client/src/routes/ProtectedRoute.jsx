import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

function ProtectedRoute({ role }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (role && user?.role !== role) {
    if (user?.role === "provider") {
      return <Navigate to="/provider/dashboard" replace />;
    }

    if (user?.role === "customer") {
      return <Navigate to="/client/dashboard" replace />;
    }

    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
