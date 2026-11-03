import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowUpRight, FolderOpen, Search } from "lucide-react";

import { getCategories } from "../../../services/categoryService";

import "./Categories.css";

function Categories() {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadCategories = async () => {
      try {
        const data = await getCategories();
        if (active) setCategories(data?.categories || []);
      } catch (loadError) {
        if (active) {
          setError(
            loadError.response?.data?.message ||
              "Unable to load categories. Please try again.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadCategories();
    return () => {
      active = false;
    };
  }, []);

  const visibleCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return categories;

    return categories.filter((category) =>
      [category.name, category.description]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [categories, search]);

  return (
    <div className="client-categories">
      <header className="client-categories__header">
        <div>
          <span className="client-categories__eyebrow">MARKETPLACE</span>
          <h1>Categories</h1>
          <p>Explore services by the kind of work you need done.</p>
        </div>
      </header>

      <section
        className="client-categories__content"
        aria-label="Service categories"
      >
        <div className="client-categories__section-heading">
          <div>
            <span className="client-categories__section-label">
              BROWSE SERVICES
            </span>
            <h2>Find your category</h2>
          </div>
          <span className="client-categories__count">
            {visibleCategories.length}{" "}
            {visibleCategories.length === 1 ? "category" : "categories"}
          </span>
        </div>

        <label className="client-categories__search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search categories"
            aria-label="Search categories"
          />
        </label>

        {error && (
          <p className="client-categories__error" role="alert">
            <AlertCircle size={17} />
            {error}
          </p>
        )}

        {loading ? (
          <div className="client-categories__grid" role="status">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div className="client-categories__skeleton" key={item} />
            ))}
          </div>
        ) : visibleCategories.length > 0 ? (
          <div className="client-categories__grid">
            {visibleCategories.map((category) => (
              <Link
                key={category.id}
                to={`/client/services?category=${encodeURIComponent(category.slug)}`}
                className="client-categories__tile"
              >
                <span className="client-categories__image">
                  {category.image_url ? (
                    <img src={category.image_url} alt="" loading="lazy" />
                  ) : category.icon_url ? (
                    <img src={category.icon_url} alt="" loading="lazy" />
                  ) : (
                    <FolderOpen size={25} strokeWidth={1.6} />
                  )}
                </span>
                <span className="client-categories__tile-copy">
                  <strong>{category.name}</strong>
                  <span>
                    {category.description || "Explore available professionals"}
                  </span>
                </span>
                <ArrowUpRight size={16} className="client-categories__arrow" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="client-categories__empty">
            <span className="client-categories__empty-icon">
              <FolderOpen size={22} strokeWidth={1.6} />
            </span>
            <h2>
              {search ? "No categories found" : "No categories available"}
            </h2>
            <p>
              {search
                ? "Try a different category name."
                : "Available service categories will appear here."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default Categories;
