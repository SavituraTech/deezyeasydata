import { Hero } from "@/components/marketing/hero";
import { TrustBar } from "@/components/marketing/stats-strip";
import { WhyUs } from "@/components/marketing/why-us";
import { Services } from "@/components/marketing/services";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { CtaSection } from "@/components/marketing/cta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <WhyUs />
      <Services />
      <HowItWorks />
      <TrustBar />
      <CtaSection />
    </>
  );
}
