"use client";

import { Check } from "lucide-react";
import type { Provider } from "@/types";
import { cn } from "@/lib/utils";

interface ProviderSelectProps {
  providers: Provider[];
  value: string | null;
  onChange: (id: string) => void;
  columns?: 2 | 3 | 4 | 5;
}

export function ProviderSelect({ providers, value, onChange, columns = 4 }: ProviderSelectProps) {
  const cols = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 md:grid-cols-5",
  }[columns];

  return (
    <div className={cn("grid gap-3", cols)}>
      {providers.map((p) => {
        const active = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            className={cn(
              "group relative flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all",
              active
                ? "border-[var(--color-action)] bg-[var(--color-action-subtle)] ring-2 ring-[var(--color-action)]/40"
                : "border-border hover:border-[var(--color-action)]/50 hover:bg-muted"
            )}
          >
            {active && (
              <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-action)] text-white">
                <Check className="h-3 w-3" />
              </span>
            )}
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold",
                p.color
              )}
            >
              {p.short}
            </span>
            <span className="text-xs font-medium leading-tight text-foreground">{p.name}</span>
          </button>
        );
      })}
    </div>
  );
}
