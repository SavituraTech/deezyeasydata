import type { Metadata } from "next";
import { Mail, Phone, MapPin, Clock } from "lucide-react";
import { SITE } from "@/constants";
import { SectionHeading } from "@/components/marketing/section-heading";
import { ContactForm } from "@/components/marketing/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the Deezy Easy Data team. We reply within one business day.",
};

const DETAILS = [
  { icon: Mail, label: "Email", value: SITE.email },
  { icon: Phone, label: "Phone", value: SITE.phone },
  { icon: MapPin, label: "Office", value: SITE.address },
  { icon: Clock, label: "Support hours", value: "Mon–Sat, 8am – 8pm WAT" },
];

export default function ContactPage() {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Contact"
          title="We'd love to hear from you"
          description="Questions, feedback or partnership ideas — send us a message and our team will get back to you."
        />

        <div className="mx-auto mt-14 grid max-w-5xl gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            {DETAILS.map((d) => (
              <div key={d.label} className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-action-subtle)] text-[var(--color-action)]">
                  <d.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{d.label}</p>
                  <p className="font-medium text-foreground">{d.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}
