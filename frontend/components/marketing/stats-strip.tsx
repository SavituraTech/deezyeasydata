import { Zap } from "lucide-react";

const PARTNERS = [
  { name: "MTN", color: "bg-yellow-400" },
  { name: "AIRTEL", color: "bg-red-600" },
  { name: "GLO", color: "bg-green-600" },
  { name: "9MOBILE", color: "bg-blue-500" },
];

export function TrustBar() {
  return (
    <section className="border-y border-[var(--color-border)]/20 bg-[var(--color-surface-container-low)]/30 py-16">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <p className="mb-10 text-center text-xs font-medium uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">
          Powering transactions for users on major networks
        </p>
        <div className="flex flex-wrap items-center justify-center gap-12 opacity-50 grayscale transition-all duration-700 hover:grayscale-0">
          {PARTNERS.map((partner) => (
            <div key={partner.name} className="flex items-center gap-2">
              <span className={`h-8 w-8 rounded ${partner.color}`} />
              <span className="text-lg font-bold text-[var(--foreground)]">
                {partner.name}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Zap className="h-8 w-8 text-[var(--foreground)]" />
            <span className="text-lg font-bold text-[var(--foreground)]">
              DISCO
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
