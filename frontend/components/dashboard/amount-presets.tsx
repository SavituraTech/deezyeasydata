"use client";

import { cn, formatNaira } from "@/lib/utils";

export function AmountPresets({
  presets,
  value,
  onSelect,
}: {
  presets: number[];
  value: number | null;
  onSelect: (amount: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {presets.map((amount) => (
        <button
          key={amount}
          type="button"
          onClick={() => onSelect(amount)}
          className={cn(
            "rounded-xl border py-3 text-sm font-semibold transition-all",
            value === amount
              ? "border-[var(--color-action)] bg-[var(--color-action-subtle)] text-[var(--color-action)] ring-2 ring-[var(--color-action)]/20"
              : "border-border text-foreground hover:border-[var(--color-action)]/40"
          )}
        >
          {formatNaira(amount, { compact: true })}
        </button>
      ))}
    </div>
  );
}
