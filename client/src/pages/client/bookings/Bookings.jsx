import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MapPin,
  Search,
  Star,
  UserRound,
  X,
} from "lucide-react";

import {
  acceptBooking,
  cancelBooking,
  confirmBooking,
  declineBooking,
  getMyBookings,
  scheduleBookingSession,
} from "../../../services/bookingService";
import { initializePayment } from "../../../services/paymentService";
import { createReview } from "../../../services/reviewService";

import "./Bookings.css";

const filters = [
  { label: "All bookings", value: "all" },
  { label: "Applications", value: "pending" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

const actionDetails = {
  accept: {
    title: "Accept this provider?",
    message:
      "This provider will be selected for the request. Other pending applications for the same request will be cancelled.",
    confirmLabel: "Accept provider",
  },
  decline: {
    title: "Decline this application?",
    message: "This provider application will be cancelled.",
    confirmLabel: "Decline application",
  },
  cancel: {
    title: "Cancel this booking?",
    message:
      "You can only cancel before payment has started. The request may become available to other providers again.",
    confirmLabel: "Cancel booking",
  },
  confirm: {
    title: "Confirm the work is complete?",
    message:
      "Confirming completion releases the booking payment to the provider. Only continue if the agreed work is finished.",
    confirmLabel: "Confirm completion",
  },
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatAmount = (amount, currency = "NGN") => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return "Amount unavailable";

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(numericAmount);
};

const getStatusLabel = (booking) => {
  if (booking.status === "completed" && booking.customer_confirmed_at) {
    return "Confirmed";
  }

  if (
    booking.status === "accepted" &&
    ["paid", "released"].includes(booking.payment_status)
  ) {
    return "Payment received";
  }

  const labels = {
    pending: "Application received",
    accepted: "Awaiting payment",
    in_progress: "In progress",
    completed: "Awaiting your confirmation",
    cancelled: "Cancelled",
  };

  return labels[booking.status] || booking.status || "Unknown";
};

const matchesFilter = (booking, filter) => {
  if (filter === "all") return true;
  if (filter === "active") {
    return ["accepted", "in_progress"].includes(booking.status);
  }
  return booking.status === filter;
};

function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [confirmation, setConfirmation] = useState(null);
  const [sessionBooking, setSessionBooking] = useState(null);
  const [sessionForm, setSessionForm] = useState({
    start: "",
    duration: "60",
    details: "",
  });
  const [processingId, setProcessingId] = useState("");
  const [reviewBooking, setReviewBooking] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    let active = true;

    const loadBookings = async () => {
      try {
        const data = await getMyBookings();
        if (active) setBookings(data?.bookings || []);
      } catch (loadError) {
        if (active) {
          setError(
            loadError.response?.data?.message ||
              "Unable to load your bookings. Please try again.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadBookings();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!confirmation) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !processingId) {
        setConfirmation(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [confirmation, processingId]);

  const counts = useMemo(
    () =>
      bookings.reduce(
        (total, booking) => {
          total.all += 1;
          if (Object.hasOwn(total, booking.status)) {
            total[booking.status] += 1;
          }
          if (["accepted", "in_progress"].includes(booking.status)) {
            total.active += 1;
          }
          return total;
        },
        { all: 0, pending: 0, active: 0, completed: 0, cancelled: 0 },
      ),
    [bookings],
  );

  const visibleBookings = useMemo(() => {
    const query = search.trim().toLowerCase();

    return bookings.filter((booking) => {
      if (!matchesFilter(booking, activeFilter)) return false;
      if (!query) return true;

      const providerName = [
        booking.provider_first_name,
        booking.provider_last_name,
      ]
        .filter(Boolean)
        .join(" ");

      return [
        booking.opportunity_title,
        booking.service_title,
        booking.provider_username,
        providerName,
        booking.opportunity_location,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [activeFilter, bookings, search]);

  const confirmBookingAction = async () => {
    if (!confirmation) return;

    const { type, booking } = confirmation;
    const action = {
      accept: acceptBooking,
      decline: declineBooking,
      cancel: cancelBooking,
      confirm: confirmBooking,
    }[type];

    setError("");
    setProcessingId(booking.id);

    try {
      const data = await action(booking.id);
      setBookings((current) =>
        current.map((item) => {
          if (item.id === booking.id) return { ...item, ...data.booking };
          if (
            type === "accept" &&
            item.opportunity_id === booking.opportunity_id &&
            item.status === "pending"
          ) {
            return { ...item, status: "cancelled" };
          }
          return item;
        }),
      );
      setConfirmation(null);
    } catch (actionError) {
      setError(
        actionError.response?.data?.message ||
          "Unable to update this booking. Please try again.",
      );
      setConfirmation(null);
    } finally {
      setProcessingId("");
    }
  };

  const submitReview = async (event) => {
    event.preventDefault();
    if (!reviewBooking) return;

    setSubmittingReview(true);
    setError("");

    try {
      await createReview({
        bookingId: reviewBooking.id,
        rating: reviewRating,
        review: reviewText,
      });
      setBookings((current) =>
        current.map((booking) =>
          booking.id === reviewBooking.id
            ? { ...booking, has_review: true }
            : booking,
        ),
      );
      setReviewBooking(null);
      setReviewText("");
      setReviewRating(5);
    } catch (reviewError) {
      setError(
        reviewError.response?.data?.message ||
          "Unable to submit your review.",
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  const providerName = (booking) => {
    const name = [booking.provider_first_name, booking.provider_last_name]
      .filter(Boolean)
      .join(" ");
    return name || booking.provider_username || "Service provider";
  };

  const openSessionForm = (booking) => {
    setSessionBooking(booking);
    setSessionForm({
      start: booking.session_start_at
        ? new Date(booking.session_start_at).toISOString().slice(0, 16)
        : "",
      duration: String(booking.session_duration_minutes || 60),
      details: booking.session_details || "",
    });
  };

  const saveSession = async (event) => {
    event.preventDefault();
    if (!sessionBooking) return;

    setError("");
    setProcessingId(sessionBooking.id);
    try {
      const data = await scheduleBookingSession(sessionBooking.id, {
        sessionStartAt: sessionForm.start,
        sessionDurationMinutes: Number(sessionForm.duration),
        sessionDetails: sessionForm.details,
      });
      setBookings((current) =>
        current.map((item) =>
          item.id === sessionBooking.id ? { ...item, ...data.booking } : item,
        ),
      );
      setSessionBooking(null);
    } catch (sessionError) {
      setError(
        sessionError.response?.data?.message ||
          "Unable to schedule this booking session.",
      );
    } finally {
      setProcessingId("");
    }
  };

  const handlePayNow = async (booking) => {
    if (processingId) return;

    setError("");
    setProcessingId(booking.id);

    try {
      const data = await initializePayment(booking.id);
      const checkoutUrl = data?.checkout?.authorization_url;

      if (!checkoutUrl) {
        throw new Error("The payment provider did not return a checkout link.");
      }

      window.location.assign(checkoutUrl);
    } catch (paymentError) {
      setError(
        paymentError.response?.data?.message ||
          paymentError.message ||
          "Unable to start checkout. Please try again.",
      );
      setProcessingId("");
    }
  };

  return (
    <div className="client-bookings">
      <header className="client-bookings__header">
        <div>
          <span className="client-bookings__eyebrow">YOUR WORKSPACE</span>
          <h1>Bookings</h1>
          <p>
            Review provider applications and track the work you have booked.
          </p>
        </div>
      </header>

      <section className="client-bookings__content" aria-label="Your bookings">
        <div className="client-bookings__toolbar">
          <div
            className="client-bookings__filters"
            role="tablist"
            aria-label="Filter bookings"
          >
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={activeFilter === filter.value}
                className={
                  activeFilter === filter.value
                    ? "client-bookings__filter is-active"
                    : "client-bookings__filter"
                }
                onClick={() => setActiveFilter(filter.value)}
              >
                {filter.label}
                <span>{counts[filter.value]}</span>
              </button>
            ))}
          </div>

          <label className="client-bookings__search">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search bookings"
              aria-label="Search bookings"
            />
          </label>
        </div>

        {error && (
          <p className="client-bookings__alert" role="alert">
            <AlertCircle size={17} />
            {error}
          </p>
        )}

        {loading ? (
          <div className="client-bookings__state" role="status">
            Loading bookings...
          </div>
        ) : visibleBookings.length > 0 ? (
          <div className="client-bookings__list">
            {visibleBookings.map((booking) => (
              <article className="client-bookings__item" key={booking.id}>
                <div className="client-bookings__item-main">
                  <div className="client-bookings__item-topline">
                    <span
                      className={`client-bookings__status client-bookings__status--${booking.status}`}
                    >
                      <span />
                      {getStatusLabel(booking)}
                    </span>
                    <span className="client-bookings__posted-date">
                      Applied {formatDate(booking.created_at)}
                    </span>
                  </div>

                  <h2>{booking.opportunity_title || "Service request"}</h2>
                  <p className="client-bookings__service">
                    {booking.service_title || "Provider application"}
                  </p>

                  <div className="client-bookings__details">
                    <Link
                      to={`/client/provider-profile/${booking.provider_id}`}
                      className="client-bookings__provider"
                    >
                      {booking.provider_avatar_url ? (
                        <img src={booking.provider_avatar_url} alt="" />
                      ) : (
                        <span className="client-bookings__avatar-fallback">
                          <UserRound size={15} />
                        </span>
                      )}
                      <span>{providerName(booking)}</span>
                      <ArrowUpRight size={13} />
                    </Link>

                    <span>
                      <BriefcaseBusiness size={14} />
                      {formatAmount(booking.agreed_amount, booking.currency)}
                    </span>

                    {booking.opportunity_location && (
                      <span>
                        <MapPin size={14} />
                        {booking.opportunity_location}
                      </span>
                    )}

                    {booking.started_at && (
                      <span>
                        <CalendarDays size={14} />
                        Started {formatDate(booking.started_at)}
                      </span>
                    )}

                    {booking.status === "in_progress" && (
                      <span>
                        <Clock3 size={14} />
                        Work in progress
                      </span>
                    )}

                    {booking.session_start_at && (
                      <span>
                        <CalendarDays size={14} />
                        Session {formatDate(booking.session_start_at)} at{" "}
                        {new Intl.DateTimeFormat("en", {
                          hour: "numeric",
                          minute: "2-digit",
                        }).format(new Date(booking.session_start_at))}
                      </span>
                    )}
                  </div>
                </div>

                <div className="client-bookings__actions">
                  {booking.status === "pending" && (
                    <>
                      <button
                        type="button"
                        className="client-bookings__secondary-action"
                        onClick={() =>
                          setConfirmation({ type: "decline", booking })
                        }
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        className="client-bookings__primary-action"
                        onClick={() =>
                          setConfirmation({ type: "accept", booking })
                        }
                      >
                        Accept
                      </button>
                    </>
                  )}

                  {booking.status === "accepted" && (
                    <>
                      <button
                        type="button"
                        className="client-bookings__secondary-action"
                        onClick={() => openSessionForm(booking)}
                      >
                        {booking.session_start_at
                          ? "Edit session"
                          : "Schedule session"}
                      </button>
                      {!["paid", "released"].includes(
                        booking.payment_status,
                      ) && (
                        <button
                          type="button"
                          className="client-bookings__primary-action"
                          onClick={() => handlePayNow(booking)}
                          disabled={Boolean(processingId)}
                        >
                          <ExternalLink size={16} />
                          {processingId === booking.id
                            ? "Opening checkout..."
                            : "Pay now"}
                        </button>
                      )}
                      <Link
                        to="/client/payments"
                        className="client-bookings__secondary-action"
                      >
                        Payment history
                      </Link>
                      <button
                        type="button"
                        className="client-bookings__secondary-action"
                        onClick={() =>
                          setConfirmation({ type: "cancel", booking })
                        }
                      >
                        Cancel booking
                      </button>
                    </>
                  )}

                  {booking.status === "completed" &&
                    !booking.customer_confirmed_at && (
                      <button
                        type="button"
                        className="client-bookings__primary-action"
                        onClick={() =>
                          setConfirmation({ type: "confirm", booking })
                        }
                      >
                        <CheckCircle2 size={16} />
                        Confirm completion
                      </button>
                    )}
                  {booking.status === "completed" &&
                    booking.customer_confirmed_at &&
                    !booking.has_review && (
                      <button
                        type="button"
                        className="client-bookings__secondary-action"
                        onClick={() => setReviewBooking(booking)}
                      >
                        <Star size={15} />
                        Review provider
                      </button>
                    )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="client-bookings__empty">
            <div className="client-bookings__empty-icon">
              <CalendarDays size={23} strokeWidth={1.7} />
            </div>
            <h2>
              {search || activeFilter !== "all"
                ? "No matching bookings"
                : "No bookings yet"}
            </h2>
            <p>
              {search || activeFilter !== "all"
                ? "Try another search or status filter."
                : "When a provider applies to one of your requests, their application will appear here."}
            </p>
          </div>
        )}
      </section>

      {confirmation && (
        <div className="client-bookings__modal">
          <button
            type="button"
            className="client-bookings__modal-backdrop"
            onClick={() => setConfirmation(null)}
            aria-label="Close booking confirmation"
            disabled={Boolean(processingId)}
          />

          <section
            className="client-bookings__modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-confirmation-title"
            aria-describedby="booking-confirmation-description"
          >
            <button
              type="button"
              className="client-bookings__modal-close"
              onClick={() => setConfirmation(null)}
              aria-label="Close"
              disabled={Boolean(processingId)}
            >
              <X size={18} strokeWidth={1.8} />
            </button>

            <div className="client-bookings__modal-icon">
              <BriefcaseBusiness size={21} strokeWidth={1.8} />
            </div>

            <div className="client-bookings__modal-copy">
              <h2 id="booking-confirmation-title">
                {actionDetails[confirmation.type].title}
              </h2>
              <p id="booking-confirmation-description">
                {actionDetails[confirmation.type].message}
              </p>
              <strong>{confirmation.booking.opportunity_title}</strong>
            </div>

            <div className="client-bookings__modal-actions">
              <button
                type="button"
                className="client-bookings__modal-cancel"
                onClick={() => setConfirmation(null)}
                disabled={Boolean(processingId)}
                autoFocus
              >
                Go back
              </button>
              <button
                type="button"
                className="client-bookings__modal-confirm"
                onClick={confirmBookingAction}
                disabled={Boolean(processingId)}
              >
                {processingId
                  ? "Updating..."
                  : actionDetails[confirmation.type].confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}
      {reviewBooking && (
        <div className="client-bookings__modal">
          <button
            type="button"
            className="client-bookings__modal-backdrop"
            onClick={() => !submittingReview && setReviewBooking(null)}
            aria-label="Close review form"
          />
          <section
            className="client-bookings__modal-dialog client-bookings__review-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-booking-title"
          >
            <button
              type="button"
              className="client-bookings__modal-close"
              onClick={() => setReviewBooking(null)}
              aria-label="Close review form"
              disabled={submittingReview}
            >
              <X size={18} />
            </button>
            <div className="client-bookings__review-icon">
              <Star size={22} fill="currentColor" />
            </div>
            <div className="client-bookings__modal-copy client-bookings__review-copy">
              <span className="client-bookings__review-eyebrow">YOUR FEEDBACK</span>
              <h2 id="review-booking-title">Review your provider</h2>
              <p>
                Share how <strong>{providerName(reviewBooking)}</strong> handled
                your booking.
              </p>
            </div>
            <form className="client-bookings__review-form" onSubmit={submitReview}>
              <fieldset className="client-bookings__review-rating">
                <legend>How would you rate this service?</legend>
                <div className="client-bookings__star-options">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={
                        value <= reviewRating
                          ? "client-bookings__star-option is-selected"
                          : "client-bookings__star-option"
                      }
                      onClick={() => setReviewRating(value)}
                      aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                      aria-pressed={value === reviewRating}
                    >
                      <Star size={24} fill="currentColor" />
                    </button>
                  ))}
                </div>
                <span className="client-bookings__rating-label">
                  {reviewRating} of 5 stars
                </span>
              </fieldset>
              <label className="client-bookings__review-field">
                Comment <span>Optional</span>
                <textarea
                  rows="4"
                  value={reviewText}
                  onChange={(event) => setReviewText(event.target.value)}
                  placeholder="Share your experience (optional)"
                />
              </label>
              <div className="client-bookings__modal-actions">
                <button
                  type="button"
                  className="client-bookings__modal-cancel"
                  onClick={() => setReviewBooking(null)}
                  disabled={submittingReview}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="client-bookings__modal-confirm"
                  disabled={submittingReview}
                >
                  {submittingReview ? "Submitting..." : "Submit review"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {sessionBooking && (
        <div className="client-bookings__modal">
          <button
            type="button"
            className="client-bookings__modal-backdrop"
            onClick={() => setSessionBooking(null)}
            aria-label="Close session form"
            disabled={Boolean(processingId)}
          />
          <form
            className="client-bookings__modal-dialog"
            onSubmit={saveSession}
          >
            <button
              type="button"
              className="client-bookings__modal-close"
              onClick={() => setSessionBooking(null)}
              aria-label="Close"
              disabled={Boolean(processingId)}
            >
              <X size={18} />
            </button>
            <div className="client-bookings__modal-icon">
              <CalendarDays size={21} />
            </div>
            <div className="client-bookings__modal-copy">
              <h2>Schedule booking session</h2>
              <p>Choose when the agreed work will take place.</p>
              <strong>{sessionBooking.opportunity_title}</strong>
            </div>
            <label className="client-bookings__session-field">
              Start date and time
              <input
                type="datetime-local"
                required
                value={sessionForm.start}
                onChange={(event) =>
                  setSessionForm((form) => ({
                    ...form,
                    start: event.target.value,
                  }))
                }
              />
            </label>
            <label className="client-bookings__session-field">
              Duration (minutes)
              <input
                type="number"
                min="15"
                max="1440"
                step="15"
                required
                value={sessionForm.duration}
                onChange={(event) =>
                  setSessionForm((form) => ({
                    ...form,
                    duration: event.target.value,
                  }))
                }
              />
            </label>
            <label className="client-bookings__session-field">
              Session details
              <textarea
                maxLength="1000"
                value={sessionForm.details}
                onChange={(event) =>
                  setSessionForm((form) => ({
                    ...form,
                    details: event.target.value,
                  }))
                }
                placeholder="Add location, preparation notes, or access details"
              />
            </label>
            <div className="client-bookings__modal-actions">
              <button
                type="button"
                className="client-bookings__modal-cancel"
                onClick={() => setSessionBooking(null)}
                disabled={Boolean(processingId)}
              >
                Go back
              </button>
              <button
                type="submit"
                className="client-bookings__modal-confirm"
                disabled={Boolean(processingId)}
              >
                {processingId ? "Saving..." : "Save session"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default Bookings;
