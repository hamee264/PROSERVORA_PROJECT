/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();

  const [{ user, token }, setAuthState] = useState(() => {
    const storedToken = localStorage.getItem("proservora_token");
    const storedUser = localStorage.getItem("proservora_user");

    if (storedToken && storedUser) {
      try {
        return { token: storedToken, user: JSON.parse(storedUser) };
      } catch {
        localStorage.removeItem("proservora_token");
        localStorage.removeItem("proservora_user");
      }
    }

    return { token: null, user: null };
  });

  const loading = false;

  const login = ({ token: newToken, user: newUser }) => {
    localStorage.setItem("proservora_token", newToken);
    localStorage.setItem("proservora_user", JSON.stringify(newUser));

    setAuthState({ token: newToken, user: newUser });
  };

  const logout = () => {
    localStorage.removeItem("proservora_token");
    localStorage.removeItem("proservora_user");

    setAuthState({ token: null, user: null });

    navigate("/login");
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(token && user),
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
