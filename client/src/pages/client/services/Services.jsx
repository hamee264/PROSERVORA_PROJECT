import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  MapPin,
  Search,
  Star,
  Wrench,
} from "lucide-react";

import { getCategories } from "../../../services/categoryService";
import { getServices } from "../../../services/serviceService";

import "./Services.css";

function Services() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(
    () => searchParams.get("category") || "",
  );
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState("");
  const [servicesError, setServicesError] = useState("");

  useEffect(() => {
    let active = true;

    const loadCategories = async () => {
      try {
        const data = await getCategories();
        if (active) setCategories(data?.categories || []);
      } catch (error) {
        if (active) {
          setCategoriesError(
            error.response?.data?.message ||
              "Unable to load categories. Please try again.",
          );
        }
      } finally {
        if (active) setCategoriesLoading(false);
      }
    };

    loadCategories();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadServices = async () => {
      try {
        const params = {};
        if (submittedSearch) params.search = submittedSearch;
        if (selectedCategory) params.category = selectedCategory;

        const data = await getServices(params);
        if (active) setServices(data?.services || []);
      } catch (error) {
        if (active) {
          setServicesError(
            error.response?.data?.message ||
              "Unable to load services. Please try again.",
          );
        }
      } finally {
        if (active) setServicesLoading(false);
      }
    };

    loadServices();

    return () => {
      active = false;
    };
  }, [selectedCategory, submittedSearch]);

  const handleSearch = (event) => {
    event.preventDefault();
    setServicesError("");
    const nextSearch = search.trim();

    if (nextSearch !== submittedSearch) {
      setServicesLoading(true);
      setSubmittedSearch(nextSearch);
    }
  };

  const handleCategoryChange = (slug) => {
    setServicesError("");

    if (slug !== selectedCategory) {
      setServicesLoading(true);
      setSelectedCategory(slug);
      setSearchParams(slug ? { category: slug } : {});
    }
  };

  return (
    <div className="client-services">
      <header className="client-services__header">
        <div>
          <span className="client-services__eyebrow">MARKETPLACE</span>
          <h1>Services</h1>
          <p>Find experienced professionals for the work you need done.</p>
        </div>
      </header>

      <section
        className="client-services__discovery"
        aria-label="Browse services"
      >
        <form className="client-services__search" onSubmit={handleSearch}>
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search services or professionals"
            aria-label="Search services or professionals"
          />
          <button type="submit" aria-label="Search services" title="Search">
            <Search size={17} />
          </button>
        </form>

        <div className="client-services__category-row">
          <span className="client-services__filter-label">Categories</span>
          <div
            className="client-services__categories"
            aria-label="Service categories"
          >
            <button
              type="button"
              className={`client-services__category ${
                selectedCategory ? "" : "is-active"
              }`}
              onClick={() => handleCategoryChange("")}
            >
              All services
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`client-services__category ${
                  selectedCategory === category.slug ? "is-active" : ""
                }`}
                onClick={() => handleCategoryChange(category.slug)}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
        {categoriesError && (
          <p className="client-services__inline-error" role="alert">
            <AlertCircle size={15} />
            {categoriesError}
          </p>
        )}
      </section>

      <section
        className="client-services__results"
        aria-label="Available services"
      >
        <div className="client-services__results-heading">
          <div>
            <span className="client-services__section-label">
              {selectedCategory
                ? "SELECTED CATEGORY"
                : submittedSearch
                  ? "SEARCH RESULTS"
                  : "AVAILABLE NOW"}
            </span>
            <h2>
              {selectedCategory
                ? categories.find(
                    (category) => category.slug === selectedCategory,
                  )?.name || "Services"
                : submittedSearch
                  ? `Results for “${submittedSearch}”`
                  : "Recommended services"}
            </h2>
          </div>
          <span className="client-services__result-count">
            {services.length} {services.length === 1 ? "service" : "services"}
          </span>
        </div>

        {servicesError && (
          <p className="client-services__inline-error" role="alert">
            <AlertCircle size={15} />
            {servicesError}
          </p>
        )}

        {servicesLoading || categoriesLoading ? (
          <div className="client-services__grid" aria-label="Loading services">
            {[0, 1, 2].map((item) => (
              <div className="client-services__skeleton" key={item}>
                <div />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : services.length > 0 ? (
          <div className="client-services__grid">
            {services.map((service) => {
              const image = service.media?.[0]?.url;
              const providerName =
                `${service.first_name || ""} ${service.last_name || ""}`.trim() ||
                "Service professional";

              return (
                <Link
                  to={`/client/service-details/${service.id}`}
                  className="client-services__card"
                  key={service.id}
                >
                  <div className="client-services__media">
                    {image ? (
                      <img src={image} alt={service.title} loading="lazy" />
                    ) : (
                      <span className="client-services__media-placeholder">
                        <Wrench size={26} strokeWidth={1.5} />
                      </span>
                    )}
                    <span className="client-services__service-category">
                      {service.category_name ||
                        service.category?.name ||
                        "Service"}
                    </span>
                  </div>

                  <div className="client-services__card-content">
                    <div className="client-services__card-heading">
                      <h3>{service.title}</h3>
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </div>
                    <p>{service.description}</p>

                    <div className="client-services__provider">
                      {service.avatar_url ? (
                        <img src={service.avatar_url} alt="" loading="lazy" />
                      ) : (
                        <span className="client-services__provider-placeholder">
                          {providerName.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="client-services__provider-info">
                        <strong>
                          {providerName}
                          {service.is_verified && (
                            <BadgeCheck
                              size={14}
                              aria-label="Verified provider"
                            />
                          )}
                        </strong>
                        <span>
                          <MapPin size={12} />
                          {service.city ||
                            service.country ||
                            "Location unavailable"}
                        </span>
                      </span>
                      <span className="client-services__rating">
                        <Star size={14} fill="currentColor" />
                        {service.rating ?? "New"}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="client-services__empty">
            <span className="client-services__empty-icon">
              <Wrench size={23} strokeWidth={1.6} />
            </span>
            <h2>No services found</h2>
            <p>
              Try another search or category. New services from verified
              professionals will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default Services;
