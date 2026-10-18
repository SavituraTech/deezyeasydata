"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Wifi, Smartphone, Zap, ArrowRight } from "lucide-react";
import { CABLE_LOGOS } from "@/data/service-images";

export function Services() {
  return (
    <section id="services" className="px-4 py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-16 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-xl">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-secondary)]">
              Our Portfolio
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-[var(--foreground)] lg:text-4xl">
              Integrated Financial Services for the Modern Era
            </h2>
          </div>
          <Link
            href="/register"
            className="group flex items-center gap-2 text-sm font-medium text-[var(--foreground)]"
          >
            Explore all services
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {/* Data Bundles - spans 2 cols */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4 }}
            className="group relative min-h-[300px] overflow-hidden rounded-[32px] bg-[var(--color-surface-container-highest)] p-8 md:col-span-2"
          >
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <h4 className="mb-2 text-xl font-semibold text-[var(--foreground)]">
                  Data Bundles
                </h4>
                <p className="max-w-xs text-base text-[var(--color-text-secondary)]">
                  High-speed browsing data for all networks. MTN, Airtel, Glo, &amp; 9mobile.
                </p>
              </div>
              <Link
                href="/register"
                className="mt-8 w-fit rounded-full bg-[var(--color-surface-dark)] px-6 py-3 text-sm font-medium text-[var(--color-text-inverse)] transition-transform hover:scale-105"
              >
                Buy Now
              </Link>
            </div>
            {/* Decorative icon */}
            <div className="absolute -bottom-10 -right-10 opacity-30 transition-transform duration-700 group-hover:scale-110">
              <Wifi className="h-64 w-64 text-[var(--color-text-secondary)]" strokeWidth={0.5} />
            </div>
          </motion.div>

          {/* Airtime */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex flex-col justify-between rounded-[32px] bg-[var(--color-surface-container-high)] p-8"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-elevated)] text-[var(--foreground)]">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <h4 className="mb-2 text-xl font-semibold text-[var(--foreground)]">
                Airtime
              </h4>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Instant top-up with up to 3% discount on every purchase.
              </p>
            </div>
          </motion.div>

          {/* Electricity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex flex-col justify-between rounded-[32px] bg-[var(--color-surface-container-low)] p-8"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-elevated)] text-[var(--foreground)]">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h4 className="mb-2 text-xl font-semibold text-[var(--foreground)]">
                Electricity
              </h4>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Pay bills for IKEDC, EKEDC, KEDCO and others without stress.
              </p>
            </div>
          </motion.div>

          {/* Cable TV - spans 4 cols */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="relative overflow-hidden rounded-[32px] bg-[var(--color-surface-dark)] p-10 text-white md:col-span-4"
          >
            <div className="flex flex-col items-center gap-12 lg:flex-row">
              <div className="flex-1">
                <h4 className="mb-4 text-3xl font-bold lg:text-4xl">
                  Cable TV Subscriptions
                </h4>
                <p className="max-w-xl text-lg text-[var(--color-text-inverse)]/70">
                  Renew your DSTV, GOTV, and Startimes subscriptions in one click.
                  Never miss a moment of your favorite entertainment.
                </p>
                <div className="mt-6 flex gap-3">
                  {["DSTV", "GOTV", "Startimes"].map((provider) => (
                    <span
                      key={provider}
                      className="rounded-full border border-[var(--color-text-inverse)]/30 px-4 py-1 text-xs font-medium"
                    >
                      {provider}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex w-full flex-1 justify-center">
                <div className="flex h-48 w-full items-center justify-center gap-8 rounded-2xl border border-[var(--color-text-inverse)]/20 bg-white/10 backdrop-blur-sm">
                  {Object.entries(CABLE_LOGOS).map(([key, url]) => (
                    <img
                      key={key}
                      src={url}
                      alt={key}
                      className="h-16 w-16 object-contain opacity-80 brightness-0 invert"
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
