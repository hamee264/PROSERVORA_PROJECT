import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw, Star } from "lucide-react";
import { getMyProviderReviews } from "../../../services/reviewService";
import "./Reviews.css";

function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadReviews = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await getMyProviderReviews();
      setReviews(data?.reviews || []);
      setError("");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load your reviews.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => loadReviews(), 0);
    const interval = window.setInterval(() => loadReviews(true), 15000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadReviews]);

  const average =
    reviews.length > 0
      ? (
          reviews.reduce((sum, review) => sum + Number(review.rating), 0) /
          reviews.length
        ).toFixed(1)
      : "—";

  return (
    <main className="provider-reviews">
      <header className="provider-reviews__header">
        <div>
          <span>PROVIDER WORKSPACE</span>
          <h1>Reviews</h1>
          <p>New customer reviews appear here automatically.</p>
        </div>
        <button
          type="button"
          className="provider-reviews__refresh"
          onClick={() => loadReviews(true)}
          disabled={refreshing}
        >
          <RefreshCw size={15} className={refreshing ? "is-spinning" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {error && (
        <p className="provider-reviews__notice" role="alert">
          <AlertCircle size={16} />
          {error}
        </p>
      )}

      <section className="provider-reviews__summary">
        <strong>{average}</strong>
        <span>
          <Star size={16} fill="currentColor" />
          Average rating
        </span>
        <small>{reviews.length} total reviews</small>
      </section>

      {loading ? (
        <div className="provider-reviews__state">Loading reviews...</div>
      ) : reviews.length ? (
        <section className="provider-reviews__list">
          {reviews.map((review) => (
            <article key={review.id} className="provider-reviews__item">
              <div className="provider-reviews__item-top">
                <strong>
                  {[review.customer_first_name, review.customer_last_name]
                    .filter(Boolean)
                    .join(" ") ||
                    review.customer_username ||
                    "Customer"}
                </strong>
                <span>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star
                      key={value}
                      size={14}
                      fill={value <= review.rating ? "currentColor" : "none"}
                    />
                  ))}
                </span>
              </div>
              <small>
                {new Intl.DateTimeFormat("en", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }).format(new Date(review.created_at))}
              </small>
              <p>{review.review || "The customer left a rating without a comment."}</p>
              <em>{review.service_title || review.opportunity_title}</em>
            </article>
          ))}
        </section>
      ) : (
        <div className="provider-reviews__state">
          You do not have any reviews yet. Completed customer feedback will
          appear here.
        </div>
      )}
    </main>
  );
}

export default Reviews;
