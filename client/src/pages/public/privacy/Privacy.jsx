import { Link } from "react-router-dom";

import "./Privacy.css";

function Privacy() {
  return (
    <main className="legal-page">
      <section className="legal-hero">
        <div className="legal-page__container">
          <span className="legal-page__eyebrow">Legal</span>

          <h1>
            Privacy
            <span>Policy</span>
          </h1>

          <p>
            This policy explains the types of information Proservora may collect
            and how that information may be used within the platform.
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

            <a href="#information">Information</a>
            <a href="#use">How we use it</a>
            <a href="#sharing">Sharing</a>
            <a href="#security">Security</a>
            <a href="#choices">Your choices</a>
            <a href="#retention">Retention</a>
            <a href="#contact">Contact</a>
          </aside>

          <article className="legal-document">
            <section id="information">
              <h2>1. Information we collect</h2>

              <p>
                Depending on how you use Proservora, the platform may collect
                information such as your name, contact details, account
                information, profile information, service information,
                transaction information, and communications made through the
                platform.
              </p>

              <p>
                Technical information may also be collected when you interact
                with the website or application, such as device, browser, and
                usage information.
              </p>
            </section>

            <section id="use">
              <h2>2. How information is used</h2>

              <p>
                Information may be used to operate and maintain Proservora,
                provide marketplace functionality, process transactions,
                communicate with users, improve the platform, and help protect
                the service from misuse.
              </p>

              <p>
                Information may also be used where necessary to comply with
                legal obligations or enforce applicable policies.
              </p>
            </section>

            <section id="sharing">
              <h2>3. When information may be shared</h2>

              <p>
                Proservora may share relevant information with other marketplace
                participants where necessary to provide requested services or
                facilitate interactions on the platform.
              </p>

              <p>
                Information may also be shared with service providers that help
                operate parts of the platform, such as payment, hosting,
                communication, security, or storage services.
              </p>

              <p>
                Proservora may disclose information where required by applicable
                law or valid legal process.
              </p>
            </section>

            <section id="security">
              <h2>4. Security</h2>

              <p>
                Proservora uses reasonable technical and organizational measures
                intended to protect information from unauthorized access,
                misuse, alteration, or loss.
              </p>

              <p>
                No online service can guarantee absolute security, so users
                should also take reasonable steps to protect their account
                credentials and devices.
              </p>
            </section>

            <section id="choices">
              <h2>5. Your choices</h2>

              <p>
                Depending on the information involved and applicable law, you
                may have rights relating to your personal information, including
                requests to access, correct, update, or delete certain
                information.
              </p>

              <p>
                Account and communication preferences may also be managed
                through available platform settings.
              </p>
            </section>

            <section id="retention">
              <h2>6. Information retention</h2>

              <p>
                Information may be retained for as long as reasonably necessary
                to provide the service, maintain business records, resolve
                disputes, enforce agreements, or comply with legal obligations.
              </p>
            </section>

            <section id="contact">
              <h2>7. Contact</h2>

              <p>
                If you have questions about this Privacy Policy or how
                Proservora handles information, please contact Proservora
                through the appropriate support channel once it has been made
                available.
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

export default Privacy;
