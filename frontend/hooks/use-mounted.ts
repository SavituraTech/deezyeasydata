"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Returns false during SSR and the first client render, true afterwards.
 * Uses useSyncExternalStore so it avoids the set-state-in-effect pattern and
 * cleanly guards against hydration mismatches (e.g. theme-dependent UI).
 */
export function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
