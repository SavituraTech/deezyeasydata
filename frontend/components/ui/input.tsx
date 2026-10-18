"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leftIcon, rightIcon, error, ...props }, ref) => {
    const baseStyles =
      "flex h-12 w-full rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--foreground)] shadow-[var(--shadow-sm)] transition-all duration-[var(--duration-fast)] placeholder:text-[var(--color-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--muted)]";

    const borderStyles = error
      ? "border-[var(--color-error)] bg-[var(--color-error-bg)]"
      : "border-[var(--color-border)] focus-visible:border-[var(--color-border-focus)]";

    if (leftIcon || rightIcon) {
      return (
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3.5 text-[var(--color-text-secondary)] [&_svg]:h-4.5 [&_svg]:w-4.5">
              {leftIcon}
            </span>
          )}
          <input
            type={type}
            ref={ref}
            className={cn(baseStyles, borderStyles, leftIcon && "pl-11", rightIcon && "pr-11", className)}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3.5 text-[var(--color-text-secondary)] [&_svg]:h-4.5 [&_svg]:w-4.5">
              {rightIcon}
            </span>
          )}
        </div>
      );
    }
    return (
      <input
        type={type}
        ref={ref}
        className={cn(baseStyles, borderStyles, className)}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
