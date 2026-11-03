import { Outlet } from "react-router-dom";

import "./AuthLayout.css";

function AuthLayout() {
  return (
    <main className="auth-layout">
      <div className="auth-layout__content">
        <Outlet />
      </div>
    </main>
  );
}

export default AuthLayout;
