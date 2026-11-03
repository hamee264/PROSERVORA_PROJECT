import Hero from "./Hero";
import TrustStrip from "./TrustStrip";
import ValueSection from "./ValueSection";
import ServicesSection from "./ServicesSection";
import HowItWorksSection from "./HowItWorksSection";
import ProvidersSection from "./ProvidersSection";
import TrustSection from "./TrustSection";
import BecomeProviderCTA from "./BecomeProviderCTA";
function Home() {
  return (
    <main>
      <Hero />
      <TrustStrip />
      <ValueSection />
      <ServicesSection />
      <HowItWorksSection />
      <ProvidersSection />
      <TrustSection />
      <BecomeProviderCTA />
    </main>
  );
}

export default Home;
