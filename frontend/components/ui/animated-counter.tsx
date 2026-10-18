"use client";

import * as React from "react";
import { useSpring, useMotionValue, useTransform, animate } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export function AnimatedCounter({
  value,
  format = (n) => String(n),
  duration = 0.8,
  className,
  prefix,
  suffix,
}: AnimatedCounterProps) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => Math.round(v));
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    const controls = animate(motionValue, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplayValue(Math.round(latest)),
    });
    return controls.stop;
  }, [value, duration, motionValue]);

  return (
    <span className={className}>
      {prefix}{format(displayValue)}{suffix}
    </span>
  );
}
