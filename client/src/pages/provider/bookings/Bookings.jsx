import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageCircle,
  Search,
  UserRound,
  X,
} from "lucide-react";

import {
  completeBooking,
  getMyBookings,
  startBooking,
  withdrawBooking,
} from "../../../services/bookingService";
import { startConversation } from "../../../services/chatService";
import "../../client/bookings/Bookings.css";

const filters = [
  { label: "All jobs", value: "all" },
  { label: "Applications", value: "pending" },
  { label: "Ready to start", value: "accepted" },
  { label: "In progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
];

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
};

const formatAmount = (amount, currency = "NGN") => new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(amount || 0));

const statusLabel = (booking) => {
  if (booking.status === "completed" && booking.customer_confirmed_at) return "Confirmed and paid";
  if (
    booking.status === "accepted" &&
    !["paid", "released"].includes(booking.payment_status)
  ) {
    return "Awaiting customer payment";
  }
  return {
    pending: "Application pending",
    accepted: "Ready to start",
    in_progress: "Work in progress",
    completed: "Awaiting client confirmation",
    cancelled: "Cancelled",
  }[booking.status] || "Unknown";
};

const canContactCustomer = (status) =>
  ["pending", "accepted", "in_progress"].includes(status);

const customerName = (booking) => [booking.customer_first_name, booking.customer_last_name].filter(Boolean).join(" ") || booking.customer_username || "Client";

const actionDetails = {
  withdraw: { title: "Withdraw application?", message: "Your application will be removed from this service request.", label: "Withdraw application" },
  start: { title: "Start this job?", message: "Only start once payment has been received and you are ready to begin work.", label: "Start job" },
  complete: { title: "Mark work as complete?", message: "The client will be asked to confirm completion before payment is released.", label: "Mark complete" },
};

function Bookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [processingId, setProcessingId] = useState("");

  const handleContactCustomer = async (booking) => {
    if (processingId) return;

    setError("");
    setProcessingId(booking.id);
    try {
      const data = await startConversation(booking.customer_id);
      const conversationId = data?.conversation?.id;
      if (!conversationId) throw new Error("Unable to open this conversation.");
      navigate(`/provider/messages?conversationId=${encodeURIComponent(conversationId)}`);
    } catch (contactError) {
      setError(
        contactError.response?.data?.message ||
          contactError.message ||
          "Unable to contact this customer.",
      );
    } finally {
      setProcessingId("");
    }
  };

  useEffect(() => {
    let current = true;
    const load = async () => {
      try {
        const response = await getMyBookings();
        if (current) setBookings(response?.bookings || []);
      } catch (loadError) {
        if (current) setError(loadError.response?.data?.message || "Unable to load your jobs. Please try again.");
      } finally { if (current) setLoading(false); }
    };
    load();
    return () => { current = false; };
  }, []);

  const counts = useMemo(() => bookings.reduce((total, booking) => ({ ...total, all: total.all + 1, [booking.status]: (total[booking.status] || 0) + 1 }), { all: 0, pending: 0, accepted: 0, in_progress: 0, completed: 0 }), [bookings]);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return bookings.filter((booking) => (filter === "all" || booking.status === filter) && (!query || [booking.opportunity_title, booking.service_title, booking.opportunity_location, customerName(booking)].filter(Boolean).some((value) => value.toLowerCase().includes(query))));
  }, [bookings, filter, search]);

  const applyAction = async () => {
    if (!confirmation) return;
    const { type, booking } = confirmation;
    const action = { withdraw: withdrawBooking, start: startBooking, complete: completeBooking }[type];
    setProcessingId(booking.id); setError("");
    try {
      const response = await action(booking.id);
      setBookings((items) => items.map((item) => item.id === booking.id ? { ...item, ...response.booking } : item));
      setConfirmation(null);
    } catch (actionError) {
      setError(actionError.response?.data?.message || "Unable to update this booking. Please try again.");
      setConfirmation(null);
    } finally { setProcessingId(""); }
  };

  return (
    <div className="client-bookings provider-bookings">
      <header className="client-bookings__header">
        <span className="client-bookings__eyebrow">PROVIDER WORKSPACE</span>
        <h1>Bookings</h1>
        <p>Deliver accepted customer work, track payment, and close completed jobs.</p>
      </header>
      <section className="client-bookings__content" aria-label="Your bookings">
        <div className="client-bookings__toolbar">
          <div className="client-bookings__filters" role="tablist" aria-label="Filter provider bookings">
            {filters.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={filter === item.value}
                className={filter === item.value ? "client-bookings__filter is-active" : "client-bookings__filter"}
                onClick={() => setFilter(item.value)}
              >
                {item.label}<span>{counts[item.value] || 0}</span>
              </button>
            ))}
          </div>
          <label className="client-bookings__search">
            <Search size={17} aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search jobs or clients" aria-label="Search bookings" />
          </label>
        </div>
        {error && <p className="client-bookings__alert" role="alert"><AlertCircle size={17} />{error}</p>}
        {loading ? (
          <div className="client-bookings__state" role="status">Loading bookings...</div>
        ) : visible.length ? (
          <div className="client-bookings__list">
            {visible.map((booking) => (
              <article
                className={`client-bookings__item ${
                  booking.status === "completed"
                    ? "provider-bookings__item--completed"
                    : ""
                }`}
                key={booking.id}
              >
                <div className="client-bookings__item-main">
                  <div className="client-bookings__item-topline">
                    <span className={`client-bookings__status client-bookings__status--${booking.status}`}><span />{statusLabel(booking)}</span>
                    {booking.status === "completed" && (
                      <span className="provider-bookings__completion-label">
                        Completed
                      </span>
                    )}
                    <span className="client-bookings__posted-date">Created {formatDate(booking.created_at)}</span>
                  </div>
                  <h2>{booking.opportunity_title || "Service request"}</h2>
                  <p className="client-bookings__service">
                    From client request · {booking.service_title || "Your service"}
                  </p>
                  <div className="client-bookings__details">
                    <span className="client-bookings__provider">
                      {booking.customer_avatar_url ? <img src={booking.customer_avatar_url} alt="" /> : <span className="client-bookings__avatar-fallback"><UserRound size={15} /></span>}
                      <span>{customerName(booking)}</span>
                    </span>
                    <span><BriefcaseBusiness size={14} />{formatAmount(booking.agreed_amount, booking.currency)}</span>
                    {["paid", "released"].includes(booking.payment_status) && <span><CheckCircle2 size={14} />Payment received</span>}
                    {booking.opportunity_location && <span><MapPin size={14} />{booking.opportunity_location}</span>}
                    {booking.started_at && <span><CalendarDays size={14} />Started {formatDate(booking.started_at)}</span>}
                    {booking.session_start_at && <span><CalendarDays size={14} />Session {formatDate(booking.session_start_at)} ({booking.session_duration_minutes} min)</span>}
                    {booking.session_details && <span>{booking.session_details}</span>}
                    {booking.status === "in_progress" && <span><Clock3 size={14} />Work in progress</span>}
                  </div>
                  {booking.status === "completed" && (
                    <p className="provider-bookings__no-action">
                      This booking is complete. No further action is required.
                    </p>
                  )}
                </div>
                {(canContactCustomer(booking.status) ||
                  booking.status === "pending" ||
                  booking.status === "accepted" ||
                  booking.status === "in_progress") && (
                  <div className="client-bookings__actions">
                    {canContactCustomer(booking.status) && (
                      <button type="button" className="client-bookings__secondary-action" onClick={() => handleContactCustomer(booking)} disabled={Boolean(processingId)}>
                        <MessageCircle size={15} />Contact client
                      </button>
                    )}
                    {booking.status === "pending" && <button type="button" className="client-bookings__secondary-action" onClick={() => setConfirmation({ type: "withdraw", booking })} disabled={Boolean(processingId)}>Withdraw</button>}
                    {booking.status === "accepted" && <button type="button" className="client-bookings__primary-action" onClick={() => setConfirmation({ type: "start", booking })} disabled={booking.payment_status !== "paid" || Boolean(processingId)}>{booking.payment_status === "paid" ? "Start job" : "Awaiting payment"}</button>}
                    {booking.status === "in_progress" && <button type="button" className="client-bookings__primary-action" onClick={() => setConfirmation({ type: "complete", booking })} disabled={Boolean(processingId)}><CheckCircle2 size={16} />Mark complete</button>}
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="client-bookings__empty"><div className="client-bookings__empty-icon"><CalendarDays size={23} strokeWidth={1.7} /></div><h2>{search || filter !== "all" ? "No matching bookings" : "No bookings yet"}</h2><p>{search || filter !== "all" ? "Try another search or status filter." : "Jobs you apply for will appear here so you can track their progress."}</p></div>
        )}
      </section>
      {confirmation && (
        <div className="client-bookings__modal">
          <button type="button" className="client-bookings__modal-backdrop" onClick={() => setConfirmation(null)} aria-label="Close booking confirmation" disabled={Boolean(processingId)} />
          <section className="client-bookings__modal-dialog" role="dialog" aria-modal="true" aria-labelledby="provider-booking-action">
            <button type="button" className="client-bookings__modal-close" onClick={() => setConfirmation(null)} aria-label="Close" disabled={Boolean(processingId)}><X size={18} /></button>
            <div className="client-bookings__modal-icon"><BriefcaseBusiness size={21} /></div>
            <div className="client-bookings__modal-copy"><h2 id="provider-booking-action">{actionDetails[confirmation.type].title}</h2><p>{actionDetails[confirmation.type].message}</p><strong>{confirmation.booking.opportunity_title}</strong></div>
            <div className="client-bookings__modal-actions"><button type="button" className="client-bookings__modal-cancel" onClick={() => setConfirmation(null)} disabled={Boolean(processingId)}>Go back</button><button type="button" className="client-bookings__modal-confirm" onClick={applyAction} disabled={Boolean(processingId)}>{processingId ? "Updating..." : actionDetails[confirmation.type].label}</button></div>
          </section>
        </div>
      )}
    </div>
  );
}

export default Bookings;
