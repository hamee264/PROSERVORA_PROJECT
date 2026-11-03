import { ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";

import "./ServicesSection.css";

function ServicesSection() {
  return (
    <section className="services-section">
      <div className="services-section__container">
        {/* SECTION HEADING */}

        <motion.div
          className="services-section__heading"
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
            amount: 0.3,
          }}
          transition={{
            duration: 0.55,
            ease: "easeOut",
          }}
        >
          <div>
            <span className="services-section__eyebrow">Explore services</span>

            <h2>
              Whatever needs doing,
              <span>find the right professional.</span>
            </h2>
          </div>

          <p>
            From everyday tasks to specialized work, Proservora brings different
            kinds of professionals together in one place.
          </p>
        </motion.div>

        {/* SERVICES GRID */}

        <div className="services-section__grid">
          {/* HOME & REPAIRS */}

          <motion.article
            className="service-card services-section__card--large"
            initial={{
              opacity: 0,
              y: 24,
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
              ease: "easeOut",
            }}
          >
            <img
              src="/images/service-home.jpg"
              alt="Home and repair services"
              className="service-card__image"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />

            <div className="service-card__overlay" />

            <div className="service-card__content">
              <span className="service-card__number">01</span>

              <div>
                <h3>Home & Repairs</h3>

                <p>
                  Skilled professionals for maintenance, repairs, and everyday
                  home needs.
                </p>
              </div>

              <span className="service-card__arrow">
                <ArrowUpRight size={18} strokeWidth={1.8} />
              </span>
            </div>
          </motion.article>

          {/* CLEANING */}

          <motion.article
            className="service-card"
            initial={{
              opacity: 0,
              y: 24,
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
              delay: 0.08,
              ease: "easeOut",
            }}
          >
            <img
              src="/images/service-cleaning.jpg"
              alt="Cleaning services"
              className="service-card__image"
              loading="lazy"
              decoding="async"
            />

            <div className="service-card__overlay" />

            <div className="service-card__content">
              <span className="service-card__number">02</span>

              <div>
                <h3>Cleaning</h3>

                <p>Keep your space clean, comfortable, and cared for.</p>
              </div>

              <span className="service-card__arrow">
                <ArrowUpRight size={18} strokeWidth={1.8} />
              </span>
            </div>
          </motion.article>

          {/* TECHNOLOGY */}

          <motion.article
            className="service-card"
            initial={{
              opacity: 0,
              y: 24,
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
              delay: 0.16,
              ease: "easeOut",
            }}
          >
            <img
              src="/images/service-technology.jpg"
              alt="Technology services"
              className="service-card__image"
              loading="lazy"
              decoding="async"
            />

            <div className="service-card__overlay" />

            <div className="service-card__content">
              <span className="service-card__number">03</span>

              <div>
                <h3>Technology</h3>

                <p>
                  Get help with devices, software, websites, and digital work.
                </p>
              </div>

              <span className="service-card__arrow">
                <ArrowUpRight size={18} strokeWidth={1.8} />
              </span>
            </div>
          </motion.article>

          {/* BEAUTY & WELLNESS */}

          <motion.article
            className="service-card services-section__card--large"
            initial={{
              opacity: 0,
              y: 24,
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
              delay: 0.24,
              ease: "easeOut",
            }}
          >
            <img
              src="/images/service-beauty.jpg"
              alt="Beauty and wellness services"
              className="service-card__image"
              loading="lazy"
              decoding="async"
            />

            <div className="service-card__overlay" />

            <div className="service-card__content">
              <span className="service-card__number">04</span>

              <div>
                <h3>Beauty & Wellness</h3>

                <p>
                  Connect with professionals for personal care and wellness.
                </p>
              </div>

              <span className="service-card__arrow">
                <ArrowUpRight size={18} strokeWidth={1.8} />
              </span>
            </div>
          </motion.article>
        </div>

        {/* VIEW ALL */}

        <motion.div
          className="services-section__footer"
          initial={{
            opacity: 0,
          }}
          whileInView={{
            opacity: 1,
          }}
          viewport={{
            once: true,
          }}
          transition={{
            duration: 0.5,
            delay: 0.2,
          }}
        >
          <span>Discover more services on Proservora.</span>

          <Link to="/register">
            View all
            <ArrowUpRight size={16} strokeWidth={1.8} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

export default ServicesSection;
