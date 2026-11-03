import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  AlertCircle,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  MapPin,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { getCategories } from "../../../services/categoryService";
import {
  createOpportunity,
  deleteOpportunity,
  getMyOpportunities,
  withdrawOpportunity,
} from "../../../services/opportunityService";

import "./Requests.css";

const filters = [
  { label: "All requests", value: "all" },
  { label: "Open", value: "open" },
  { label: "Booked", value: "taken" },
  { label: "Expired", value: "expired" },
  { label: "Withdrawn", value: "withdrawn" },
];

const getDateInputValue = (daysFromNow = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const makeInitialForm = () => {
  return {
    title: "",
    description: "",
    categoryId: "",
    providerId: "",
    locationText: "",
    expiresAt: getDateInputValue(7),
  };
};

const formatDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatStatus = (status) => {
  if (!status) return "Unknown";
  if (status === "taken") return "Booked";
  return status.charAt(0).toUpperCase() + status.slice(1);
};

function Requests() {
  const location = useLocation();
  const [requests, setRequests] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [showForm, setShowForm] = useState(
    Boolean(location.state?.serviceId),
  );
  const [submitting, setSubmitting] = useState(false);
  const [pendingRequestAction, setPendingRequestAction] = useState("");
  const [requestAction, setRequestAction] = useState(null);
  const [formData, setFormData] = useState(() => ({
    ...makeInitialForm(),
    ...(location.state?.serviceId
      ? {
          title: location.state.title || "",
          description: location.state.description || "",
          categoryId: location.state.categoryId || "",
          locationText: location.state.locationText || "",
          providerId: location.state.providerId || "",
        }
      : {}),
  }));

  useEffect(() => {
    let active = true;

    const loadRequests = async () => {
      try {
        const data = await getMyOpportunities();
        if (active) setRequests(data?.opportunities || []);
      } catch (loadError) {
        if (active) {
          setError(
            loadError.response?.data?.message ||
              "Unable to load your requests. Please try again.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    const loadCategories = async () => {
      try {
        const data = await getCategories();
        if (active) setCategories(data?.categories || []);
      } catch {
        if (active) setFormError("Categories could not be loaded.");
      } finally {
        if (active) setCategoriesLoading(false);
      }
    };

    loadRequests();
    loadCategories();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!requestAction) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !pendingRequestAction) {
        setRequestAction(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pendingRequestAction, requestAction]);

  const counts = useMemo(
    () =>
      requests.reduce(
        (total, request) => {
          total.all += 1;
          if (Object.hasOwn(total, request.status)) {
            total[request.status] += 1;
          }
          return total;
        },
        { all: 0, open: 0, taken: 0, expired: 0, withdrawn: 0 },
      ),
    [requests],
  );

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesFilter =
        activeFilter === "all" || request.status === activeFilter;
      const matchesSearch =
        !query ||
        [request.title, request.category_name, request.location_text]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));

      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, requests, search]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleCreateRequest = async (event) => {
    event.preventDefault();
    setFormError("");

    try {
      setSubmitting(true);
      const data = await createOpportunity({
        ...formData,
        providerId: formData.providerId || undefined,
        expiresAt: new Date(`${formData.expiresAt}T23:59:59`).toISOString(),
      });

      setRequests((current) => [data.opportunity, ...current]);
      setFormData(makeInitialForm());
      setShowForm(false);
    } catch (submitError) {
      setFormError(
        submitError.response?.data?.message ||
          "Unable to create your request. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openRequestAction = (request, action) => {
    setRequestAction({ request, action });
  };

  const confirmRequestAction = async () => {
    if (!requestAction) return;

    const { request, action } = requestAction;
    setError("");
    setPendingRequestAction(action);

    try {
      if (action === "withdraw") {
        const data = await withdrawOpportunity(request.id);
        setRequests((current) =>
          current.map((item) =>
            item.id === request.id ? data.opportunity : item,
          ),
        );
      } else {
        await deleteOpportunity(request.id);
        setRequests((current) =>
          current.filter((item) => item.id !== request.id),
        );
      }
      setRequestAction(null);
    } catch (actionError) {
      setError(
        actionError.response?.data?.message ||
          `Unable to ${action} this request. Please try again.`,
      );
      setRequestAction(null);
    } finally {
      setPendingRequestAction("");
    }
  };

  const isDeleteAction = requestAction?.action === "delete";

  return (
    <div className="client-requests">
      <header className="client-requests__header">
        <div>
          <span className="client-requests__eyebrow">YOUR WORKSPACE</span>
          <h1>My requests</h1>
          <p>Keep track of the work you need done and its current status.</p>
        </div>

        <button
          type="button"
          className="client-requests__new-button"
          onClick={() => {
            setShowForm((current) => !current);
            setFormError("");
          }}
          aria-expanded={showForm}
        >
          {showForm ? <X size={17} /> : <Plus size={17} />}
          <span>{showForm ? "Close form" : "New request"}</span>
        </button>
      </header>

      {showForm && (
        <form className="client-requests__form" onSubmit={handleCreateRequest}>
          <div className="client-requests__form-heading">
            <div>
              <span className="client-requests__section-label">
                TELL US WHAT YOU NEED
              </span>
              <h2>Create a request</h2>
            </div>
            <button
              type="button"
              className="client-requests__icon-button"
              onClick={() => setShowForm(false)}
              aria-label="Close request form"
            >
              <X size={18} />
            </button>
          </div>

          {formError && (
            <p className="client-requests__alert" role="alert">
              <AlertCircle size={17} />
              {formError}
            </p>
          )}

          <div className="client-requests__form-grid">
            <label className="client-requests__field">
              <span>Request title</span>
              <input
                name="title"
                value={formData.title}
                onChange={handleFormChange}
                placeholder="e.g. Repair a leaking kitchen tap"
                required
                maxLength={120}
                disabled={submitting}
              />
            </label>

            <label className="client-requests__field">
              <span>Category</span>
              <select
                name="categoryId"
                value={formData.categoryId}
                onChange={handleFormChange}
                required
                disabled={submitting || categoriesLoading}
              >
                <option value="">
                  {categoriesLoading
                    ? "Loading categories..."
                    : "Select a category"}
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="client-requests__field client-requests__field--wide">
              <span>Description</span>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleFormChange}
                placeholder="Add the details a professional should know."
                rows={4}
                required
                maxLength={2000}
                disabled={submitting}
              />
            </label>

            <label className="client-requests__field">
              <span>Location</span>
              <input
                name="locationText"
                value={formData.locationText}
                onChange={handleFormChange}
                placeholder="Area or neighborhood"
                maxLength={180}
                disabled={submitting}
              />
            </label>

            <label className="client-requests__field">
              <span>Keep request open until</span>
              <input
                name="expiresAt"
                type="date"
                value={formData.expiresAt}
                min={getDateInputValue()}
                onChange={handleFormChange}
                required
                disabled={submitting}
              />
            </label>
          </div>

          <div className="client-requests__form-actions">
            <button
              type="button"
              className="client-requests__cancel-button"
              onClick={() => setShowForm(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="client-requests__new-button"
              disabled={
                submitting || categoriesLoading || categories.length === 0
              }
            >
              <Plus size={17} />
              <span>{submitting ? "Publishing..." : "Publish request"}</span>
            </button>
          </div>
        </form>
      )}

      <section className="client-requests__content" aria-label="Your requests">
        <div className="client-requests__toolbar">
          <div
            className="client-requests__filters"
            role="tablist"
            aria-label="Filter requests"
          >
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={activeFilter === filter.value}
                className={
                  activeFilter === filter.value
                    ? "client-requests__filter is-active"
                    : "client-requests__filter"
                }
                onClick={() => setActiveFilter(filter.value)}
              >
                {filter.label}
                <span>{counts[filter.value]}</span>
              </button>
            ))}
          </div>

          <label className="client-requests__search">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search requests"
              aria-label="Search requests"
            />
          </label>
        </div>

        {error && (
          <p className="client-requests__alert" role="alert">
            <AlertCircle size={17} />
            {error}
          </p>
        )}

        {loading ? (
          <div className="client-requests__message-state" role="status">
            Loading requests...
          </div>
        ) : visibleRequests.length > 0 ? (
          <div className="client-requests__list">
            {visibleRequests.map((request) => (
              <article className="client-requests__item" key={request.id}>
                <div className="client-requests__item-main">
                  <div className="client-requests__item-heading">
                    <span className="client-requests__category">
                      <BriefcaseBusiness size={14} />
                      {request.category_name || "Service request"}
                    </span>
                    <span
                      className={`client-requests__status client-requests__status--${request.status}`}
                    >
                      <span />
                      {formatStatus(request.status)}
                    </span>
                  </div>

                  <h2>{request.title}</h2>
                  <p className="client-requests__description">
                    {request.description}
                  </p>

                  <div className="client-requests__metadata">
                    {request.location_text && (
                      <span>
                        <MapPin size={14} />
                        {request.location_text}
                      </span>
                    )}
                    <span>
                      <CalendarDays size={14} />
                      Posted {formatDate(request.created_at)}
                    </span>
                    {request.status === "open" && (
                      <span>
                        <Clock3 size={14} />
                        Closes {formatDate(request.expires_at)}
                      </span>
                    )}
                    {request.application_count > 0 && (
                      <span>
                        <BriefcaseBusiness size={14} />
                        {request.application_count} application
                        {request.application_count === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="client-requests__item-actions">
                  {request.status === "taken" && (
                    <Link
                      to="/client/bookings"
                      className="client-requests__booking-link"
                    >
                      View booking
                    </Link>
                  )}
                  {request.status === "open" && (
                    <button
                      type="button"
                      className="client-requests__withdraw"
                      onClick={() => openRequestAction(request, "withdraw")}
                      disabled={Boolean(pendingRequestAction)}
                    >
                      Withdraw
                    </button>
                  )}
                  <button
                    type="button"
                    className="client-requests__delete"
                    onClick={() => openRequestAction(request, "delete")}
                    disabled={Boolean(pendingRequestAction)}
                    aria-label={`Delete ${request.title}`}
                    title="Delete request"
                  >
                    <Trash2 size={16} strokeWidth={1.8} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="client-requests__empty">
            <div className="client-requests__empty-icon">
              <BriefcaseBusiness size={23} strokeWidth={1.7} />
            </div>
            <h2>
              {search || activeFilter !== "all"
                ? "No matching requests"
                : "No requests yet"}
            </h2>
            <p>
              {search || activeFilter !== "all"
                ? "Try another search or status filter."
                : "Post a request to describe the work you need and let professionals find you."}
            </p>
            {!search && activeFilter === "all" && (
              <button
                type="button"
                className="client-requests__new-button"
                onClick={() => setShowForm(true)}
              >
                <Plus size={17} />
                <span>Create your first request</span>
              </button>
            )}
          </div>
        )}
      </section>

      {requestAction && (
        <div className="client-requests__modal">
          <button
            type="button"
            className="client-requests__modal-backdrop"
            onClick={() => setRequestAction(null)}
            aria-label="Close request action confirmation"
            disabled={Boolean(pendingRequestAction)}
          />

          <section
            className="client-requests__modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-action-title"
            aria-describedby="request-action-description"
          >
            <button
              type="button"
              className="client-requests__modal-close"
              onClick={() => setRequestAction(null)}
              aria-label="Close"
              disabled={Boolean(pendingRequestAction)}
            >
              <X size={18} strokeWidth={1.8} />
            </button>

            <div className="client-requests__modal-icon">
              {isDeleteAction ? (
                <Trash2 size={21} strokeWidth={1.8} />
              ) : (
                <BriefcaseBusiness size={21} strokeWidth={1.8} />
              )}
            </div>

            <div className="client-requests__modal-content">
              <h2 id="request-action-title">
                {isDeleteAction
                  ? "Delete this request?"
                  : "Withdraw this request?"}
              </h2>
              <p id="request-action-description">
                {isDeleteAction
                  ? `“${requestAction.request.title}” will be permanently removed. Requests with provider applications or bookings cannot be deleted.`
                  : `“${requestAction.request.title}” will no longer be visible to providers. You can’t reopen it after withdrawing.`}
              </p>
            </div>

            <div className="client-requests__modal-actions">
              <button
                type="button"
                className="client-requests__modal-cancel"
                onClick={() => setRequestAction(null)}
                disabled={Boolean(pendingRequestAction)}
                autoFocus
              >
                Keep request
              </button>

              <button
                type="button"
                className={`client-requests__modal-confirm ${
                  isDeleteAction ? "client-requests__modal-confirm--danger" : ""
                }`}
                onClick={confirmRequestAction}
                disabled={Boolean(pendingRequestAction)}
              >
                {pendingRequestAction
                  ? isDeleteAction
                    ? "Deleting..."
                    : "Withdrawing..."
                  : isDeleteAction
                    ? "Delete request"
                    : "Withdraw request"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default Requests;
