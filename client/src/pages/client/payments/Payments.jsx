import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Search,
} from "lucide-react";

import {
  getMyPayments,
  initializePayment,
  verifyPayment,
} from "../../../services/paymentService";

import "./Payments.css";

const filters = [
  { label: "All payments", value: "all" },
  { label: "Needs payment", value: "awaiting_payment" },
  { label: "Pending", value: "pending" },
  { label: "Paid", value: "paid" },
  { label: "Released", value: "released" },
  { label: "Other", value: "other" },
];

const getStatus = (payment) => {
  if (payment.payment_status) return payment.payment_status;
  return payment.booking_status === "accepted"
    ? "awaiting_payment"
    : payment.booking_status || "unknown";
};

const getStatusLabel = (status) => {
  const labels = {
    awaiting_payment: "Payment due",
    pending: "Payment pending",
    paid: "Paid",
    released: "Complete",
    refunded: "Refunded",
    failed: "Failed",
  };

  return labels[status] || status.replaceAll("_", " ");
};

const matchesFilter = (payment, filter) => {
  const status = getStatus(payment);
  if (filter === "all") return true;
  if (filter === "other") {
    return !["awaiting_payment", "pending", "paid", "released"].includes(
      status,
    );
  }
  return status === filter;
};

const formatCurrency = (amount, currency = "NGN") => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "Amount unavailable";

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (value) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

