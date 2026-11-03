import { ArrowUpRight, BadgeCheck, BriefcaseBusiness } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";

import "./ProvidersSection.css";

function ProvidersSection() {
  return (
    <section className="providers-section">
      <div className="providers-section__container">
        {/* LEFT — IMAGE */}

        <motion.div
          className="providers-section__visual"
          initial={{
            opacity: 0,
            x: -30,
          }}
          whileInView={{
            opacity: 1,
            x: 0,
          }}
          viewport={{
            once: true,
            amount: 0.2,
          }}
          transition={{
            duration: 0.65,
            ease: "easeOut",
          }}
        >
          <img
            src="/images/provider-section.jpg"
            alt="Professional providing a service"
            className="providers-section__image"
            loading="lazy"
            decoding="async"
          />

          <div className="providers-section__image-overlay" />

          <div className="providers-section__visual-label">
            <BadgeCheck size={18} strokeWidth={1.8} />

            <span>Built around trusted professionals</span>
          </div>
        </motion.div>

        {/* RIGHT — CONTENT */}

        <motion.div
          className="providers-section__content"
          initial={{
            opacity: 0,
            x: 30,
          }}
          whileInView={{
            opacity: 1,
            x: 0,
          }}
          viewport={{
            once: true,
            amount: 0.2,
          }}
          transition={{
            duration: 0.65,
            ease: "easeOut",
          }}
        >
          <span className="providers-section__eyebrow">For professionals</span>

          <h2>
            Your skills
            <span>deserve to be discovered.</span>
          </h2>

          <p>
            Proservora gives service professionals a place to showcase what they
            do, connect with customers, and grow their work through a
            marketplace built around trust.
          </p>

          <div className="providers-section__features">
            <div className="providers-section__feature">
              <div className="providers-section__feature-icon">
                <BriefcaseBusiness size={18} strokeWidth={1.8} />
              </div>

              <div>
                <h3>Showcase your services</h3>

                <p>
                  Present your skills, services, and professional profile to
                  potential customers.
                </p>
              </div>
            </div>

            <div className="providers-section__feature">
              <div className="providers-section__feature-icon">
                <BadgeCheck size={18} strokeWidth={1.8} />
              </div>

              <div>
                <h3>Build trust with customers</h3>

                <p>
                  A professional profile, verification, ratings, and reviews
                  help customers make informed choices.
                </p>
              </div>
            </div>
          </div>

          <Link to="/become-a-provider" className="providers-section__cta">
            Become a provider
            <ArrowUpRight size={17} strokeWidth={1.8} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

export default ProvidersSection;
