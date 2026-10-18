"use client";

import { Check } from "lucide-react";
import type { Provider } from "@/types";
import { cn } from "@/lib/utils";
import { NETWORK_LOGOS, getProductLogo } from "@/data/service-images";
import { ProductLogo } from "@/components/dashboard/product-logo";

const NETWORK_BG: Record<string, { bg: string; text: string }> = {
  MTN: { bg: "bg-[var(--color-accent)]-400", text: "text-[var(--color-accent)]-900" },
  AIRTEL: { bg: "bg-red-500", text: "text-white" },
  GLO: { bg: "bg-green-500", text: "text-white" },
  "9MOBILE": { bg: "bg-emerald-700", text: "text-white" },
};

function ProviderAvatar({
  provider,
  size,
}: {
  provider: Provider;
  size: "default" | "large";
}) {
  const dims = size === "large" ? "h-14 w-14" : "h-12 w-12";
  const textClass = size === "large" ? "text-base" : "text-sm";

  const logoUrl = provider.image_url || getProductLogo({ provider: provider.id }) || NETWORK_LOGOS[provider.id] || null;

  if (logoUrl) {
    return (
      <span className={cn("relative flex items-center justify-center rounded-xl bg-[var(--color-surface-elevated)] overflow-hidden", dims)}>
        <ProductLogo
          product={{ image_url: provider.image_url, provider: provider.id }}
          alt={provider.name}
          className="h-full w-full object-contain p-1"
        />
      </span>
    );
  }

  const networkStyle = NETWORK_BG[provider.id];
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-xl font-bold",
        dims,
        textClass,
        networkStyle ? `${networkStyle.bg} ${networkStyle.text}` : provider.color
      )}
    >
      {provider.short}
    </span>
  );
}

export function ProviderPicker({
  providers,
  value,
  onChange,
  columns = 4,
  size = "default",
}: {
  providers: Provider[];
  value: string;
  onChange: (id: string) => void;
  columns?: 3 | 4 | 5;
  size?: "default" | "large";
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        columns === 3 && "grid-cols-3",
        columns === 4 && "grid-cols-2 sm:grid-cols-4",
        columns === 5 && "grid-cols-3 sm:grid-cols-5"
      )}
    >
      {providers.map((p) => {
        const active = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            className={cn(
              "relative flex flex-col items-center gap-2.5 rounded-xl border-2 p-4 text-center transition-all",
              active
                ? "border-[var(--color-action)] bg-[var(--color-action-subtle)] ring-2 ring-[var(--color-action)]/20 shadow-sm"
                : "border-border hover:border-[var(--color-action)]/40 hover:bg-muted/50",
              size === "large" && "p-5"
            )}
          >
            <ProviderAvatar provider={p} size={size} />
            <span className={cn(
              "line-clamp-1 font-medium text-foreground",
              size === "large" ? "text-sm" : "text-xs"
            )}>
              {p.name}
            </span>
            {active && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-action)] text-white">
                <Check className="h-3 w-3" aria-hidden="true" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
