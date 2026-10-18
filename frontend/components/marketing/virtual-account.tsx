"use client";

import { motion } from "framer-motion";
import { SectionHeading } from "./section-heading";

export function VirtualAccount() {
  return (
    <section id="pricing" className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Virtual Account"
          title="Fund Your Wallet in Seconds"
          description="Get a unique virtual account number. Transfer any amount and your wallet is credited instantly — 24/7."
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="mx-auto mt-14 max-w-xl"
        >
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-8)] shadow-[var(--shadow-xl)]">
            <div className="rounded-[var(--radius-lg)] bg-[var(--color-action-subtle)] p-[var(--space-6)]">
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">Your Unique Virtual Account</p>
              <div className="mt-3 flex items-center gap-3">
                <p className="font-mono text-2xl font-bold text-[var(--color-primary)]">0123456789</p>
                <span className="text-sm text-[var(--color-text-secondary)]">Wema Bank</span>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)]">24/7</p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Instant credit</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)]">₦0</p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">No hidden fees</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)]">Any bank</p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Transfer from anywhere</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
