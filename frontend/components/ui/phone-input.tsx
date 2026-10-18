"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value?: string;
  onChange?: (value: string) => void;
  dialCode?: string;
}

function stripToNigerianLocal(value: string): string {
  let v = value.replace(/\D/g, "");
  if (v.startsWith("234") && v.length > 11) v = v.slice(3);
  if (v.startsWith("0") && v.length > 11) v = v.slice(0, 11);
  if (!v.startsWith("0") && v.length === 10) v = "0" + v;
  return v.slice(0, 11);
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, value, onChange, dialCode = "+234", ...props }, ref) => {
    return (
      <div
        className={cn(
          "flex h-11 w-full items-center rounded-xl border border-input bg-card shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring",
          className
        )}
      >
        <span className="flex h-full items-center gap-1 border-r border-border px-3 text-sm font-medium text-muted-foreground">
          🇳🇬 {dialCode}
        </span>
        <input
          ref={ref}
          type="tel"
          inputMode="tel"
          value={value}
          onChange={(e) => onChange?.(stripToNigerianLocal(e.target.value))}
          placeholder="803 123 4567"
          className="h-full flex-1 rounded-r-xl bg-transparent px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          {...props}
        />
      </div>
    );
  }
);
PhoneInput.displayName = "PhoneInput";
