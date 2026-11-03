import { ArrowUpRight, BadgeCheck, BriefcaseBusiness } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";

import "./BecomeProviderCTA.css";

function BecomeProviderCTA() {
  return (
    <section className="become-provider-cta">
      <div className="become-provider-cta__container">
        <motion.div
          className="become-provider-cta__content"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span className="become-provider-cta__eyebrow">
            For service professionals
          </span>

          <h2>
            Turn your skills
            <span>into more opportunities.</span>
          </h2>

          <p>
            Create your professional presence on Proservora, showcase what you
            do, and connect with customers looking for the right expertise.
          </p>

          <div className="become-provider-cta__actions">
            <Link
              to="/become-a-provider"
              className="become-provider-cta__primary"
            >
              Become a provider
              <ArrowUpRight size={17} strokeWidth={1.8} />
            </Link>

            <Link to="/register" className="become-provider-cta__secondary">
              Create an account
            </Link>
          </div>
        </motion.div>

        <motion.div
          className="become-provider-cta__visual"
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{
            duration: 0.65,
            delay: 0.1,
            ease: "easeOut",
          }}
        >
          <div className="become-provider-cta__card">
            <div className="become-provider-cta__card-icon">
              <BriefcaseBusiness size={22} strokeWidth={1.7} />
            </div>

            <div>
              <span>Professional profile</span>
              <strong>Showcase what you do.</strong>
            </div>
          </div>

          <div className="become-provider-cta__card become-provider-cta__card--offset">
            <div className="become-provider-cta__card-icon">
              <BadgeCheck size={22} strokeWidth={1.7} />
            </div>

            <div>
              <span>Build confidence</span>
              <strong>Let customers understand your work.</strong>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default BecomeProviderCTA;
