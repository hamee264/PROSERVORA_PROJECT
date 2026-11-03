import { Link } from "react-router-dom";
import { Bell, ChevronRight, UserRound } from "lucide-react";

import NotificationPermission from "../../../components/NotificationPermission/NotificationPermission";

import "./Settings.css";

function Settings() {
  return (
    <div className="provider-settings">
      <header className="provider-settings__header">
        <span className="provider-settings__eyebrow">PROVIDER WORKSPACE</span>
        <h1>Settings</h1>
        <p>Manage your workspace preferences and notification access.</p>
      </header>

      <section className="provider-settings__section" aria-labelledby="provider-settings-preferences">
        <div className="provider-settings__heading">
          <span className="provider-settings__label">PREFERENCES</span>
          <h2 id="provider-settings-preferences">Notification preferences</h2>
        </div>
        <NotificationPermission />
      </section>

      <section className="provider-settings__section" aria-labelledby="provider-settings-account">
        <div className="provider-settings__heading">
          <span className="provider-settings__label">ACCOUNT</span>
          <h2 id="provider-settings-account">Account management</h2>
        </div>
        <Link to="/provider/profile" className="provider-settings__link">
          <span className="provider-settings__icon"><UserRound size={18} /></span>
          <span><strong>Profile information</strong><small>Update the public details clients see.</small></span>
          <ChevronRight size={17} />
        </Link>
        <Link to="/provider/notifications" className="provider-settings__link">
          <span className="provider-settings__icon"><Bell size={18} /></span>
          <span><strong>Notification inbox</strong><small>Review bookings, payments, messages, and account updates.</small></span>
          <ChevronRight size={17} />
        </Link>
      </section>
    </div>
  );
}

export default Settings;
