import { Outlet } from "react-router-dom";

import MobileNav from "../../components/MobileNav/MobileNav";
import NotificationListener from "../../components/NotificationListener/NotificationListener";
import ClientHeader from "./ClientHeader/ClientHeader";
import ClientSidebar from "./ClientSidebar/ClientSidebar";

import "./ClientLayout.css";

function ClientLayout() {
  return (
    <div className="client-layout">
      <NotificationListener />
      <ClientSidebar />

      <div className="client-layout__main">
        <ClientHeader />

        <main className="client-layout__content">
          <Outlet />
        </main>
      </div>

      <MobileNav role="customer" />
    </div>
  );
}

export default ClientLayout;
