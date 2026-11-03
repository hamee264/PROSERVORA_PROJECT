import {
  ArrowUpRight,
  BadgeCheck,
  BriefcaseBusiness,
  Star,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";

import "./BecomeAProvider.css";

function BecomeAProvider() {
  return (
    <main className="become-provider-page">
      {/* Hero */}
      <section className="become-provider-hero">
        <div className="become-provider__container">
          <div className="become-provider-hero__grid">
            <motion.div
              className="become-provider-hero__content"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.65, ease: "easeOut" }}
            >
              <span className="become-provider__eyebrow">
                For service professionals
              </span>

              <h1>
                Your skills deserve
                <span>more opportunities.</span>
              </h1>

              <p>
                Create your professional presence on Proservora, showcase what
                you do, and connect with customers looking for your skills.
              </p>

              <div className="become-provider-hero__actions">
                <Link
                  to="/register?role=provider"
                  className="become-provider__primary"
                >
                  Create your profile
                  <ArrowUpRight size={17} strokeWidth={1.8} />
                </Link>

                <Link to="/how-it-works" className="become-provider__secondary">
                  See how it works
                </Link>
              </div>
            </motion.div>

            {/* IMAGE SPACE */}
            <motion.div
              className="become-provider-hero__image"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <img
                src="/images/provider-hero.jpg"
                alt="Professional service provider at work"
              />

              <div className="become-provider-hero__image-label">
                <BadgeCheck size={17} strokeWidth={1.8} />

                <div>
                  <strong>Professional presence</strong>
                  <span>Built around your work</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Value */}
      <section className="become-provider-value">
        <div className="become-provider__container">
          <div className="become-provider-section-heading">
            <span className="become-provider__eyebrow">
              Why join Proservora
            </span>

            <h2>
              Build a stronger presence
              <span>around what you do.</span>
            </h2>

            <p>
              Proservora gives professionals a place to present their services
              and connect with customers through a dedicated marketplace.
            </p>
          </div>

          <div className="become-provider-value__grid">
            <motion.article
              className="become-provider-value__card"
              whileHover={{ y: -5 }}
              transition={{ duration: 0.2 }}
            >
              <div className="become-provider-value__icon">
                <BriefcaseBusiness size={22} strokeWidth={1.7} />
              </div>

              <span>01</span>

              <h3>Showcase your services</h3>

              <p>
                Present the services you offer and give customers useful
                information about the work you provide.
              </p>
            </motion.article>

            <motion.article
              className="become-provider-value__card"
              whileHover={{ y: -5 }}
              transition={{ duration: 0.2 }}
            >
              <div className="become-provider-value__icon">
                <Users size={22} strokeWidth={1.7} />
              </div>

              <span>02</span>

              <h3>Reach relevant customers</h3>

              <p>
                Put your professional profile in front of people searching for
                services you can provide.
              </p>
            </motion.article>

            <motion.article
              className="become-provider-value__card"
              whileHover={{ y: -5 }}
              transition={{ duration: 0.2 }}
            >
              <div className="become-provider-value__icon">
                <Star size={22} strokeWidth={1.7} />
              </div>

              <span>03</span>

              <h3>Build your reputation</h3>

              <p>
                Completed work, customer feedback, and your service history can
                contribute to a stronger professional presence.
              </p>
            </motion.article>
          </div>
        </div>
      </section>

      {/* Image + explanation */}
      <section className="become-provider-feature">
        <div className="become-provider__container">
          <div className="become-provider-feature__grid">
            {/* SECOND IMAGE SPACE */}
            <div className="become-provider-feature__image">
              <img
                src="/images/provider-work.jpg"
                alt="Professional working on a service"
                loading="lazy"
                decoding="async"
              />
            </div>

            <motion.div
              className="become-provider-feature__content"
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.6 }}
            >
              <span className="become-provider__eyebrow">
                Your professional profile
              </span>

              <h2>
                Let customers understand
                <span>what you bring.</span>
              </h2>

              <p>
                Your profile is more than a name on a marketplace. It gives
                customers a clearer picture of your services, experience,
                availability, and the type of work you provide.
              </p>

              <div className="become-provider-feature__points">
                <div>
                  <BadgeCheck size={18} strokeWidth={1.8} />

                  <span>Build a professional service profile</span>
                </div>

                <div>
                  <BadgeCheck size={18} strokeWidth={1.8} />

                  <span>Present the services you actually offer</span>
                </div>

                <div>
                  <BadgeCheck size={18} strokeWidth={1.8} />

                  <span>Give customers useful trust signals</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="become-provider-process">
        <div className="become-provider__container">
          <div className="become-provider-section-heading">
            <span className="become-provider__eyebrow">Getting started</span>

            <h2>
              Start with your skills.
              <span>Build from there.</span>
            </h2>
          </div>

          <div className="become-provider-process__list">
            <div className="become-provider-process__item">
              <span>01</span>

              <div>
                <h3>Create your account</h3>

                <p>
                  Sign up and begin setting up your professional presence on
                  Proservora.
                </p>
              </div>
            </div>

            <div className="become-provider-process__item">
              <span>02</span>

              <div>
                <h3>Complete your profile</h3>

                <p>
                  Add the information customers need to understand who you are
                  and what you offer.
                </p>
              </div>
            </div>

            <div className="become-provider-process__item">
              <span>03</span>

              <div>
                <h3>Add your services</h3>

                <p>
                  Define the services you provide and make them available
                  through the marketplace.
                </p>
              </div>
            </div>

            <div className="become-provider-process__item">
              <span>04</span>

              <div>
                <h3>Start connecting</h3>

                <p>
                  Once your provider setup is complete, you can begin engaging
                  with customers and managing your work.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="become-provider-cta">
        <div className="become-provider__container">
          <motion.div
            className="become-provider-cta__inner"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
          >
            <span className="become-provider__eyebrow">
              Your next opportunity
            </span>

            <h2>
              Ready to put your
              <span>skills to work?</span>
            </h2>

            <p>
              Create your Proservora account and start building your
              professional presence.
            </p>

            <Link
              to="/register?role=provider"
              className="become-provider-cta__button"
            >
              Get started
              <ArrowUpRight size={17} strokeWidth={1.8} />
            </Link>
          </motion.div>
        </div>
      </section>
    </main>
  );
}

export default BecomeAProvider;
