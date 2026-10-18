"use client";

import { motion } from "framer-motion";

const STEPS = [
  {
    number: 1,
    title: "Select Service",
    description:
      "Choose your preferred biller or data plan from our extensive list of providers.",
    variant: "default",
  },
  {
    number: 2,
    title: "Enter Details",
    description:
      "Provide your account number, meter number, or phone number and verify information.",
    variant: "default",
  },
  {
    number: 3,
    title: "Complete Payment",
    description:
      "Pay securely via card, USSD, or transfer and receive your value instantly.",
    variant: "primary",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-[var(--color-surface)] px-4 py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 text-center">
          <h2 className="mb-2 text-3xl font-bold tracking-tight text-[var(--foreground)] lg:text-4xl">
            Seamless in 3 Easy Steps
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-[var(--color-text-secondary)]">
            We&apos;ve refined our process to be as fast as humanly possible. No
            registration bloat, just efficiency.
          </p>
        </div>

        <div className="relative mx-auto grid max-w-5xl grid-cols-1 gap-16 md:grid-cols-3">
          {/* Connection line (desktop) */}
          <div className="absolute left-1/4 right-1/4 top-10 hidden h-px bg-[var(--color-border)]/30 md:block" />

          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="flex flex-col items-center space-y-4 text-center"
            >
              <div
                className={`flex h-20 w-20 items-center justify-center rounded-full border-4 border-[var(--color-surface-elevated)] shadow-xl ${
                  step.variant === "primary"
                    ? "bg-[var(--color-surface-dark)] text-[var(--color-text-inverse)]"
                    : "bg-[var(--color-surface-container-high)] text-[var(--foreground)]"
                }`}
              >
                <span className="text-xl font-semibold">{step.number}</span>
              </div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)]">
                {step.title}
              </h4>
              <p className="max-w-xs text-base text-[var(--color-text-secondary)]">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
