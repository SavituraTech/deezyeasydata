import type { Metadata } from "next";
import { Target, Heart, Shield, Users } from "lucide-react";
import { SectionHeading } from "@/components/marketing/section-heading";
import { TrustBar } from "@/components/marketing/stats-strip";
import { CtaSection } from "@/components/marketing/cta";

export const metadata: Metadata = {
  title: "About",
  description: "Deezy Easy Data is on a mission to make everyday payments fast, secure and simple for every Nigerian.",
};

const VALUES = [
  {
    icon: Target,
    title: "Simplicity first",
    description: "We obsess over removing friction. Every flow should be obvious and finish in seconds.",
  },
  {
    icon: Shield,
    title: "Security always",
    description: "Your money and data are protected with encryption and continuous monitoring.",
  },
  {
    icon: Heart,
    title: "Built for Nigeria",
    description: "From naira-first design to local providers, we build for the way Nigerians actually pay.",
  },
  {
    icon: Users,
    title: "Customer obsessed",
    description: "We listen, iterate fast, and treat every piece of feedback as a chance to improve.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Our story"
            title="Making payments effortless for every Nigerian"
            description="Deezy Easy Data started with a simple frustration: paying for airtime, data and bills was slow, scattered and stressful. We set out to fix that with one fast, secure and delightful app."
          />

          <div className="mx-auto mt-14 grid max-w-4xl gap-6 sm:grid-cols-2">
            {VALUES.map((v) => (
              <div key={v.title} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-action-subtle)] text-[var(--color-action)]">
                  <v.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{v.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <TrustBar />

      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Our mission
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            To give everyone a fast, fair and secure way to pay for the things they need every day —
            and the tools to understand and control their spending. We believe great financial tools
            should be simple enough for anyone to use, and we build every feature with that promise in
            mind.
          </p>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
