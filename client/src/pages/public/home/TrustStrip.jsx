import {
  BadgeCheck,
  CreditCard,
  MessageSquareText,
  BriefcaseBusiness,
} from "lucide-react";

import "./TrustStrip.css";

const trustItems = [
  {
    icon: BadgeCheck,
    title: "Verified professionals",
  },
  {
    icon: CreditCard,
    title: "Secure payments",
  },
  {
    icon: MessageSquareText,
    title: "Transparent reviews",
  },
  {
    icon: BriefcaseBusiness,
    title: "A wide range of services",
  },
];

function TrustStrip() {
  return (
    <section className="trust-strip">
      <div className="trust-strip__container">
        <div className="trust-strip__heading">
          <span>Why Proservora</span>

          <h2>
            Trusted services.
            <br />
            Verified professionals.
          </h2>
        </div>

        <div className="trust-strip__items">
          {trustItems.map((item) => {
            const Icon = item.icon;

            return (
              <div className="trust-strip__item" key={item.title}>
                <div className="trust-strip__icon">
                  <Icon size={18} strokeWidth={1.8} />
                </div>

                <span>{item.title}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default TrustStrip;
