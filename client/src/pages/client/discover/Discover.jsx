import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  MapPin,
  Star,
  BadgeCheck,
  SlidersHorizontal,
  Wrench,
  Folder,
  UserRound,
  Loader2,
  AlertCircle,
} from "lucide-react";

import { getCategories } from "../../../services/categoryService";
import { getServices } from "../../../services/serviceService";
import { getSearchSuggestions } from "../../../services/searchService";

import "./Discover.css";

function Discover() {
  const navigate = useNavigate();
  const searchRef = useRef(null);

  // ==========================================================
  // DATA
  // ==========================================================

  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);

  // ==========================================================
  // SEARCH
  // ==========================================================

  // What the user is currently typing
  const [search, setSearch] = useState("");

  // Search that has actually been submitted
  const [submittedSearch, setSubmittedSearch] = useState("");

  const [suggestions, setSuggestions] = useState([]);

  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const [suggestionsError, setSuggestionsError] = useState("");

  const [showSuggestions, setShowSuggestions] = useState(false);

  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  const [selectedCategory, setSelectedCategory] = useState("");

  // ==========================================================
  // LOADING / ERRORS
  // ==========================================================

  const [loadingCategories, setLoadingCategories] = useState(true);

  const [loadingServices, setLoadingServices] = useState(true);

  const [categoriesError, setCategoriesError] = useState("");

  const [servicesError, setServicesError] = useState("");

  // ==========================================================
  // LOAD CATEGORIES
  // ==========================================================

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setCategoriesError("");

        const data = await getCategories();

        setCategories(data?.categories || []);
      } catch (error) {
        setCategoriesError(
          error.response?.data?.message || "Unable to load categories.",
        );
      } finally {
        setLoadingCategories(false);
      }
    };

    loadCategories();
  }, []);

  // ==========================================================
  // LOAD SERVICES
  //
  // IMPORTANT:
  // This does NOT depend on `search`.
  //
  // It depends on `submittedSearch`.
  //
  // Therefore typing in the search box does not
  // immediately affect Available Services.
  // ==========================================================

  useEffect(() => {
    const loadServices = async () => {
      try {
        setLoadingServices(true);
        setServicesError("");

        const params = {};

        if (submittedSearch.trim()) {
          params.search = submittedSearch.trim();
        }

        if (selectedCategory) {
          params.category = selectedCategory;
        }

        const data = await getServices(params);

        setServices(data?.services || []);
      } catch (error) {
        setServicesError(
          error.response?.data?.message || "Unable to load services.",
        );
      } finally {
        setLoadingServices(false);
      }
    };

    loadServices();
  }, [submittedSearch, selectedCategory]);

  // ==========================================================
  // SEARCH AUTOCOMPLETE
  // ==========================================================

  useEffect(() => {
    const query = search.trim();

    // Empty / one-character search
    //
    // Do not call the backend.
    // Do not show the dropdown.
    if (query.length < 2) {
      setSuggestions([]);
      setSuggestionsError("");
      setSuggestionsLoading(false);
      setShowSuggestions(false);
      setActiveSuggestion(-1);

      return;
    }

    let cancelled = false;

    const timeout = setTimeout(async () => {
      try {
        setSuggestionsLoading(true);
        setSuggestionsError("");

        const data = await getSearchSuggestions(query);

        if (cancelled) return;

        setSuggestions(data?.suggestions || []);

        setShowSuggestions(true);
        setActiveSuggestion(-1);
      } catch (error) {
        if (cancelled) return;

        setSuggestions([]);
        setSuggestionsError(
          error.response?.data?.message || "Unable to load search suggestions.",
        );

        // Keep the error inside the autocomplete
        // section.
        setShowSuggestions(true);
      } finally {
        if (!cancelled) {
          setSuggestionsLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [search]);

  // ==========================================================
  // CLOSE SEARCH DROPDOWN WHEN CLICKING OUTSIDE
  // ==========================================================

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
        setActiveSuggestion(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // ==========================================================
  // CATEGORY SELECT
  // ==========================================================

  const handleCategorySelect = (category) => {
    if (selectedCategory === category.slug) {
      setSelectedCategory("");
      return;
    }

    // A category selection is an actual filter,
    // so this is allowed to change the services.
    setSelectedCategory(category.slug);

    // Clear submitted search when choosing a category.
    setSubmittedSearch("");

    // Keep the search box clean.
    setSearch("");

    setSuggestions([]);
    setShowSuggestions(false);
  };

  // ==========================================================
  // SUGGESTION ICON
  // ==========================================================

  const getSuggestionIcon = (type) => {
    switch (type) {
      case "category":
        return <Folder size={17} strokeWidth={1.8} />;

      case "service":
        return <Wrench size={17} strokeWidth={1.8} />;

      case "provider":
        return <UserRound size={17} strokeWidth={1.8} />;

      case "location":
        return <MapPin size={17} strokeWidth={1.8} />;

      default:
        return <Search size={17} strokeWidth={1.8} />;
    }
  };

  // ==========================================================
  // SUGGESTION SUBTITLE
  // ==========================================================

  const getSuggestionSubtitle = (suggestion) => {
    switch (suggestion.type) {
      case "category":
        return "Category";

      case "service":
        return suggestion.category_name || "Service";

      case "provider":
        return "Professional";

      case "location":
        return "Location";

      default:
        return "";
    }
  };

  // ==========================================================
  // SELECT SUGGESTION
  // ==========================================================

  const handleSuggestionSelect = (suggestion) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setSuggestionsError("");
    setActiveSuggestion(-1);

    // --------------------------------------------------------
    // SERVICE
    // --------------------------------------------------------

    if (suggestion.type === "service") {
      navigate(`/client/service-details/${suggestion.id}`);

      return;
    }

    // --------------------------------------------------------
    // PROVIDER
    // --------------------------------------------------------

    if (suggestion.type === "provider") {
      navigate(`/client/provider-profile/${suggestion.id}`);

      return;
    }

    // --------------------------------------------------------
    // CATEGORY
    // --------------------------------------------------------

    if (suggestion.type === "category") {
      setSearch("");
      setSubmittedSearch("");

      // The backend already gives us the category slug.
      setSelectedCategory(suggestion.category_slug);

      return;
    }

    // --------------------------------------------------------
    // LOCATION
    // --------------------------------------------------------

    if (suggestion.type === "location") {
      setSearch("");
      setSelectedCategory("");

      // Location filtering needs to be supported
      // by the actual service request.
      setSubmittedSearch(suggestion.label);
    }
  };

  // ==========================================================
  // SEARCH INPUT CHANGE
  // ==========================================================

  const handleSearchChange = (event) => {
    const value = event.target.value;

    setSearch(value);
    setActiveSuggestion(-1);

    // IMPORTANT:
    //
    // We do NOT set submittedSearch here.
    //
    // Therefore typing does not affect Available Services.

    if (!value.trim()) {
      setSuggestions([]);
      setSuggestionsError("");
      setShowSuggestions(false);
    }
  };

  // ==========================================================
  // KEYBOARD NAVIGATION
  // ==========================================================

  const handleSearchKeyDown = (event) => {
    // --------------------------------------------------------
    // ARROW DOWN
    // --------------------------------------------------------

    if (event.key === "ArrowDown") {
      if (!showSuggestions || !suggestions.length) {
        return;
      }

      event.preventDefault();

      setActiveSuggestion((current) =>
        current < suggestions.length - 1 ? current + 1 : 0,
      );

      return;
    }

    // --------------------------------------------------------
    // ARROW UP
    // --------------------------------------------------------

    if (event.key === "ArrowUp") {
      if (!showSuggestions || !suggestions.length) {
        return;
      }

      event.preventDefault();

      setActiveSuggestion((current) =>
        current > 0 ? current - 1 : suggestions.length - 1,
      );

      return;
    }

    // --------------------------------------------------------
    // ESCAPE
    // --------------------------------------------------------

    if (event.key === "Escape") {
      setShowSuggestions(false);
      setActiveSuggestion(-1);

      return;
    }

    // --------------------------------------------------------
    // ENTER
    // --------------------------------------------------------

    if (event.key === "Enter") {
      event.preventDefault();

      // If a suggestion is highlighted,
      // select it.
      if (
        showSuggestions &&
        activeSuggestion >= 0 &&
        suggestions[activeSuggestion]
      ) {
        handleSuggestionSelect(suggestions[activeSuggestion]);

        return;
      }

      // Otherwise perform the actual search.
      const query = search.trim();

      if (!query) {
        return;
      }

      setSubmittedSearch(query);
      setShowSuggestions(false);
      setActiveSuggestion(-1);
    }
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="discover">
      {/* ====================================================
          HERO
      ==================================================== */}

      <section className="discover__hero">
        <div className="discover__intro">
          <span className="discover__eyebrow">Discover</span>

          <h1>Find the right professional for the job.</h1>

          <p>
            Explore services from professionals and find the right person for
            what you need.
          </p>
        </div>

        {/* ==================================================
            SEARCH
        ================================================== */}

        <div className="discover__search-wrapper" ref={searchRef}>
          <div className="discover__search">
            <Search size={20} strokeWidth={1.8} />

            <input
              type="search"
              value={search}
              onChange={handleSearchChange}
              onFocus={() => {
                if (search.trim().length >= 2) {
                  setShowSuggestions(true);
                }
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="What service do you need?"
              aria-label="Search services"
              aria-expanded={showSuggestions}
              aria-autocomplete="list"
            />

            {suggestionsLoading && (
              <Loader2 size={18} className="discover__search-loader" />
            )}

            <button
              type="button"
              className="discover__filter-button"
              aria-label="Filter services"
            >
              <SlidersHorizontal size={18} strokeWidth={1.8} />
            </button>
          </div>

          {/* ==================================================
              AUTOCOMPLETE
          ================================================== */}

          {showSuggestions && search.trim().length >= 2 && (
            <div className="discover__suggestions" role="listbox">
              {/* ERROR */}

              {suggestionsError ? (
                <div className="discover__suggestions-error">
                  <span className="discover__suggestions-error-icon">
                    <AlertCircle size={17} strokeWidth={1.8} />
                  </span>

                  <div>
                    <strong>Search unavailable</strong>

                    <span>{suggestionsError}</span>
                  </div>
                </div>
              ) : suggestionsLoading ? (
                /* LOADING */

                <div className="discover__suggestions-loading">
                  <Loader2 size={17} className="discover__search-loader" />

                  <span>Searching...</span>
                </div>
              ) : suggestions.length === 0 ? (
                /* EMPTY */

                <div className="discover__suggestions-empty">
                  <Search size={17} strokeWidth={1.8} />

                  <span>No matching suggestions</span>
                </div>
              ) : (
                /* RESULTS */

                suggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.type}-${suggestion.id}`}
                    type="button"
                    className={`discover__suggestion ${
                      activeSuggestion === index ? "is-active" : ""
                    }`}
                    onMouseDown={(event) => {
                      event.preventDefault();

                      handleSuggestionSelect(suggestion);
                    }}
                    role="option"
                    aria-selected={activeSuggestion === index}
                  >
                    <span className="discover__suggestion-icon">
                      {getSuggestionIcon(suggestion.type)}
                    </span>

                    <span className="discover__suggestion-content">
                      <span className="discover__suggestion-label">
                        {suggestion.label}
                      </span>

                      <span className="discover__suggestion-subtitle">
                        {getSuggestionSubtitle(suggestion)}
                      </span>
                    </span>

                    <Search
                      size={15}
                      strokeWidth={1.7}
                      className="discover__suggestion-arrow"
                    />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      {/* ====================================================
          CATEGORIES
      ==================================================== */}

      <section className="discover__section">
        <div className="discover__section-header">
          <div>
            <span className="discover__section-label">Browse</span>

            <h2>Categories</h2>
          </div>
        </div>

        {loadingCategories ? (
          <div className="discover__categories-loading">
            <span />
            <span />
            <span />
            <span />
          </div>
        ) : categoriesError ? (
          <div className="discover__inline-error">{categoriesError}</div>
        ) : categories.length === 0 ? (
          <div className="discover__empty-inline">
            No categories are available yet.
          </div>
        ) : (
          <div className="discover__categories">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`discover__category ${
                  selectedCategory === category.slug ? "is-active" : ""
                }`}
                onClick={() => handleCategorySelect(category)}
              >
                {category.image_url ? (
                  <img
                    src={category.image_url}
                    alt=""
                    className="discover__category-image"
                    loading="lazy"
                  />
                ) : (
                  <span className="discover__category-placeholder" />
                )}

                <span>{category.name}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ====================================================
          SERVICES
      ==================================================== */}

      <section className="discover__section discover__services-section">
        <div className="discover__section-header">
          <div>
            <span className="discover__section-label">Marketplace</span>

            <h2>
              {selectedCategory
                ? "Services in this category"
                : submittedSearch
                  ? "Search results"
                  : "Available services"}
            </h2>
          </div>

          <span className="discover__result-count">
            {services.length} {services.length === 1 ? "service" : "services"}
          </span>
        </div>

        {loadingServices ? (
          <div className="discover__service-grid">
            <ServiceSkeleton />
            <ServiceSkeleton />
            <ServiceSkeleton />
          </div>
        ) : servicesError ? (
          <div className="discover__state">
            <h3>Something went wrong</h3>

            <p>{servicesError}</p>
          </div>
        ) : services.length === 0 ? (
          <div className="discover__state">
            <h3>No services found</h3>

            <p>Try a different search or choose another category.</p>
          </div>
        ) : (
          <div className="discover__service-grid">
            {services.map((service) => (
              <Link
                to={`/client/service-details/${service.id}`}
                className="discover__service-card"
                key={service.id}
              >
                <div className="discover__service-media">
                  {service.media?.[0]?.url ? (
                    <img
                      src={service.media[0].url}
                      alt={service.title}
                      loading="lazy"
                    />
                  ) : (
                    <div className="discover__service-placeholder">
                      <span>{service.title?.charAt(0)}</span>
                    </div>
                  )}

                  {(service.category?.name || service.category_name) && (
                    <span className="discover__service-category">
                      {service.category?.name || service.category_name}
                    </span>
                  )}
                </div>

                <div className="discover__service-content">
                  <h3>{service.title}</h3>

                  <div className="discover__provider">
                    {service.avatar_url ? (
                      <img src={service.avatar_url} alt="" loading="lazy" />
                    ) : (
                      <span className="discover__provider-avatar">
                        {service.first_name?.charAt(0)}
                      </span>
                    )}

                    <div>
                      <div className="discover__provider-name">
                        <span>
                          {service.first_name} {service.last_name}
                        </span>

                        {service.is_verified && (
                          <BadgeCheck size={14} strokeWidth={2} />
                        )}
                      </div>

                      <span className="discover__provider-location">
                        <MapPin size={12} strokeWidth={1.8} />

                        {service.city ||
                          service.country ||
                          "Location unavailable"}
                      </span>
                    </div>
                  </div>

                  <div className="discover__service-meta">
                    <span>
                      <Star size={14} fill="currentColor" strokeWidth={1.5} />

                      {service.rating ?? "New"}
                    </span>

                    {service.total_reviews !== undefined && (
                      <span>
                        {service.total_reviews}{" "}
                        {service.total_reviews === 1 ? "review" : "reviews"}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ServiceSkeleton() {
  return (
    <div className="discover__service-skeleton">
      <div className="discover__skeleton-media" />

      <div className="discover__skeleton-content">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export default Discover;
