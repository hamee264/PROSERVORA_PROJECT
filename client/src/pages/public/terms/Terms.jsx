import { Link } from "react-router-dom";

import "./Terms.css";

function Terms() {
  return (
    <main className="legal-page">
      <section className="legal-hero">
        <div className="legal-page__container">
          <span className="legal-page__eyebrow">Legal</span>

          <h1>
            Terms of
            <span>Service</span>
          </h1>

          <p>
            These terms describe the general rules for using Proservora and the
            relationship between users of the marketplace.
          </p>

          <span className="legal-page__updated">
            Last updated: September 2026
          </span>
        </div>
      </section>

      <section className="legal-content">
        <div className="legal-page__container legal-content__layout">
          <aside className="legal-sidebar">
            <span>On this page</span>

            <a href="#acceptance">Acceptance</a>
            <a href="#accounts">Accounts</a>
            <a href="#marketplace">Marketplace</a>
            <a href="#payments">Payments</a>
            <a href="#responsibilities">Responsibilities</a>
            <a href="#termination">Termination</a>
            <a href="#contact">Contact</a>
          </aside>

          <article className="legal-document">
            <section id="acceptance">
              <h2>1. Acceptance of these terms</h2>

              <p>
                By accessing or using Proservora, you agree to comply with these
                Terms of Service and any applicable policies governing the
                platform.
              </p>

              <p>
                If you do not agree with these terms, you should not use the
                Proservora platform.
              </p>
            </section>

            <section id="accounts">
              <h2>2. User accounts</h2>

              <p>
                Users may need to create an account to access certain
                marketplace features. You are responsible for providing accurate
                information and keeping your account credentials secure.
              </p>

              <p>
                You should notify Proservora if you believe that your account
                has been accessed without authorization.
              </p>
            </section>

            <section id="marketplace">
              <h2>3. Using the marketplace</h2>

              <p>
                Proservora provides a platform through which customers can
                discover and engage service professionals.
              </p>

              <p>
                Proservora does not itself perform the services listed by
                independent service professionals. Agreements about the scope,
                timing, and requirements of individual work should be clearly
                established by the parties involved.
              </p>
            </section>

            <section id="payments">
              <h2>4. Payments</h2>

              <p>
                Where marketplace payment features are available, transactions
                may be processed through the payment systems integrated with
                Proservora.
              </p>

              <p>
                Applicable fees, payment conditions, refunds, disputes, and
                other transaction rules may depend on the service and the
                applicable Proservora policies.
              </p>
            </section>

            <section id="responsibilities">
              <h2>5. User responsibilities</h2>

              <p>
                Users are expected to use Proservora lawfully and respectfully.
              </p>

              <ul>
                <li>Do not provide deliberately misleading information.</li>
                <li>Do not impersonate another person or business.</li>
                <li>Do not misuse another user's account.</li>
                <li>Do not attempt to interfere with the platform.</li>
                <li>Do not use Proservora for unlawful activities.</li>
                <li>Respect agreements made with other marketplace users.</li>
              </ul>
            </section>

            <section id="termination">
              <h2>6. Suspension and termination</h2>

              <p>
                Proservora may restrict, suspend, or terminate access to
                accounts where there is a violation of these terms, applicable
                policies, or relevant law.
              </p>

              <p>
                Certain obligations may continue after an account has been
                closed where required by their nature or by law.
              </p>
            </section>

            <section id="contact">
              <h2>7. Contact</h2>

              <p>
                If you have questions about these terms, please contact
                Proservora through the appropriate support channel once it has
                been made available.
              </p>

              <Link to="/" className="legal-document__back">
                Return to Proservora
              </Link>
            </section>
          </article>
        </div>
      </section>
    </main>
  );
}

export default Terms;
