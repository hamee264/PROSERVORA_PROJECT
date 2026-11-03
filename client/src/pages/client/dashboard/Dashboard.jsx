import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  MessageCircle,
  Search,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext";

import "./Dashboard.css";

function Dashboard() {
  const { user } = useAuth();

  const firstName = user?.firstName || user?.first_name || "there";

  return (
    <div className="client-dashboard">
      <section className="client-dashboard__welcome">
        <div>
          <span className="client-dashboard__eyebrow">CLIENT SPACE</span>

          <h1>Good to see you, {firstName}.</h1>

          <p>
            Find the right professional, manage your services, and keep track of
            your work.
          </p>
        </div>

        <Link to="/client/discover" className="client-dashboard__discover">
          <Search size={17} strokeWidth={1.8} />
          <span>Find a service</span>
          <ArrowRight size={16} strokeWidth={1.8} />
        </Link>
      </section>

      <section className="client-dashboard__stats">
        <div className="client-dashboard__stat">
          <div className="client-dashboard__stat-icon">
            <BriefcaseBusiness size={19} strokeWidth={1.7} />
          </div>

          <div>
            <span>Active requests</span>
            <strong>0</strong>
          </div>
        </div>

        <div className="client-dashboard__stat">
          <div className="client-dashboard__stat-icon">
            <CalendarDays size={19} strokeWidth={1.7} />
          </div>

          <div>
            <span>Upcoming bookings</span>
            <strong>0</strong>
          </div>
        </div>

        <div className="client-dashboard__stat">
          <div className="client-dashboard__stat-icon">
            <MessageCircle size={19} strokeWidth={1.7} />
          </div>

          <div>
            <span>Unread messages</span>
            <strong>0</strong>
          </div>
        </div>
      </section>

      <section className="client-dashboard__discover-section">
        <div className="client-dashboard__section-heading">
          <div>
            <span className="client-dashboard__section-label">GET STARTED</span>

            <h2>What do you need help with?</h2>

            <p>
              Explore services and find professionals available for your next
              job.
            </p>
          </div>

          <Link to="/client/discover" className="client-dashboard__view-link">
            Explore marketplace
            <ArrowRight size={15} strokeWidth={1.8} />
          </Link>
        </div>

        <div className="client-dashboard__empty">
          <div className="client-dashboard__empty-icon">
            <Search size={24} strokeWidth={1.6} />
          </div>

          <h3>Start with a service</h3>

          <p>
            Browse services and professionals that can help you get the job
            done.
          </p>

          <Link to="/client/discover" className="client-dashboard__empty-link">
            Explore services
            <ArrowRight size={15} strokeWidth={1.8} />
          </Link>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
