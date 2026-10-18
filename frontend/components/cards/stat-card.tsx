import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  change?: number;
  icon: LucideIcon;
  accent?: string;
}

export function StatCard({ label, value, change, icon: Icon, accent = "bg-[var(--color-action-subtle)] text-[var(--color-action)]" }: StatCardProps) {
  const positive = (change ?? 0) >= 0;
  return (
    <Card variant="bordered" className="p-[var(--space-5)]">
      <div className="flex items-start justify-between">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-[var(--radius-lg)]", accent)}>
          <Icon className="h-5 w-5" />
        </div>
        {change !== undefined && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-semibold",
              positive ? "text-[var(--color-success)]" : "text-[var(--color-error)]"
            )}
          >
            {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <p className="mt-4 font-mono text-2xl font-bold tracking-tight text-[var(--foreground)]">{value}</p>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{label}</p>
    </Card>
  );
}
