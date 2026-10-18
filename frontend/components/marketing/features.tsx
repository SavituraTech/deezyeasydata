"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Zap, LineChart, RefreshCcw, Moon, Wallet } from "lucide-react";
import { SectionHeading } from "./section-heading";

const FEATURES = [
  {
    icon: Zap,
    title: "Instant delivery",
    description: "Airtime, data and bill payments land in seconds, not minutes. No waiting around.",
  },
  {
    icon: ShieldCheck,
    title: "Bank-grade security",
    description: "Encryption and audit logs keep your money and data safe.",
  },
  {
    icon: RefreshCcw,
    title: "Automatic refunds",
    description: "If a payment fails, we reverse it to your wallet automatically — usually in minutes.",
  },
  {
    icon: LineChart,
    title: "Spending insights",
    description: "See where your money goes each month with clear charts and category breakdowns.",
  },
  {
    icon: Wallet,
    title: "One unified wallet",
    description: "Fund once and pay for everything. Track your balance and spending in one place.",
  },
  {
    icon: Moon,
    title: "Light & dark mode",
    description: "A polished experience that adapts to your device and is easy on the eyes at night.",
  },
];

export function Features() {
  return (
    <section className="border-t border-[var(--color-border)] bg-[var(--color-surface-elevated)] py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Why Deezy Easy Data"
          title="Everything you need to pay and manage money"
          description="A complete toolkit for bills, wallet and insights — designed to be fast, secure and genuinely pleasant to use."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-md)] transition-shadow hover:shadow-[var(--shadow-lg)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-action-subtle)] text-[var(--color-action)]">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--foreground)]">{f.title}</h3>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
