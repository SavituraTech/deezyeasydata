"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  autoFocus?: boolean;
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  className,
  autoFocus,
}: OtpInputProps) {
  const inputs = React.useRef<Array<HTMLInputElement | null>>([]);

  const handleChange = (index: number, char: string) => {
    const digit = char.replace(/\D/g, "").slice(-1);
    const next = value.split("");
    next[index] = digit;
    const joined = next.join("").slice(0, length);
    onChange(joined);
    if (digit && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < length - 1) inputs.current[index + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    onChange(pasted);
    const focusIndex = Math.min(pasted.length, length - 1);
    inputs.current[focusIndex]?.focus();
  };

  return (
    <div className={cn("flex gap-2 sm:gap-3", className)}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          autoFocus={autoFocus && i === 0}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          aria-label={`Digit ${i + 1}`}
          className="h-12 w-11 rounded-xl border border-input bg-card text-center text-lg font-semibold text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-14 sm:w-12"
        />
      ))}
    </div>
  );
}
