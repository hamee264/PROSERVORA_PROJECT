import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Circle,
  MapPin,
  MessageCircle,
  Star,
} from "lucide-react";

import { getServiceById } from "../../../services/serviceService";
import { startConversation } from "../../../services/chatService";

import "./ServiceDetails.css";

function ServiceDetails() {
  const { serviceId } = useParams();
  const navigate = useNavigate();

  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [contacting, setContacting] = useState(false);

  useEffect(() => {
    const loadService = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await getServiceById(serviceId);

        setService(data?.service || data);
      } catch (error) {
        console.error("Failed to load service:", error);

        setError(
          error.response?.data?.message || "Unable to load this service.",
        );
      } finally {
        setLoading(false);
      }
    };

    if (serviceId) {
      loadService();
    }
  }, [serviceId]);

  const handleContact = async () => {
    if (!service?.provider_id || contacting) return;

    try {
      setContacting(true);
      setActionError("");
      const data = await startConversation(service.provider_id);
      const conversationId = data?.conversation?.id;

      if (!conversationId) {
        throw new Error("Unable to open this conversation.");
      }

      navigate(
        `/client/messages?conversationId=${encodeURIComponent(conversationId)}`,
      );
    } catch (contactError) {
      setActionError(
        contactError.response?.data?.message ||
          contactError.message ||
          "Unable to start a conversation. Please try again.",
      );
    } finally {
      setContacting(false);
    }
  };

  const handleRequestService = () => {
    if (!service) return;

    navigate("/client/requests", {
      state: {
        serviceId: service.id,
        providerId: service.provider_id,
        categoryId: service.category_id,
        title: `Request: ${service.title}`,
        description: `I would like to request the "${service.title}" service from ${providerName}.`,
        locationText: service.city || "",
      },
    });
  };

  if (loading) {
    return (
      <main className="service-details service-details--loading">
        <div className="service-details__loading-main">
          <div className="service-details__loading-image" />

          <div className="service-details__loading-content">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="service-details__loading-sidebar">
          <span />
          <span />
          <span />
          <span />
        </div>
      </main>
    );
  }

  if (error || !service) {
    return (
      <main className="service-details">
        <div className="service-details__state">
          <span className="service-details__state-icon">!</span>

          <h1>Service unavailable</h1>

          <p>{error || "We couldn't find the service you're looking for."}</p>

          <Link to="/client/discover" className="service-details__back-button">
            <ArrowLeft size={16} />
            Back to discover
          </Link>
        </div>
      </main>
    );
  }

  const providerName =
    `${service.first_name || ""} ${service.last_name || ""}`.trim() ||
    "Professional";

  const imageUrl = service.media?.[0]?.url;

  const categoryName =
    service.category_name || service.category?.name || "Service";

  const location = service.city || service.country || "Location unavailable";

  const rating =
    service.rating !== null && service.rating !== undefined
      ? Number(service.rating).toFixed(1)
      : null;

  return (
    <main className="service-details">
      <div className="service-details__topbar">
        <Link to="/client/discover" className="service-details__back">
          <ArrowLeft size={17} />
          <span>Back to discover</span>
        </Link>
      </div>

      <section className="service-details__layout">
        <div className="service-details__main">
          <div className="service-details__image">
            {imageUrl ? (
              <img src={imageUrl} alt={service.title} />
            ) : (
              <div className="service-details__image-placeholder">
                {service.title?.charAt(0)?.toUpperCase() || "S"}
              </div>
            )}
          </div>

          <div className="service-details__content">
            <span className="service-details__category">{categoryName}</span>

            <h1>{service.title}</h1>

            {service.description ? (
              <p className="service-details__description">
                {service.description}
              </p>
            ) : (
              <p className="service-details__description service-details__description--muted">
                Contact the professional to discuss the details of this service
                and what you need.
              </p>
            )}

            <div className="service-details__divider" />

            <section className="service-details__section">
              <span className="service-details__label">About this service</span>

              <p>
                Connect with the professional to discuss your requirements,
                confirm the scope of work, and agree on the details before
                proceeding.
              </p>
            </section>

            <div className="service-details__highlights">
              <div className="service-details__highlight">
                <span className="service-details__highlight-icon">
                  <BadgeCheck size={17} />
                </span>

                <div>
                  <strong>Verified professional</strong>
                  <span>
                    This professional has been verified by Proservora.
                  </span>
                </div>
              </div>

              {service.total_jobs_completed !== undefined && (
                <div className="service-details__highlight">
                  <span className="service-details__highlight-icon">
                    <CheckCircle2 size={17} />
                  </span>

                  <div>
                    <strong>Proven experience</strong>
                    <span>
                      {service.total_jobs_completed} completed{" "}
                      {service.total_jobs_completed === 1 ? "job" : "jobs"}.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="service-details__sidebar">
          <div className="service-details__provider-card">
            <span className="service-details__label">Provided by</span>

            <button
              type="button"
              className="service-details__provider service-details__provider-button"
              onClick={() =>
                navigate(`/client/provider-profile/${service.provider_id}`)
              }
            >
              {service.avatar_url ? (
                <img src={service.avatar_url} alt="" />
              ) : (
                <span className="service-details__provider-avatar">
                  {service.first_name?.charAt(0)?.toUpperCase() || "P"}
                </span>
              )}

              <div className="service-details__provider-details">
                <div className="service-details__provider-name">
                  <span>{providerName}</span>

                  {service.is_verified && (
                    <BadgeCheck size={15} strokeWidth={2} />
                  )}
                </div>

                {service.username && (
                  <span className="service-details__username">
                    @{service.username}
                  </span>
                )}
              </div>

              <span className="service-details__provider-arrow">→</span>
            </button>

            <div className="service-details__status">
              <span
                className={`service-details__status-dot ${
                  service.is_online ? "is-online" : ""
                }`}
              />

              <span>
                {service.is_online ? "Online now" : "Currently offline"}
              </span>

              {service.is_available && (
                <span className="service-details__available">
                  Available for work
                </span>
              )}
            </div>

            <div className="service-details__provider-info">
              <div>
                <Star size={15} fill="currentColor" />

                <span>
                  {rating || "New"}
                  {service.total_reviews !== undefined &&
                    ` (${service.total_reviews} ${
                      service.total_reviews === 1 ? "review" : "reviews"
                    })`}
                </span>
              </div>

              <div>
                <MapPin size={15} />

                <span>{location}</span>
              </div>

              {service.total_jobs_completed !== undefined && (
                <div>
                  <CheckCircle2 size={15} />

                  <span>
                    {service.total_jobs_completed} completed{" "}
                    {service.total_jobs_completed === 1 ? "job" : "jobs"}
                  </span>
                </div>
              )}
            </div>

            <div className="service-details__actions">
              <button
                type="button"
                className="service-details__primary-action"
                onClick={handleRequestService}
              >
                <CalendarDays size={17} />
                Request this service
              </button>

              <button
                type="button"
                className="service-details__secondary-action"
                onClick={handleContact}
                disabled={contacting}
              >
                <MessageCircle size={17} />
                {contacting ? "Opening conversation..." : "Contact professional"}
              </button>
            </div>
            {actionError && (
              <p className="service-details__action-error" role="alert">
                {actionError}
              </p>
            )}
          </div>
        </aside>
      </section>

      <div className="service-details__mobile-action">
        <button type="button" onClick={handleRequestService}>
          <CalendarDays size={17} />
          Request this service
        </button>
      </div>
    </main>
  );
}

export default ServiceDetails;
