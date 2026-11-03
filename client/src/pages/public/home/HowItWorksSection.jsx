import { Search, UserCheck, CheckCircle2, ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";

import "./HowItWorksSection.css";

function HowItWorksSection() {
  return (
    <section className="how-it-works-section">
      <div className="how-it-works-section__container">
        {/* INTRO */}

        <motion.div
          className="how-it-works-section__intro"
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
            amount: 0.25,
          }}
          transition={{
            duration: 0.6,
            ease: "easeOut",
          }}
        >
          <div>
            <span className="how-it-works-section__eyebrow">
              How Proservora works
            </span>

            <h2>
              Getting the right help
              <span>shouldn't feel complicated.</span>
            </h2>
          </div>

          <p>
            Proservora makes it easier to move from needing a service to getting
            the work done. Discover professionals, make your choice, and manage
            the process in one place.
          </p>
        </motion.div>

        {/* PROCESS */}

        <div className="how-it-works-section__process">
          {/* STEP 01 */}

          <motion.article
            className="how-step"
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
            <div className="how-step__top">
              <span className="how-step__number">01</span>

              <div className="how-step__icon">
                <Search size={22} strokeWidth={1.7} />
              </div>
            </div>

            <div className="how-step__content">
              <h3>Discover</h3>

              <p>
                Explore services and find professionals who match what you need.
              </p>
            </div>
          </motion.article>

          {/* STEP 02 */}

          <motion.article
            className="how-step"
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
              delay: 0.1,
              ease: "easeOut",
            }}
          >
            <div className="how-step__top">
              <span className="how-step__number">02</span>

              <div className="how-step__icon">
                <UserCheck size={22} strokeWidth={1.7} />
              </div>
            </div>

            <div className="how-step__content">
              <h3>Connect</h3>

              <p>
                Review professional profiles and choose someone who fits your
                requirements.
              </p>
            </div>
          </motion.article>

          {/* STEP 03 */}

          <motion.article
            className="how-step"
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
              delay: 0.2,
              ease: "easeOut",
            }}
          >
            <div className="how-step__top">
              <span className="how-step__number">03</span>

              <div className="how-step__icon">
                <CheckCircle2 size={22} strokeWidth={1.7} />
              </div>
            </div>

            <div className="how-step__content">
              <h3>Get it done</h3>

              <p>
                Work with your chosen professional and move toward completing
                the service.
              </p>
            </div>
          </motion.article>
        </div>

        {/* BOTTOM CTA */}

        <motion.div
          className="how-it-works-section__footer"
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
          <span>A simpler way to get things done.</span>

          <Link to="/how-it-works">
            See how it works
            <ArrowUpRight size={16} strokeWidth={1.8} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

export default HowItWorksSection;
