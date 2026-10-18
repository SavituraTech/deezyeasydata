"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { formatNaira } from "@/lib/utils";

interface WalletCardProps {
  balance?: number;
}

export function WalletCard({ balance = 0 }: WalletCardProps) {
  const [hidden, setHidden] = React.useState(false);

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-primary)] p-[var(--space-8)] text-white shadow-[var(--shadow-xl)]">
      {/* Decorative gold gradient at top-right */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--color-accent)]/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-[var(--color-action)]/20 blur-2xl" />

      <div className="relative">
        <p className="text-sm text-white/70">Wallet balance</p>
        <div className="mt-1 flex items-center gap-3">
          <p className="font-mono text-3xl font-bold tracking-tight sm:text-4xl">
            {hidden ? "₦ • • • • • •" : formatNaira(balance)}
          </p>
          <button
            onClick={() => setHidden((v) => !v)}
            aria-label={hidden ? "Show balance" : "Hide balance"}
            className="text-white/70 transition-colors hover:text-white"
          >
            {hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        <p className="mt-2 text-xs text-white/50">Last funded: Today, 10:23 AM</p>
      </div>
    </div>
  );
}
