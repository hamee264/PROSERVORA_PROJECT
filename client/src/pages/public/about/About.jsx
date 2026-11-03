import { ArrowUpRight, BadgeCheck, Users, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";

import "./About.css";

function About() {
  return (
    <main className="about-page">
      {/* Hero */}
      <section className="about-hero">
        <div className="about-page__container">
          <motion.div
            className="about-hero__content"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          >
            <span className="about-page__eyebrow">About Proservora</span>

            <h1>
              Better connections
              <span>between people and skills.</span>
            </h1>

            <p>
              Proservora is a service marketplace built to make finding the
              right professional simpler, clearer, and more dependable.
            </p>
          </motion.div>
        </div>
      </section>

      {/* What Proservora is */}
      <section className="about-intro">
        <div className="about-page__container about-intro__grid">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.6 }}
          >
            <span className="about-page__eyebrow">Our purpose</span>

            <h2>
              Making services
              <span>easier to find.</span>
            </h2>
          </motion.div>

          <motion.div
            className="about-intro__text"
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.6 }}
          >
            <p>
              Finding someone who can do a job well should not require endless
              searching, uncertain recommendations, or unclear expectations.
            </p>

            <p>
              Proservora brings customers and service professionals together
              through a marketplace where people can discover services, evaluate
              professionals, communicate, and manage their work in one place.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Difference */}
      <section className="about-difference">
        <div className="about-page__container">
          <div className="about-difference__heading">
            <span className="about-page__eyebrow">The Proservora approach</span>

            <h2>
              A marketplace built
              <span>around better decisions.</span>
            </h2>
          </div>

          <div className="about-difference__grid">
            <motion.article
              className="about-principle"
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <div className="about-principle__icon">
                <BadgeCheck size={21} strokeWidth={1.7} />
              </div>

              <span>01</span>

              <h3>Useful trust signals</h3>

              <p>
                Professional profiles, verification, ratings, and reviews give
                customers more information when choosing who to work with.
              </p>
            </motion.article>

            <motion.article
              className="about-principle"
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <div className="about-principle__icon">
                <Users size={21} strokeWidth={1.7} />
              </div>

              <span>02</span>

              <h3>People at the centre</h3>

              <p>
                Proservora is designed around the relationship between customers
                and professionals, rather than simply listing services.
              </p>
            </motion.article>

            <motion.article
              className="about-principle"
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <div className="about-principle__icon">
                <ShieldCheck size={21} strokeWidth={1.7} />
              </div>

              <span>03</span>

              <h3>A safer experience</h3>

              <p>
                Marketplace tools are designed to give both sides clearer ways
                to communicate, manage work, and handle transactions.
              </p>
            </motion.article>
          </div>
        </div>
      </section>

      {/* Customers / professionals */}
      <section className="about-audience">
        <div className="about-page__container about-audience__grid">
          <div className="about-audience__block">
            <span className="about-page__eyebrow">For customers</span>

            <h2>
              Find the help
              <span>you actually need.</span>
            </h2>

            <p>
              Discover professionals, compare relevant information, communicate
              about your work, and manage your service experience through one
              marketplace.
            </p>

            <Link to="/register" className="about-page__link">
              Find a service
              <ArrowUpRight size={16} strokeWidth={1.8} />
            </Link>
          </div>

          <div className="about-audience__block about-audience__block--dark">
            <span className="about-page__eyebrow">For professionals</span>

            <h2>
              Put your skills
              <span>in front of customers.</span>
            </h2>

            <p>
              Build your professional presence, showcase your services, and
              connect with people looking for the work you provide.
            </p>

            <Link to="/become-a-provider" className="about-page__link">
              Become a provider
              <ArrowUpRight size={16} strokeWidth={1.8} />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="about-cta">
        <div className="about-page__container">
          <motion.div
            className="about-cta__inner"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
          >
            <span className="about-page__eyebrow">Get started</span>

            <h2>
              The right work starts
              <span>with the right connection.</span>
            </h2>

            <p>
              Whether you need a professional or have a skill to offer,
              Proservora gives you a place to start.
            </p>

            <div className="about-cta__actions">
              <Link to="/register" className="about-cta__primary">
                Get started
                <ArrowUpRight size={17} strokeWidth={1.8} />
              </Link>

              <Link to="/become-a-provider" className="about-cta__secondary">
                Become a provider
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}

export default About;
