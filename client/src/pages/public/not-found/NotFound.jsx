import { ArrowLeft, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";

import "./NotFound.css";

function NotFound() {
  return (
    <main className="not-found">
      <div className="not-found__container">
        <motion.div
          className="not-found__content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <span className="not-found__code">404</span>

          <span className="not-found__eyebrow">Page not found</span>

          <h1>
            This page seems to be
            <span>somewhere else.</span>
          </h1>

          <p>
            The page you're looking for doesn't exist, may have moved, or the
            address may have been entered incorrectly.
          </p>

          <div className="not-found__actions">
            <Link to="/" className="not-found__primary">
              <Home size={16} strokeWidth={1.8} />
              Back home
            </Link>

            <button
              type="button"
              className="not-found__secondary"
              onClick={() => window.history.back()}
            >
              <ArrowLeft size={16} strokeWidth={1.8} />
              Go back
            </button>
          </div>
        </motion.div>
      </div>
    </main>
  );
}

export default NotFound;
