import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@/types";
import type { ApiUser } from "@/lib/api";
import { authApi } from "@/lib/api";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  COOKIE_MAX_AGE,
  parseRole,
} from "@/lib/roles";

export async function getTokens(): Promise<{ access: string; refresh: string } | null> {
  const store = await cookies();
  const access = store.get(ACCESS_TOKEN_COOKIE)?.value;
  const refresh = store.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!access || !refresh) return null;
  return { access, refresh };
}

export async function getRole(): Promise<UserRole> {
  const tokens = await getTokens();
  if (!tokens) return "user";
  try {
    const user = await authApi.me(tokens.access);
    return parseRole(user.role, user.is_superuser);
  } catch {
    return "user";
  }
}

export async function getCurrentUser(): Promise<ApiUser | null> {
  const tokens = await getTokens();
  if (!tokens) return null;
  try {
    return await authApi.me(tokens.access);
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<{ role: UserRole; user: ApiUser }> {
  const tokens = await getTokens();
  if (!tokens) {
    redirect("/login");
  }
  try {
    const user = await authApi.me(tokens!.access);
    return { role: parseRole(user.role, user.is_superuser), user };
  } catch {
    redirect("/api/auth/logout");
  }
}

export async function requireAdmin(): Promise<void> {
  const { role } = await requireAuth();
  if (role !== "admin") {
    redirect("/dashboard?denied=admin");
  }
}

export async function setAuthCookies(access: string, refresh: string): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_TOKEN_COOKIE, access, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  store.set(REFRESH_TOKEN_COOKIE, refresh, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
  });
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_TOKEN_COOKIE);
  store.delete(REFRESH_TOKEN_COOKIE);
}
