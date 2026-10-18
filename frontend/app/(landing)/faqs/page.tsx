import type { Metadata } from "next";
import { FAQS } from "@/data/marketing";
import { SectionHeading } from "@/components/marketing/section-heading";
import { CtaSection } from "@/components/marketing/cta";
import { FaqAccordion } from "@/components/marketing/faq-accordion";

export const metadata: Metadata = {
  title: "FAQs",
  description: "Answers to common questions about Deezy Easy Data — fees, security, refunds and supported services.",
};

export default function FaqsPage() {
  return (
    <>
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Support"
            title="Frequently asked questions"
            description="Everything you need to know about paying bills and managing your wallet with Deezy Easy Data."
          />
          <div className="mt-12">
            <FaqAccordion items={FAQS} />
          </div>
        </div>
      </section>
      <CtaSection />
    </>
  );
}
