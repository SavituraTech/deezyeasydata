"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="overflow-hidden px-4 py-24 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-[48px] bg-[var(--color-surface-dark)] p-12 text-center relative overflow-hidden lg:p-24">
        {/* Background glow */}
        <div className="absolute -left-1/2 -top-1/2 h-full w-full rounded-full bg-[var(--color-secondary)]/20 blur-[120px]" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="relative z-10 mx-auto max-w-3xl space-y-8"
        >
          <h2 className="text-3xl font-bold text-[var(--color-text-inverse)] lg:text-[48px]">
            Ready to experience the kinetic speed?
          </h2>
          <p className="text-lg text-[var(--color-text-inverse)]/70">
            Join over 50,000 users who trust Deezy Easy Data for their daily
            utility and data needs. Fast, secure, and always reliable.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 pt-8 sm:flex-row">
            <Button
              variant="action"
              size="lg"
              asChild
              className="w-full bg-[var(--color-secondary)] text-white hover:bg-[var(--color-secondary-hover)] sm:w-auto"
            >
              <Link href="/register">Create Free Account</Link>
            </Button>
            <Button
              variant="secondary"
              size="lg"
              asChild
              className="w-full border-white/20 bg-white/10 text-[var(--color-text-inverse)] hover:bg-white/20 sm:w-auto"
            >
              <Link href="/contact">Talk to Support</Link>
            </Button>
          </div>

          <p className="pt-4 text-sm italic text-[var(--color-text-inverse)]/60">
            No hidden fees. No transaction delays. Just pure speed.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
