"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QUICK_ACTIONS } from "@/constants";
import { Card } from "@/components/ui/card";

export function QuickActions() {
  return (
    <Card variant="bordered" className="p-[var(--space-5)]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[var(--foreground)]">Quick actions</h2>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Top up a service in seconds
          </p>
        </div>
        <Link
          href="/dashboard/products"
          className="flex items-center gap-1 text-xs font-medium text-[var(--color-action)] hover:underline"
        >
          View all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              aria-label={action.label}
              className="group flex flex-col items-center gap-2.5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3 text-center transition-all duration-[var(--duration-base)] hover:-translate-y-0.5 hover:border-[var(--color-accent)] hover:shadow-[var(--shadow-md)]"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-[var(--radius-lg)] transition-colors ${action.color} ${action.bg}`}>
                <Icon className="h-5 w-5 transition-transform duration-[var(--duration-base)] group-hover:scale-110" aria-hidden="true" />
              </span>
              <span className="text-xs font-medium text-[var(--foreground)] whitespace-nowrap">{action.label}</span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
