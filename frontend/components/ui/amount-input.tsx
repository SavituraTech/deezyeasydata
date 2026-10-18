"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface AmountInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value?: number | "";
  onChange?: (value: number | "") => void;
}

export const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    return (
      <div
        className={cn(
          "flex h-14 w-full items-center rounded-xl border border-input bg-card shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring",
          className
        )}
      >
        <span className="pl-4 text-xl font-semibold text-muted-foreground">₦</span>
        <input
          ref={ref}
          type="number"
          inputMode="decimal"
          min={0}
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            onChange?.(v === "" ? "" : Number(v));
          }}
          placeholder="0.00"
          className="h-full flex-1 rounded-r-xl bg-transparent px-2 text-xl font-semibold text-foreground placeholder:text-muted-foreground/60 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          {...props}
        />
      </div>
    );
  }
);
AmountInput.displayName = "AmountInput";