function Payments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [payments, setPayments] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startingPaymentId, setStartingPaymentId] = useState("");
  const [verifyingReference, setVerifyingReference] = useState("");
  const verificationAttempt = useRef("");
  const [checkingPaymentId, setCheckingPaymentId] = useState("");

  useEffect(() => {
    let active = true;

    const loadPayments = async () => {
      try {
        const data = await getMyPayments();
        if (active) setPayments(data?.payments || []);
      } catch (loadError) {
        if (active) {
          setError(
            loadError.response?.data?.message ||
              "Unable to load your payment activity. Please try again.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPayments();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const reference = searchParams.get("reference") || searchParams.get("trxref");
    if (!reference || verificationAttempt.current === reference) return;

    let active = true;
    verificationAttempt.current = reference;

    verifyPayment(reference)
      .then(() => {
        if (!active) return;
        setVerifyingReference(reference);
        setError("");
        setSearchParams({}, { replace: true });
        return getMyPayments();
      })
      .then((data) => {
        if (active && data) setPayments(data?.payments || []);
      })
      .catch((verifyError) => {
        if (active) {
          setVerifyingReference(reference);
          setSearchParams({}, { replace: true });
          setError(
            verifyError.response?.data?.message ||
              "Payment verification is still pending. Please refresh shortly.",
          );
        }
      })
      .finally(() => {
        if (active) setVerifyingReference("");
      });

    return () => {
      active = false;
    };
  }, [searchParams, setSearchParams]);

  const counts = useMemo(
    () =>
      payments.reduce(
        (total, payment) => {
          total.all += 1;
          const status = getStatus(payment);
          if (Object.hasOwn(total, status)) total[status] += 1;
          if (!Object.hasOwn(total, status)) total.other += 1;
          return total;
        },
        {
          all: 0,
          awaiting_payment: 0,
          pending: 0,
          paid: 0,
          released: 0,
          other: 0,
        },
      ),
    [payments],
  );

  const visiblePayments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return payments.filter((payment) => {
      if (!matchesFilter(payment, activeFilter)) return false;
      if (!query) return true;

      const providerName = [
        payment.provider_first_name,
        payment.provider_last_name,
      ]
        .filter(Boolean)
        .join(" ");

      return [
        payment.opportunity_title,
        payment.service_title,
        payment.provider_username,
        providerName,
        payment.provider_transaction_id,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [activeFilter, payments, search]);

  const totals = useMemo(() => {
    const settled = payments
      .filter((payment) => ["paid", "released"].includes(getStatus(payment)))
      .reduce((sum, payment) => sum + Number(payment.customer_total || 0), 0);
    const due = payments.filter(
      (payment) => getStatus(payment) === "awaiting_payment",
    ).length;

    return { settled, due };
  }, [payments]);

  const handlePayNow = async (payment) => {
    setError("");
    setStartingPaymentId(payment.booking_id);

    try {
      const data = await initializePayment(payment.booking_id);
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
      setStartingPaymentId("");
    }
  };

  const handleCheckPayment = async (payment) => {
    if (!payment.provider_transaction_id) return;

    setCheckingPaymentId(payment.booking_id);
    setError("");

    try {
      await verifyPayment(payment.provider_transaction_id);
      const data = await getMyPayments();
      setPayments(data?.payments || []);
    } catch (paymentError) {
      setError(
        paymentError.response?.data?.message ||
          "The payment is not confirmed yet. Please try again after checkout completes.",
      );
    } finally {
      setCheckingPaymentId("");
    }
  };

  return (
    <div className="client-payments">
      <header className="client-payments__header">
        <div>
          <span className="client-payments__eyebrow">YOUR WORKSPACE</span>
          <h1>Payments</h1>
          <p>Track checkout, payments, and completed transactions.</p>
        </div>
      </header>

      <section
        className="client-payments__summary"
        aria-label="Payment summary"
      >
        <div className="client-payments__summary-item">
          <span>Paid to date</span>
          <strong>{formatCurrency(totals.settled)}</strong>
        </div>
        <div className="client-payments__summary-item">
          <span>Awaiting payment</span>
          <strong>{totals.due}</strong>
        </div>
        <div className="client-payments__summary-item">
          <span>Payment records</span>
          <strong>{payments.length}</strong>
        </div>
      </section>

      <div className="client-payments__toolbar">
        <div
          className="client-payments__filters"
          role="tablist"
          aria-label="Filter payments"
        >
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              role="tab"
              aria-selected={activeFilter === filter.value}
              className={
                activeFilter === filter.value
                  ? "client-payments__filter is-active"
                  : "client-payments__filter"
              }
              onClick={() => setActiveFilter(filter.value)}
            >
              {filter.label}
              <span>{counts[filter.value]}</span>
            </button>
          ))}
        </div>

        <label className="client-payments__search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search payments"
            aria-label="Search payments"
          />
        </label>
      </div>

      {error && (
        <p className="client-payments__error" role="alert">
          <AlertCircle size={17} />
          {error}
        </p>
      )}

      {verifyingReference && (
        <p className="client-payments__error" role="status">
          Confirming your payment...
        </p>
      )}

      {loading ? (
        <div className="client-payments__state" role="status">
          Loading payment activity...
        </div>
      ) : visiblePayments.length > 0 ? (
        <div className="client-payments__list">
          {visiblePayments.map((payment) => {
            const status = getStatus(payment);
            const providerName = [
              payment.provider_first_name,
              payment.provider_last_name,
            ]
              .filter(Boolean)
              .join(" ");
            const amount = payment.customer_total ?? payment.agreed_amount;
            const currency = payment.currency || payment.booking_currency;
            const activityDate =
              payment.paid_at ||
              payment.payment_created_at ||
              payment.booking_created_at;
            const canPay =
              payment.booking_status === "accepted" &&
              !["paid", "released"].includes(status);

            return (
              <article
                className="client-payments__item"
                key={payment.booking_id}
              >
                <span
                  className={`client-payments__icon client-payments__icon--${status}`}
                >
                  {status === "paid" || status === "released" ? (
                    <CheckCircle2 size={19} />
                  ) : status === "pending" || status === "awaiting_payment" ? (
                    <Clock3 size={19} />
                  ) : (
                    <CircleDollarSign size={19} />
                  )}
                </span>

                <div className="client-payments__item-main">
                  <div className="client-payments__item-heading">
                    <h2>{payment.opportunity_title || "Service booking"}</h2>
                    <span
                      className={`client-payments__status client-payments__status--${status}`}
                    >
                      {getStatusLabel(status)}
                    </span>
                  </div>
                  <p className="client-payments__service">
                    {payment.service_title || "Service"}
                    {providerName && ` · ${providerName}`}
                  </p>
                  <div className="client-payments__metadata">
                    <span>
                      <CalendarDays size={13} />
                      {formatDate(activityDate)}
                    </span>
                    {payment.provider_transaction_id && (
                      <span>Reference {payment.provider_transaction_id}</span>
                    )}
                    {payment.platform_fee !== null &&
                      payment.platform_fee !== undefined && (
                        <span>
                          Platform fee{" "}
                          {formatCurrency(payment.platform_fee, currency)}
                        </span>
                      )}
                  </div>
                </div>

                <div className="client-payments__amount-block">
                  <strong>{formatCurrency(amount, currency)}</strong>
                  {canPay && (
                    <>
                      {payment.provider_transaction_id && (
                        <button
                          type="button"
                          className="client-payments__booking-link"
                          onClick={() => handleCheckPayment(payment)}
                          disabled={Boolean(checkingPaymentId)}
                        >
                          {checkingPaymentId === payment.booking_id
                            ? "Checking..."
                            : "Check payment status"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="client-payments__pay-button"
                        onClick={() => handlePayNow(payment)}
                        disabled={Boolean(startingPaymentId)}
                      >
                        <span>
                          {startingPaymentId === payment.booking_id
                            ? "Opening checkout..."
                            : "Pay now"}
                        </span>
                        <ExternalLink size={14} />
                      </button>
                    </>
                  )}
                  {!canPay && (
                    <Link
                      to={`/client/bookings`}
                      className="client-payments__booking-link"
                    >
                      View booking
                      <ArrowUpRight size={13} />
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="client-payments__empty">
          <span className="client-payments__empty-icon">
            <BriefcaseBusiness size={22} strokeWidth={1.6} />
          </span>
          <h2>
            {search || activeFilter !== "all"
              ? "No matching payments"
              : "No payment activity yet"}
          </h2>
          <p>
            {search || activeFilter !== "all"
              ? "Try another search or status filter."
              : "Payment activity will appear here when a provider application is accepted."}
          </p>
          {!search && activeFilter === "all" && (
            <Link
              to="/client/bookings"
              className="client-payments__browse-link"
            >
              Review bookings
              <ArrowUpRight size={14} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default Payments;
