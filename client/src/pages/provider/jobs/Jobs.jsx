import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Folder,
  MapPin,
  Search,
  Send,
  Wrench,
  X,
} from "lucide-react";
import {
  applyForOpportunity,
  getMyBookings,
} from "../../../services/bookingService";
import { getCategories } from "../../../services/categoryService";
import { getOpenOpportunities } from "../../../services/opportunityService";
import { getMyServices } from "../../../services/serviceService";
import "./Jobs.css";

const date = (value, fallback = "Date unavailable") => {
  if (!value) return fallback;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
};

function Jobs() {
  const [jobs, setJobs] = useState([]),
    [categories, setCategories] = useState([]),
    [services, setServices] = useState([]),
    [applied, setApplied] = useState(new Set());
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [job, setJob] = useState(null),
    [serviceId, setServiceId] = useState(""),
    [amount, setAmount] = useState(""),
    [formError, setFormError] = useState(""),
    [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    let mounted = true;
    Promise.all([
      getOpenOpportunities(),
      getCategories(),
      getMyServices(),
      getMyBookings(),
    ])
      .then(([opportunities, cats, mine, bookings]) => {
        if (!mounted) return;
        setJobs(opportunities?.opportunities || []);
        setCategories(cats?.categories || []);
        setServices((mine?.services || []).filter((service) => service.is_active));
        setApplied(
          new Set(
            (bookings?.bookings || [])
              .filter((booking) => booking.opportunity_id)
              .map((booking) => String(booking.opportunity_id)),
          ),
        );
      })
      .catch(
        (e) =>
          mounted &&
          setError(
            e.response?.data?.message || "Unable to load available jobs.",
          ),
      )
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);
  const visible = useMemo(() => {
    const term = search.toLowerCase();
    return jobs.filter(
      (item) =>
        (!category || String(item.category_id) === category) &&
        (!term ||
          [item.title, item.description, item.category_name, item.location_text]
            .filter(Boolean)
            .some((x) => x.toLowerCase().includes(term))),
    );
  }, [jobs, category, search]);
  const apply = async (event) => {
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
        opportunityId: job.id,
        serviceId,
        agreedAmount: proposedAmount,
      });
      setApplied((current) => new Set([...current, String(job.id)]));
      setJob(null);
    } catch (e) {
      setFormError(
        e.response?.data?.message || "Unable to submit your application.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="provider-jobs">
      <header className="provider-jobs__hero">
        <div className="provider-jobs__intro">
          <span className="provider-jobs__eyebrow">PROVIDER MARKETPLACE</span>
          <h1>Find work that fits your expertise.</h1>
          <p>
            Explore open customer requests, discover the right opportunities,
            and apply with one of your published services.
          </p>
        </div>
        <div className="provider-jobs__count">
          <BriefcaseBusiness size={18} />
          <div>
            <strong>{loading ? "—" : jobs.length}</strong>
            <span>open jobs</span>
          </div>
        </div>
      </header>

      <section className="provider-jobs__search-section">
        <label className="provider-jobs__search">
          <Search size={17} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs, skills or locations"
          />
        </label>
      </section>

      <section className="provider-jobs__categories" aria-label="Filter jobs by category">
        <div className="provider-jobs__section-heading">
          <span>BROWSE</span>
          <h2>Categories</h2>
        </div>
        <div className="provider-jobs__category-list">
          <button
            type="button"
            className={!category ? "is-active" : ""}
            onClick={() => setCategory("")}
          >
            <Wrench size={16} />
            All jobs
          </button>
          {categories.map((item) => (
            <button
              type="button"
              key={item.id}
              className={category === String(item.id) ? "is-active" : ""}
              onClick={() => setCategory(String(item.id))}
            >
              <Folder size={16} />
              {item.name}
            </button>
          ))}
        </div>
      </section>

      <section className="provider-jobs__results-heading">
        <div>
          <span>OPEN OPPORTUNITIES</span>
          <h2>Available jobs</h2>
        </div>
        <p>{visible.length} matching opportunities</p>
      </section>

      {error ? (
        <div className="provider-jobs__message error">
          <AlertCircle size={18} />
          {error}
        </div>
      ) : loading ? (
        <div className="provider-jobs__message">Loading available jobs…</div>
      ) : visible.length ? (
        <section className="provider-jobs__grid" aria-label="Available jobs">
          {visible.map((item) => (
            <article key={item.id}>
              <div className="provider-jobs__top">
                <span className="provider-jobs__source">OPEN MARKETPLACE JOB</span>
                <small>
                  <Clock3 size={14} />
                  Expires {date(item.expires_at, "date unavailable")}
                </small>
              </div>
              <div className="provider-jobs__card-content">
                <h2>{item.title}</h2>
                <p>
                  {item.description || "No additional details were provided."}
                </p>
                <div className="provider-jobs__details">
                  <span>
                    <MapPin size={15} />
                    {item.location_text || "Location to be agreed"}
                  </span>
                  <span>
                    <CalendarDays size={15} />
                    Posted {date(item.created_at)}
                  </span>
                </div>
              </div>
              <footer>
                {applied.has(String(item.id)) ? (
                  <strong>
                    <CheckCircle2 size={16} />
                    Applied
                  </strong>
                ) : (
                  <button
                    onClick={() => {
                      setJob(item);
                      setServiceId("");
                      setAmount("");
                      setFormError("");
                    }}
                  >
                    Apply now <Send size={15} />
                  </button>
                )}
              </footer>
            </article>
          ))}
        </section>
      ) : (
        <div className="provider-jobs__message">
          <BriefcaseBusiness size={27} />
          <h2>No matching jobs</h2>
          <p>Try another search or check back soon.</p>
        </div>
      )}
      {job && (
        <div
          className="provider-jobs__backdrop"
            onMouseDown={() => !submitting && setJob(null)}
        >
          <section
            className="provider-jobs__modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              type="button"
              onClick={() => setJob(null)}
              disabled={submitting}
            >
              <X size={18} />
            </button>
            <span>APPLY FOR JOB</span>
            <h2>{job.title}</h2>
            <p>Choose your service and proposed amount.</p>
            <form onSubmit={apply}>
              {formError && (
                <div className="error">
                  <AlertCircle size={16} />
                  {formError}
                </div>
              )}
              <label>
                Your service
                <select
                  value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                  required
                >
                  <option value="">Select a service</option>
                  {services.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title || item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Proposed amount
                <div className="amount">
                  ₦
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
              </label>
              {!services.length && (
                <small>Add an active service before applying.</small>
              )}
              <button
                className="submit"
                disabled={submitting || !services.length}
              >
                {submitting ? "Submitting…" : "Submit application"}
                <Send size={15} />
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
export default Jobs;
