import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowUpRight, CheckCircle2, Star } from "lucide-react";

import Button from "../../../components/Button/Button";

import "./Hero.css";

function Hero() {
  return (
    <section className="hero">
      <div className="hero__container">
        {/* =========================================
            HERO CONTENT
        ========================================= */}

        <motion.div
          className="hero__content"
          initial={{
            opacity: 0,
            y: 24,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.7,
            ease: "easeOut",
          }}
        >
          <div className="hero__eyebrow">
            <span className="hero__eyebrow-dot" />
            Trusted professionals. Real results.
          </div>

          <h1 className="hero__title">
            Good work starts with
            <span>the right professional.</span>
          </h1>

          <p className="hero__description">
            Connect with verified professionals for the services you need — with
            a simpler, safer way to get quality work done.
          </p>

          <div className="hero__actions">
            <Button to="/register">Find a service</Button>

            <motion.div whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
              <Link to="/become-a-provider" className="hero__secondary-action">
                Become a provider
                <ArrowUpRight size={17} strokeWidth={1.8} />
              </Link>
            </motion.div>
          </div>

          <div className="hero__trust">
            <div className="hero__trust-avatars">
              <span>J</span>
              <span>M</span>
              <span>A</span>
              <span>+</span>
            </div>

            <div className="hero__trust-copy">
              <div className="hero__rating">
                <Star size={14} fill="currentColor" strokeWidth={0} />

                <span>Trusted by customers</span>
              </div>

              <span>Find professionals you can rely on.</span>
            </div>
          </div>
        </motion.div>

        {/* =========================================
            HERO VISUAL
        ========================================= */}

        <motion.div
          className="hero__visual"
          initial={{
            opacity: 0,
            scale: 0.96,
          }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
          transition={{
            duration: 0.8,
            delay: 0.15,
            ease: "easeOut",
          }}
        >
          <div className="hero__image-wrapper">
            <img
              src="/images/hero-professional.png"
              alt="Professional service provider at work"
              className="hero__image"
            />

            <div className="hero__image-overlay" />
          </div>

          {/* =========================================
              VERIFIED CARD
          ========================================= */}

          <motion.div
            className="
              hero__floating-card
              hero__floating-card--verified
            "
            initial={{
              opacity: 0,
              y: 15,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.5,
              delay: 0.8,
            }}
          >
            <div className="hero__card-icon">
              <CheckCircle2 size={18} strokeWidth={2} />
            </div>

            <div>
              <strong>Verified professional</strong>

              <span>Identity & profile verified</span>
            </div>
          </motion.div>

          {/* =========================================
              RATING CARD
          ========================================= */}

          <motion.div
            className="
              hero__floating-card
              hero__floating-card--rating
            "
            initial={{
              opacity: 0,
              y: 15,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.5,
              delay: 1,
            }}
          >
            <div className="hero__rating-stars">
              <Star size={15} fill="currentColor" strokeWidth={0} />

              <span>4.9</span>
            </div>

            <span>Customer rating</span>
          </motion.div>

          {/* =========================================
              SERVICE CARD
          ========================================= */}

          <motion.div
            className="hero__service-card"
            initial={{
              opacity: 0,
              x: -15,
            }}
            animate={{
              opacity: 1,
              x: 0,
            }}
            transition={{
              duration: 0.5,
              delay: 1.15,
            }}
          >
            <span className="hero__service-label">Popular service</span>

            <strong>Home maintenance</strong>

            <span className="hero__service-status">
              Professionals available
            </span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

export default Hero;
