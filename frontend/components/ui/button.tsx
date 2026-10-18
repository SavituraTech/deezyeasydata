"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-all duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // primary + accent are aliases (same visual) for backward compat
        primary:
          "bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)] shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] rounded-[var(--radius-md)]",
        accent:
          "bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)] shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] rounded-[var(--radius-md)]",
        secondary:
          "border border-[var(--color-border)] bg-transparent text-[var(--color-primary)] hover:bg-[var(--muted)] shadow-[var(--shadow-sm)] rounded-[var(--radius-md)]",
        ghost:
          "text-[var(--color-text-secondary)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] rounded-[var(--radius-md)]",
        // pill-style CTA — matches review spec: action (pill #0066FF)
        action:
          "bg-[var(--color-action)] text-[var(--color-text-inverse)] hover:bg-[var(--color-action)]/90 shadow-[var(--shadow-glow)] rounded-[var(--radius-full)]",
        outline:
          "border border-[var(--color-border)] bg-transparent text-[var(--color-primary)] hover:bg-[var(--muted)] shadow-[var(--shadow-sm)] rounded-[var(--radius-md)]",
        // destructive + danger are aliases
        destructive:
          "bg-[var(--color-error)] text-[var(--color-text-inverse)] hover:bg-[var(--color-error)]/90 shadow-[var(--shadow-sm)] rounded-[var(--radius-md)]",
        danger:
          "bg-[var(--color-error)] text-[var(--color-text-inverse)] hover:bg-[var(--color-error)]/90 shadow-[var(--shadow-sm)] rounded-[var(--radius-md)]",
        link: "text-[var(--color-action)] underline-offset-4 hover:underline rounded-none",
        // teal maps to cashback green (#3CB043)
        teal: "bg-[var(--color-success)] text-[var(--color-text-inverse)] hover:bg-[var(--color-success)]/90 shadow-[var(--shadow-sm)] rounded-[var(--radius-md)]",
      },
      size: {
        sm: "h-9 px-4 text-xs rounded-[var(--radius-md)]",
        md: "h-11 px-6 rounded-[var(--radius-md)]",
        lg: "h-14 px-8 text-base rounded-[var(--radius-md)]",
        icon: "h-10 w-10 rounded-[var(--radius-md)]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    if (asChild) {
      return (
        <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Comp>
      );
    }
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
