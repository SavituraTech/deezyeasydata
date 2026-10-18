"use client";

import { motion } from "framer-motion";
import { Zap, ShieldCheck, Headphones } from "lucide-react";

const VALUE_PROPS = [
  {
    icon: Zap,
    title: "Instant Delivery",
    description:
      "Automated systems ensure your value is delivered in seconds, not minutes. No manual intervention required.",
    color: "text-[var(--color-secondary)]",
    bgColor: "bg-[var(--color-secondary-subtle)]",
  },
  {
    icon: ShieldCheck,
    title: "Secure Transactions",
    description:
      "Bank-grade encryption and secure payment gateways protect every kobo you spend on our platform.",
    color: "text-[var(--color-action)]",
    bgColor: "bg-[var(--color-action-subtle)]",
  },
  {
    icon: Headphones,
    title: "24/7 Support",
    description:
      "Our dedicated support team is always awake, ready to resolve any queries via chat or call instantly.",
    color: "text-[var(--color-utility-accent)]",
    bgColor: "bg-[rgba(110,60,25,0.1)]",
  },
];

export function WhyUs() {
  return (
    <section className="bg-[var(--color-surface-container-low)] px-4 py-24 lg:px-8">
      <div className="mx-auto max-w-7xl grid grid-cols-1 gap-8 md:grid-cols-3">
        {VALUE_PROPS.map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className="group rounded-3xl bg-[var(--color-surface-elevated)] p-10 shadow-sm transition-all duration-500 hover:shadow-xl"
          >
            <div
              className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${item.bgColor} transition-transform group-hover:scale-110`}
            >
              <item.icon className={`h-8 w-8 ${item.color}`} />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-[var(--foreground)]">
              {item.title}
            </h3>
            <p className="text-base text-[var(--color-text-secondary)]">
              {item.description}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
