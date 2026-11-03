import { Outlet } from "react-router-dom";

import MobileNav from "../../components/MobileNav/MobileNav";
import NotificationListener from "../../components/NotificationListener/NotificationListener";
import ProviderHeader from "./ProviderHeader/ProviderHeader";
import ProviderSidebar from "./ProviderSidebar/ProviderSidebar";

import "./ProviderLayout.css";

function ProviderLayout() {
  return (
    <div className="provider-layout">
      <NotificationListener />
      <ProviderSidebar />

      <div className="provider-layout__main">
        <ProviderHeader />

        <main className="provider-layout__content">
          <Outlet />
        </main>
      </div>

      <MobileNav role="provider" />
    </div>
  );
}

export default ProviderLayout;
