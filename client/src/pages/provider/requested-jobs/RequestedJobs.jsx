import { useEffect, useState } from "react";
import {
  AlertCircle,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Send,
  X,
} from "lucide-react";

import { applyForOpportunity, getMyBookings } from "../../../services/bookingService";
import { getRequestedOpportunities } from "../../../services/opportunityService";
import { getMyServices } from "../../../services/serviceService";

import "../jobs/Jobs.css";

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
};

function RequestedJobs() {
  const [requests, setRequests] = useState([]);
  const [services, setServices] = useState([]);
  const [applied, setApplied] = useState(new Set());
  const [selected, setSelected] = useState(null);
  const [serviceId, setServiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([getRequestedOpportunities(), getMyServices(), getMyBookings()])
      .then(([requested, providerServices, bookings]) => {
        if (!active) return;
        setRequests(requested?.opportunities || []);
        setServices(
          (providerServices?.services || []).filter((service) => service.is_active),
        );
        setApplied(
          new Set(
            (bookings?.bookings || [])
              .filter((booking) => booking.opportunity_id)
              .map((booking) => String(booking.opportunity_id)),
          ),
        );
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError.response?.data?.message ||
              "Unable to load requested jobs.",
          );
        }
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  const submitApplication = async (event) => {
    event.preventDefault();
    const proposedAmount = Number(amount);
    if (!serviceId || !Number.isFinite(proposedAmount) || proposedAmount <= 0) {
      setFormError("Choose a service and enter a valid proposed amount.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      await applyForOpportunity({
        opportunityId: selected.id,
        serviceId,
        agreedAmount: proposedAmount,
      });
      setApplied((current) => new Set([...current, String(selected.id)]));
      setSelected(null);
    } catch (submitError) {
      setFormError(
        submitError.response?.data?.message ||
          "Unable to submit your application.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="provider-jobs provider-requested-jobs">
      <header className="provider-jobs__hero">
        <div className="provider-jobs__intro">
          <span className="provider-jobs__eyebrow">DIRECT SERVICE REQUESTS</span>
          <h1>Requested jobs</h1>
          <p>Customers who found your service can send work requests directly to you.</p>
        </div>
        <div className="provider-jobs__count">
          <BriefcaseBusiness size={18} />
          <div>
            <strong>{loading ? "—" : requests.length}</strong>
            <span>requests</span>
          </div>
        </div>
      </header>

      {error ? (
        <div className="provider-jobs__message error"><AlertCircle size={18} />{error}</div>
      ) : loading ? (
        <div className="provider-jobs__message">Loading requested jobs...</div>
      ) : requests.length ? (
        <section className="provider-jobs__results-heading">
          <div>
            <span>DIRECT REQUESTS</span>
            <h2>Requests from customers</h2>
          </div>
          <p>{requests.length} matching requests</p>
        </section>
      ) : null}
      {!error && !loading && requests.length ? (
        <section className="provider-jobs__grid">
          {requests.map((request) => (
            <article key={request.id}>
              <div className="provider-jobs__top">
                <span className="provider-requested-jobs__source">DIRECT REQUEST</span>
                <small><Clock3 size={14} />Expires {formatDate(request.expires_at)}</small>
              </div>
              <div className="provider-jobs__card-content">
                <h2>{request.title}</h2>
                <div className="provider-requested-jobs__requester">
                  <span className="provider-requested-jobs__requester-avatar">
                    {request.title?.charAt(0)?.toUpperCase() || "R"}
                  </span>
                  <span>
                    <small>Customer request</small>
                    <strong>{request.category_name || "Service request"}</strong>
                  </span>
                </div>
                <p>{request.description}</p>
                <div className="provider-jobs__details">
                  {request.location_text && <span><MapPin size={15} />{request.location_text}</span>}
                  <span><CalendarDays size={15} />Posted {formatDate(request.created_at)}</span>
                </div>
              </div>
              <footer>
                {applied.has(String(request.id)) ? (
                  <strong><CheckCircle2 size={16} />Response sent</strong>
                ) : (
                  <button type="button" onClick={() => { setSelected(request); setServiceId(""); setAmount(""); setFormError(""); }}>
                    Respond <Send size={15} />
                  </button>
                )}
              </footer>
            </article>
          ))}
        </section>
      ) : !error && !loading ? (
        <div className="provider-jobs__message">
          <BriefcaseBusiness size={27} />
          <h2>No direct requests yet</h2>
          <p>Requests made from your published services will appear here.</p>
        </div>
      ) : null}

      {selected && (
        <div className="provider-jobs__backdrop" onMouseDown={() => !submitting && setSelected(null)}>
          <section className="provider-jobs__modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button className="close" type="button" onClick={() => setSelected(null)} disabled={submitting}><X size={18} /></button>
            <span>RESPOND TO REQUEST</span>
            <h2>{selected.title}</h2>
            <p>Choose the service you will use and your proposed amount.</p>
            <form onSubmit={submitApplication}>
              {formError && <div className="error"><AlertCircle size={16} />{formError}</div>}
              <label>Your service<select value={serviceId} onChange={(event) => setServiceId(event.target.value)} required><option value="">Select a service</option>{services.map((service) => <option key={service.id} value={service.id}>{service.title || service.name}</option>)}</select></label>
              <label>Proposed amount<input className="amount" type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="e.g. 50000" required /></label>
              <button className="submit" type="submit" disabled={submitting}>{submitting ? "Sending..." : "Send application"}</button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default RequestedJobs;
