import type { UserRole } from "@/types";

export const ACCESS_TOKEN_COOKIE = "deezy_access";
export const REFRESH_TOKEN_COOKIE = "deezy_refresh";

export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function parseRole(value: string | null | undefined, is_superuser?: boolean): UserRole {
  if (value === "ADMIN" || is_superuser) return "admin";
  return "user";
}

export function isAdminRole(role: string | null | undefined, is_superuser?: boolean): boolean {
  return role === "ADMIN" || !!is_superuser;
}
