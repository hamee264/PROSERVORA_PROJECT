import {
  Search,
  UserRoundCheck,
  MessageCircle,
  CreditCard,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";

import "./HowItWorks.css";

function HowItWorks() {
  return (
    <main className="how-it-works-page">
      {/* Hero */}
      <section className="how-it-works-hero">
        <div className="how-it-works__container">
          <motion.div
            className="how-it-works-hero__content"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          >
            <span className="how-it-works__eyebrow">How Proservora works</span>

            <h1>
              From finding help
              <span>to getting the job done.</span>
            </h1>

            <p>
              Proservora brings discovery, communication, payments, and service
              management together so customers and professionals can work with
              more clarity.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Customer journey */}
      <section className="how-it-works-steps">
        <div className="how-it-works__container">
          <div className="how-it-works-section-heading">
            <span className="how-it-works__eyebrow">For customers</span>

            <h2>
              A clearer way to
              <span>find the right professional.</span>
            </h2>
          </div>

          <div className="how-it-works-steps__grid">
            <motion.article
              className="how-it-works-step"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.5 }}
            >
              <div className="how-it-works-step__top">
                <span>01</span>

                <div className="how-it-works-step__icon">
                  <Search size={23} strokeWidth={1.7} />
                </div>
              </div>

              <h3>Discover a service</h3>

              <p>
                Search for the type of service you need and explore relevant
                professionals and services available on Proservora.
              </p>
            </motion.article>

            <motion.article
              className="how-it-works-step"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.5, delay: 0.08 }}
            >
              <div className="how-it-works-step__top">
                <span>02</span>

                <div className="how-it-works-step__icon">
                  <UserRoundCheck size={23} strokeWidth={1.7} />
                </div>
              </div>

              <h3>Evaluate professionals</h3>

              <p>
                Review professional profiles, services, verification, ratings,
                and other useful information before deciding who to work with.
              </p>
            </motion.article>

            <motion.article
              className="how-it-works-step"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.5, delay: 0.16 }}
            >
              <div className="how-it-works-step__top">
                <span>03</span>

                <div className="how-it-works-step__icon">
                  <MessageCircle size={23} strokeWidth={1.7} />
                </div>
              </div>

              <h3>Connect and agree</h3>

              <p>
                Communicate with the professional, discuss the work, and agree
                on the details before the service begins.
              </p>
            </motion.article>

            <motion.article
              className="how-it-works-step"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.5, delay: 0.24 }}
            >
              <div className="how-it-works-step__top">
                <span>04</span>

                <div className="how-it-works-step__icon">
                  <CreditCard size={23} strokeWidth={1.7} />
                </div>
              </div>

              <h3>Manage the payment</h3>

              <p>
                Use the marketplace payment flow to manage the transaction while
                the agreed service is being completed.
              </p>
            </motion.article>

            <motion.article
              className="how-it-works-step how-it-works-step--wide"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.5, delay: 0.32 }}
            >
              <div className="how-it-works-step__top">
                <span>05</span>

                <div className="how-it-works-step__icon">
                  <CheckCircle2 size={23} strokeWidth={1.7} />
                </div>
              </div>

              <div>
                <h3>Complete the service</h3>

                <p>
                  Once the agreed work is completed, the service can be
                  confirmed and the transaction moves through the appropriate
                  completion process.
                </p>
              </div>
            </motion.article>
          </div>
        </div>
      </section>

      {/* Provider journey */}
      <section className="how-it-works-provider">
        <div className="how-it-works__container">
          <div className="how-it-works-provider__grid">
            <motion.div
              className="how-it-works-provider__intro"
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.6 }}
            >
              <span className="how-it-works__eyebrow">For professionals</span>

              <h2>
                Turn your skills
                <span>into opportunities.</span>
              </h2>

              <p>
                Build a professional presence and connect with customers looking
                for the services you provide.
              </p>

              <Link to="/become-a-provider" className="how-it-works__link">
                Become a provider
                <ArrowUpRight size={16} strokeWidth={1.8} />
              </Link>
            </motion.div>

            <div className="how-it-works-provider__list">
              <div className="how-it-works-provider__item">
                <span>01</span>

                <div>
                  <h3>Create your professional presence</h3>

                  <p>
                    Set up your profile and present the services and skills you
                    offer.
                  </p>
                </div>
              </div>

              <div className="how-it-works-provider__item">
                <span>02</span>

                <div>
                  <h3>Get discovered by customers</h3>

                  <p>
                    Make your services available to people looking for the work
                    you provide.
                  </p>
                </div>
              </div>

              <div className="how-it-works-provider__item">
                <span>03</span>

                <div>
                  <h3>Manage your work</h3>

                  <p>
                    Communicate with customers and manage jobs, bookings, and
                    service activity.
                  </p>
                </div>
              </div>

              <div className="how-it-works-provider__item">
                <span>04</span>

                <div>
                  <h3>Build your reputation</h3>

                  <p>
                    Completed work and customer feedback can help strengthen
                    your professional presence.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="how-it-works-trust">
        <div className="how-it-works__container">
          <motion.div
            className="how-it-works-trust__content"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
          >
            <span className="how-it-works__eyebrow">
              Built into the experience
            </span>

            <h2>
              More information.
              <span>More confidence.</span>
            </h2>

            <p>
              Proservora is designed to give both customers and professionals
              the tools they need to make service interactions clearer and more
              manageable.
            </p>

            <div className="how-it-works-trust__points">
              <span>Professional verification</span>
              <span>Ratings and reviews</span>
              <span>Marketplace payments</span>
              <span>Dispute handling</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="how-it-works-cta">
        <div className="how-it-works__container">
          <div className="how-it-works-cta__inner">
            <span className="how-it-works__eyebrow">Ready when you are</span>

            <h2>
              Find the right professional
              <span>for your next job.</span>
            </h2>

            <div className="how-it-works-cta__actions">
              <Link to="/register" className="how-it-works-cta__primary">
                Get started
                <ArrowUpRight size={17} strokeWidth={1.8} />
              </Link>

              <Link
                to="/become-a-provider"
                className="how-it-works-cta__secondary"
              >
                Become a provider
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default HowItWorks;
