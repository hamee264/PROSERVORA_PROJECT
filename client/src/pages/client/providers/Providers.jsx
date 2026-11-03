import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  MapPin,
  Search,
  Star,
  UserRound,
} from "lucide-react";

import { getServices } from "../../../services/serviceService";

import "./Providers.css";

const filters = [
  { label: "All providers", value: "all" },
  { label: "Available", value: "available" },
  { label: "Online", value: "online" },
];

function Providers() {
  const [services, setServices] = useState([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadProviders = async () => {
      try {
        const data = await getServices();
        if (active) setServices(data?.services || []);
      } catch (loadError) {
        if (active) {
          setError(
            loadError.response?.data?.message ||
              "Unable to load providers. Please try again.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProviders();
    return () => {
      active = false;
    };
  }, []);

  const providers = useMemo(() => {
    const grouped = new Map();

    for (const service of services) {
      if (!service.provider_id) continue;

      const existing = grouped.get(service.provider_id);
      if (existing) {
        existing.serviceCount += 1;
        if (existing.serviceTitles.length < 3) {
          existing.serviceTitles.push(service.title);
        }
        continue;
      }

      grouped.set(service.provider_id, {
        id: service.provider_id,
        firstName: service.first_name || "",
        lastName: service.last_name || "",
        username: service.username || "",
        avatarUrl: service.avatar_url || "",
        city: service.city || "",
        country: service.country || "",
        bio: service.bio || "",
        rating: service.rating,
        totalReviews: service.total_reviews || 0,
        totalCompleted: service.total_jobs_completed || 0,
        isVerified: Boolean(service.is_verified),
        isAvailable: Boolean(service.is_available),
        isOnline: Boolean(service.is_online),
        serviceCount: 1,
        serviceTitles: service.title ? [service.title] : [],
      });
    }

    return [...grouped.values()];
  }, [services]);

  const visibleProviders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return providers.filter((provider) => {
      if (activeFilter === "available" && !provider.isAvailable) return false;
      if (activeFilter === "online" && !provider.isOnline) return false;
      if (!query) return true;

      return [
        provider.firstName,
        provider.lastName,
        provider.username,
        provider.city,
        provider.country,
        ...provider.serviceTitles,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [activeFilter, providers, search]);

  const initials = (provider) =>
    `${provider.firstName.charAt(0)}${provider.lastName.charAt(0)}`.toUpperCase() ||
    "P";

  return (
    <div className="client-providers">
      <header className="client-providers__header">
        <div>
          <span className="client-providers__eyebrow">MARKETPLACE</span>
          <h1>Providers</h1>
          <p>
            Meet experienced professionals and explore the services they offer.
          </p>
        </div>
      </header>

      <div className="client-providers__toolbar">
        <div
          className="client-providers__filters"
          role="tablist"
          aria-label="Filter providers"
        >
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              role="tab"
              aria-selected={activeFilter === filter.value}
              className={
                activeFilter === filter.value
                  ? "client-providers__filter is-active"
                  : "client-providers__filter"
              }
              onClick={() => setActiveFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <label className="client-providers__search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search providers or services"
            aria-label="Search providers or services"
          />
        </label>
      </div>

      <section
        className="client-providers__results"
        aria-label="Provider directory"
      >
        <div className="client-providers__results-heading">
          <span>
            {loading
              ? "Loading professionals..."
              : `${visibleProviders.length} ${visibleProviders.length === 1 ? "professional" : "professionals"}`}
          </span>
        </div>

        {error && (
          <p className="client-providers__error" role="alert">
            <AlertCircle size={16} />
            {error}
          </p>
        )}

        {loading ? (
          <div className="client-providers__grid" role="status">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div className="client-providers__skeleton" key={item}>
                <span />
                <div />
                <div />
              </div>
            ))}
          </div>
        ) : visibleProviders.length > 0 ? (
          <div className="client-providers__grid">
            {visibleProviders.map((provider) => {
              const name =
                `${provider.firstName} ${provider.lastName}`.trim() ||
                provider.username ||
                "Service professional";
              const location =
                [provider.city, provider.country].filter(Boolean).join(", ") ||
                "Location unavailable";

              return (
                <Link
                  to={`/client/provider-profile/${provider.id}`}
                  className="client-providers__card"
                  key={provider.id}
                >
                  <div className="client-providers__identity">
                    {provider.avatarUrl ? (
                      <img src={provider.avatarUrl} alt="" loading="lazy" />
                    ) : (
                      <span className="client-providers__avatar-placeholder">
                        {initials(provider) || <UserRound size={22} />}
                      </span>
                    )}
                    <span className="client-providers__availability">
                      <span className={provider.isOnline ? "is-online" : ""} />
                      {provider.isOnline
                        ? "Online"
                        : provider.isAvailable
                          ? "Available"
                          : "Professional"}
                    </span>
                  </div>

                  <div className="client-providers__details">
                    <div className="client-providers__name-row">
                      <h2>{name}</h2>
                      {provider.isVerified && (
                        <BadgeCheck
                          size={16}
                          aria-label="Verified professional"
                        />
                      )}
                    </div>
                    {provider.username && (
                      <p className="client-providers__username">
                        @{provider.username}
                      </p>
                    )}
                    <p className="client-providers__location">
                      <MapPin size={13} />
                      {location}
                    </p>

                    {provider.bio && (
                      <p className="client-providers__bio">{provider.bio}</p>
                    )}

                    <div className="client-providers__metrics">
                      <span>
                        <Star size={14} fill="currentColor" />
                        {provider.rating ?? "New"}
                        {provider.totalReviews > 0 && (
                          <small>({provider.totalReviews})</small>
                        )}
                      </span>
                      <span>
                        {provider.serviceCount}{" "}
                        {provider.serviceCount === 1 ? "service" : "services"}
                      </span>
                    </div>

                    <div className="client-providers__services">
                      {provider.serviceTitles.map((title) => (
                        <span key={title}>{title}</span>
                      ))}
                    </div>
                  </div>

                  <span className="client-providers__view-link">
                    View profile
                    <ArrowUpRight size={14} />
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="client-providers__empty">
            <span className="client-providers__empty-icon">
              <UserRound size={22} strokeWidth={1.6} />
            </span>
            <h2>No providers found</h2>
            <p>Try another search or change the availability filter.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default Providers;
