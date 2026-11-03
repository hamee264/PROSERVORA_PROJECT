import { BadgeCheck, ShieldCheck, Star } from "lucide-react";
import { motion } from "motion/react";

import "./ValueSection.css";

const features = [
  {
    icon: BadgeCheck,
    title: "Verified professionals",
    description:
      "Find professionals with verified profiles and the skills needed to provide their services.",
  },
  {
    icon: ShieldCheck,
    title: "Safer transactions",
    description:
      "Keep your service payment within Proservora for a more secure experience from start to finish.",
  },
  {
    icon: Star,
    title: "Work you can evaluate",
    description:
      "Use ratings and reviews to make more informed decisions before choosing a professional.",
  },
];

function ValueSection() {
  return (
    <section className="value-section">
      <div className="value-section__container">
        {/* Left content */}

        <motion.div
          className="value-section__content"
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
          <span className="value-section__eyebrow">
            The Proservora difference
          </span>

          <h2>
            Find the right professional
            <span>with more confidence.</span>
          </h2>

          <p>
            Proservora brings customers and service professionals together in
            one place, making it easier to discover skilled people, compare your
            options, and get the work you need done.
          </p>

          <div className="value-section__principles">
            <div>
              <strong>Built around people.</strong>
              <span>
                Better connections between customers and professionals.
              </span>
            </div>

            <div>
              <strong>Designed for trust.</strong>
              <span>
                Verification, payments, ratings, and reviews work together.
              </span>
            </div>
          </div>
        </motion.div>

        {/* Right features */}

        <div className="value-section__features">
          {features.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <motion.article
                className="value-feature"
                key={feature.title}
                initial={{
                  opacity: 0,
                  x: 24,
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
                  duration: 0.5,
                  delay: index * 0.12,
                  ease: "easeOut",
                }}
              >
                <div className="value-feature__icon">
                  <Icon size={20} strokeWidth={1.7} />
                </div>

                <div className="value-feature__content">
                  <h3>{feature.title}</h3>

                  <p>{feature.description}</p>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default ValueSection;
