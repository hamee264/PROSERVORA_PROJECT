import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  MapPin,
  MessageCircle,
  Star,
} from "lucide-react";

import {
  getPublicProviderProfile,
  getPublicProviderServices,
} from "../../../services/providerService";
import { startConversation } from "../../../services/chatService";

import "./ProviderProfile.css";

function ProviderProfile() {
  const { providerId } = useParams();
  const navigate = useNavigate();

  const [provider, setProvider] = useState(null);
  const [services, setServices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [servicesLoading, setServicesLoading] = useState(true);

  const [error, setError] = useState("");
  const [servicesError, setServicesError] = useState("");
  const [contactError, setContactError] = useState("");
  const [contacting, setContacting] = useState(false);

  const handleContact = async () => {
    if (contacting) return;

    try {
      setContacting(true);
      setContactError("");

      const data = await startConversation(providerId);
      const conversationId = data?.conversation?.id;

      if (!conversationId) {
        throw new Error("Unable to open this conversation.");
      }

      navigate(
        `/client/messages?conversationId=${encodeURIComponent(conversationId)}`,
      );
    } catch (error) {
      setContactError(
        error.response?.data?.message ||
          error.message ||
          "Unable to start a conversation. Please try again.",
      );
    } finally {
      setContacting(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadProvider = async () => {
      try {
        setError("");

        const data = await getPublicProviderProfile(providerId);

        if (active) setProvider(data?.provider || data);
      } catch (error) {
        console.error("Failed to load provider:", error);

        if (active) {
          setError(
            error.response?.data?.message || "Unable to load this provider.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    if (providerId) {
      loadProvider();
      const interval = window.setInterval(loadProvider, 15000);
      return () => {
        active = false;
        window.clearInterval(interval);
      };
    }
    return () => {
      active = false;
    };
  }, [providerId]);

  useEffect(() => {
    const loadServices = async () => {
      try {
        setServicesLoading(true);
        setServicesError("");

        const data = await getPublicProviderServices(providerId);

        setServices(data?.services || []);
      } catch (error) {
        console.error("Failed to load provider services:", error);

        setServicesError(
          error.response?.data?.message ||
            "Unable to load this provider's services.",
        );
      } finally {
        setServicesLoading(false);
      }
    };

    if (providerId) {
      loadServices();
    }
  }, [providerId]);

  if (loading) {
    return (
      <main className="provider-profile provider-profile--loading">
        <div className="provider-profile__loading-cover" />

        <div className="provider-profile__loading-card">
          <div className="provider-profile__loading-avatar" />

          <div className="provider-profile__loading-lines">
            <span />
            <span />
            <span />
          </div>
        </div>
      </main>
    );
  }

  if (error || !provider) {
    return (
      <main className="provider-profile">
        <div className="provider-profile__state">
          <span className="provider-profile__state-icon">!</span>

          <h1>Provider unavailable</h1>

          <p>{error || "We couldn't find this professional."}</p>

          <Link to="/client/discover" className="provider-profile__back-button">
            <ArrowLeft size={16} />
            Back to discover
          </Link>
        </div>
      </main>
    );
  }

  const providerName =
    `${provider.first_name || ""} ${provider.last_name || ""}`.trim() ||
    "Professional";

  const initials =
    `${provider.first_name?.charAt(0) || ""}${
      provider.last_name?.charAt(0) || ""
    }`.toUpperCase() || "P";

  const location =
    [provider.city, provider.country].filter(Boolean).join(", ") ||
    "Location unavailable";

  const rating =
    provider.rating !== null && provider.rating !== undefined
      ? Number(provider.rating).toFixed(1)
      : "New";

  return (
    <main className="provider-profile">
      <div className="provider-profile__container">
        <Link to="/client/discover" className="provider-profile__back">
          <ArrowLeft size={17} />
          <span>Back to discover</span>
        </Link>

        {/* HERO */}

        <section className="provider-profile__hero">
          <div className="provider-profile__identity">
            {provider.avatar_url ? (
              <img
                src={provider.avatar_url}
                alt={providerName}
                className="provider-profile__avatar"
              />
            ) : (
              <div className="provider-profile__avatar provider-profile__avatar--placeholder">
                {initials}
              </div>
            )}

            <div className="provider-profile__identity-content">
              <div className="provider-profile__name-row">
                <h1>{providerName}</h1>

                {provider.is_verified && (
                  <span
                    className="provider-profile__verified"
                    title="Verified professional"
                  >
                    <BadgeCheck size={19} />
                    Verified
                  </span>
                )}
              </div>

              {provider.username && (
                <p className="provider-profile__username">
                  @{provider.username}
                </p>
              )}

              <div className="provider-profile__location">
                <MapPin size={16} />
                <span>{location}</span>
              </div>

              <div className="provider-profile__status-row">
                <span
                  className={`provider-profile__status ${
                    provider.is_available ? "is-available" : "is-unavailable"
                  }`}
                >
                  <span />

                  {provider.is_available
                    ? "Available for work"
                    : "Currently unavailable"}
                </span>

                {provider.is_online && (
                  <span className="provider-profile__online">Online now</span>
                )}
              </div>
            </div>
          </div>

          <div className="provider-profile__actions">
            <button
              type="button"
              className="provider-profile__primary-action"
              onClick={handleContact}
              disabled={contacting}
            >
              <MessageCircle size={17} />
              {contacting ? "Opening conversation..." : "Contact professional"}
            </button>
          </div>
        </section>

        {contactError && (
          <p className="provider-profile__contact-error" role="alert">
            {contactError}
          </p>
        )}

        {/* STATS */}

        <section className="provider-profile__stats">
          <div className="provider-profile__stat">
            <Star size={18} fill="currentColor" />

            <div>
              <strong>{rating}</strong>

              <span>
                {provider.total_reviews || 0}{" "}
                {provider.total_reviews === 1 ? "review" : "reviews"}
              </span>
            </div>
          </div>

          <div className="provider-profile__stat">
            <CheckCircle2 size={18} />

            <div>
              <strong>{provider.total_jobs_completed || 0}</strong>

              <span>Completed jobs</span>
            </div>
          </div>

          <div className="provider-profile__stat">
            <BriefcaseBusiness size={18} />

            <div>
              <strong>
                {provider.is_verified ? "Verified" : "Not verified"}
              </strong>

              <span>Professional status</span>
            </div>
          </div>
        </section>

        {/* CONTENT */}

        <section className="provider-profile__content">
          <div className="provider-profile__about">
            <span className="provider-profile__eyebrow">About</span>

            <h2>About this professional</h2>

            {provider.bio ? (
              <p>{provider.bio}</p>
            ) : (
              <p className="provider-profile__muted">
                This professional hasn't added a description yet.
              </p>
            )}
          </div>

          <aside className="provider-profile__contact-card">
            <span className="provider-profile__eyebrow">Need help?</span>

            <h2>
              Interested in working with{" "}
              {provider.first_name || "this professional"}?
            </h2>

            <p>
              Start a conversation to discuss your requirements before
              requesting the service.
            </p>

            <button
              type="button"
              className="provider-profile__primary-action provider-profile__primary-action--full"
              onClick={handleContact}
              disabled={contacting}
            >
              <MessageCircle size={17} />
              {contacting ? "Opening conversation..." : "Contact professional"}
            </button>
          </aside>
        </section>

        {/* SERVICES */}

        <section className="provider-profile__services">
          <div className="provider-profile__services-header">
            <div>
              <span className="provider-profile__eyebrow">Services</span>

              <h2>Services offered</h2>
            </div>

            {!servicesLoading && services.length > 0 && (
              <span className="provider-profile__services-count">
                {services.length}{" "}
                {services.length === 1 ? "service" : "services"}
              </span>
            )}
          </div>

          {servicesLoading ? (
            <div className="provider-profile__services-grid">
              <ServiceSkeleton />
              <ServiceSkeleton />
            </div>
          ) : servicesError ? (
            <div className="provider-profile__services-state">
              <p>{servicesError}</p>
            </div>
          ) : services.length === 0 ? (
            <div className="provider-profile__services-state">
              <BriefcaseBusiness size={22} />

              <h3>No services listed yet</h3>

              <p>This professional hasn't added any public services yet.</p>
            </div>
          ) : (
            <div className="provider-profile__services-grid">
              {services.map((service) => {
                const imageUrl = service.media?.[0]?.url;

                return (
                  <Link
                    key={service.id}
                    to={`/client/service-details/${service.id}`}
                    className="provider-profile__service-card"
                  >
                    <div className="provider-profile__service-image">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={service.title}
                          loading="lazy"
                        />
                      ) : (
                        <div className="provider-profile__service-placeholder">
                          {service.title?.charAt(0)?.toUpperCase() || "S"}
                        </div>
                      )}
                    </div>

                    <div className="provider-profile__service-content">
                      <span className="provider-profile__service-category">
                        {service.category_name || "Service"}
                      </span>

                      <h3>{service.title}</h3>

                      {service.description && <p>{service.description}</p>}

                      <span className="provider-profile__service-link">
                        View service →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ServiceSkeleton() {
  return (
    <div className="provider-profile__service-skeleton">
      <div className="provider-profile__service-skeleton-image" />

      <div className="provider-profile__service-skeleton-content">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export default ProviderProfile;
