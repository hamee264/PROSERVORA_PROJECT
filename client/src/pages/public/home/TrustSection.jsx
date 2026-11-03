import {
  ShieldCheck,
  BadgeCheck,
  CreditCard,
  MessageSquareText,
} from "lucide-react";
import { motion } from "motion/react";

import "./TrustSection.css";

function TrustSection() {
  return (
    <section className="trust-section">
      <div className="trust-section__container">
        {/* LEFT CONTENT */}

        <motion.div
          className="trust-section__content"
          initial={{
            opacity: 0,
            x: -24,
          }}
          whileInView={{
            opacity: 1,
            x: 0,
          }}
          viewport={{
            once: true,
            amount: 0.25,
          }}
          transition={{
            duration: 0.6,
            ease: "easeOut",
          }}
        >
          <span className="trust-section__eyebrow">Built for trust</span>

          <h2>
            A marketplace designed
            <span>around confidence.</span>
          </h2>

          <p>
            Finding someone to do important work for you should feel clear and
            dependable. Proservora brings useful trust signals and safer
            marketplace tools together throughout the experience.
          </p>

          <div className="trust-section__highlight">
            <div className="trust-section__highlight-icon">
              <ShieldCheck size={22} strokeWidth={1.7} />
            </div>

            <div>
              <strong>Trust is part of the experience.</strong>

              <span>
                From professional verification to reviews and payment
                protection, each part of the marketplace is designed with
                confidence in mind.
              </span>
            </div>
          </div>
        </motion.div>

        {/* RIGHT FEATURES */}

        <div className="trust-section__features">
          {/* VERIFIED */}

          <motion.article
            className="trust-feature"
            initial={{
              opacity: 0,
              y: 20,
            }}
            whileInView={{
              opacity: 1,
              y: 0,
            }}
            viewport={{
              once: true,
              amount: 0.2,
            }}
            transition={{
              duration: 0.5,
            }}
          >
            <div className="trust-feature__icon">
              <BadgeCheck size={20} strokeWidth={1.7} />
            </div>

            <div>
              <span className="trust-feature__number">01</span>

              <h3>Professional verification</h3>

              <p>
                Verification helps customers identify professionals whose
                profiles have gone through the platform's verification process.
              </p>
            </div>
          </motion.article>

          {/* PAYMENTS */}

          <motion.article
            className="trust-feature"
            initial={{
              opacity: 0,
              y: 20,
            }}
            whileInView={{
              opacity: 1,
              y: 0,
            }}
            viewport={{
              once: true,
              amount: 0.2,
            }}
            transition={{
              duration: 0.5,
              delay: 0.1,
            }}
          >
            <div className="trust-feature__icon">
              <CreditCard size={20} strokeWidth={1.7} />
            </div>

            <div>
              <span className="trust-feature__number">02</span>

              <h3>Safer payments</h3>

              <p>
                Payments can stay within the Proservora marketplace while the
                service is being completed.
              </p>
            </div>
          </motion.article>

          {/* REVIEWS */}

          <motion.article
            className="trust-feature"
            initial={{
              opacity: 0,
              y: 20,
            }}
            whileInView={{
              opacity: 1,
              y: 0,
            }}
            viewport={{
              once: true,
              amount: 0.2,
            }}
            transition={{
              duration: 0.5,
              delay: 0.2,
            }}
          >
            <div className="trust-feature__icon">
              <MessageSquareText size={20} strokeWidth={1.7} />
            </div>

            <div>
              <span className="trust-feature__number">03</span>

              <h3>Ratings and reviews</h3>

              <p>
                Customer feedback gives people useful information when
                evaluating professionals and their previous work.
              </p>
            </div>
          </motion.article>
        </div>
      </div>
    </section>
  );
}

export default TrustSection;
