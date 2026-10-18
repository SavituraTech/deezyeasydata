import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names and resolve Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as Nigerian Naira currency. */
export function formatNaira(amount: number, opts?: { compact?: boolean }) {
  if (opts?.compact && Math.abs(amount) >= 1000) {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Short, human date like "Jul 19, 2026". */
export function formatDate(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Date + time, e.g. "Jul 19, 2026, 2:30 PM". */
export function formatDateTime(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toLocaleString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Relative time like "2h ago" for notifications and activity. */
export function timeAgo(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  const units: [number, string][] = [
    [60, "s"],
    [60, "m"],
    [24, "h"],
    [7, "d"],
    [4.34, "w"],
    [12, "mo"],
    [Number.POSITIVE_INFINITY, "y"],
  ];
  let value = seconds;
  let unit = "s";
  for (const [factor, label] of units) {
    if (Math.abs(value) < factor) {
      unit = label;
      break;
    }
    value = value / factor;
    unit = label;
  }
  const rounded = Math.floor(value);
  return rounded <= 0 ? "just now" : `${rounded}${unit} ago`;
}

/** Random reference id for mock transactions. */
export function generateRef(prefix = "NDS") {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}${Date.now()
    .toString()
    .slice(-4)}`;
}

/** Extract an array from either a paginated response, a DBN-style envelope, or a plain array. */
export function toArray<T>(data: T[] | { results?: T[] } | { data?: T[] } | null | undefined): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    if ("results" in data && Array.isArray(data.results)) return data.results;
    if ("data" in data && Array.isArray(data.data)) return data.data as T[];
  }
  return [];
}

/** Initials from a full name. */
export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}
