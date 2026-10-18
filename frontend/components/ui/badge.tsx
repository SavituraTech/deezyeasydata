import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[var(--radius-full)] px-3 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-[var(--muted)] text-[var(--color-text-secondary)]",
        success: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
        warning: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
        destructive: "bg-[var(--color-error-bg)] text-[var(--color-error)]",
        info: "bg-[#DBEAFE] text-[#2563EB]",
        accent: "bg-[var(--color-accent)]/12 text-[var(--color-accent)]",
        action: "bg-[var(--color-action-subtle)] text-[var(--color-action)]",
        outline: "border border-[var(--color-border)] text-[var(--foreground)]",
        teal: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
        navy: "bg-[var(--color-primary)]/12 text-[var(--color-primary)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
