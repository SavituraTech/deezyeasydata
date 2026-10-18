"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { SectionHeading } from "./section-heading";

const TESTIMONIALS = [
  {
    name: "Adaeze O.",
    role: "Small Business Owner",
    quote: "I fund my staff airtime and data in bulk now. The discount alone saves me thousands every month.",
    rating: 5,
  },
  {
    name: "Tunde K.",
    role: "University Student",
    quote: "Buying WAEC pins and data bundles here is way cheaper than anywhere else. Instant delivery every time.",
    rating: 5,
  },
  {
    name: "Funke A.",
    role: "Freelance Developer",
    quote: "My DSTV and electricity payments go through in seconds. No more queuing at the bank.",
    rating: 5,
  },
];

const STATS = [
  { value: "50K+", label: "Active Users" },
  { value: "₦2.4B+", label: "Transactions Processed" },
  { value: "99.9%", label: "Uptime" },
  { value: "< 30s", label: "Average Delivery" },
];

export function SocialProof() {
  return (
    <section className="py-20 bg-[var(--color-surface)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Trusted by Thousands"
          title="What Our Users Say"
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6 shadow-[var(--shadow-md)]"
            >
              <div className="flex gap-1">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-[var(--color-accent)] text-[var(--color-accent)]" />
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[var(--color-primary)] text-sm font-bold text-[var(--color-text-inverse)] flex items-center justify-center">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{t.name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-16 grid grid-cols-2 gap-6 md:grid-cols-4">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="text-center"
            >
              <p className="text-3xl font-bold text-[var(--color-primary)]">{s.value}</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
