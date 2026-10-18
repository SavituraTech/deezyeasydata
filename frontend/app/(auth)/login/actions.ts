"use server";

import { redirect } from "next/navigation";
import { authApi, ApiError } from "@/lib/api";
import { setAuthCookies, clearAuthCookies } from "@/lib/auth";

export async function loginAction(
  username: string,
  password: string
): Promise<{ error?: string }> {
  try {
    const tokens = await authApi.login(username, password);
    await setAuthCookies(tokens.access, tokens.refresh);
  } catch (e) {
    if (e instanceof ApiError) {
      return { error: e.message };
    }
    return { error: "Network error. Please try again." };
  }
  redirect("/dashboard");
}

export async function registerAction(
  username: string,
  phone: string,
  password: string,
  email: string,
  password_confirm?: string
): Promise<{ error?: string }> {
  try {
    const tokens = await authApi.register({ username, phone, password, password_confirm: password_confirm || password, email });
    await setAuthCookies(tokens.access, tokens.refresh);
  } catch (e) {
    if (e instanceof ApiError) {
      const data = e.data as Record<string, unknown> | null;
      if (data) {
        const messages: string[] = [];
        for (const [key, val] of Object.entries(data)) {
          if (Array.isArray(val)) {
            messages.push(`${key}: ${val.join(", ")}`);
          }
        }
        if (messages.length > 0) return { error: messages.join("\n") };
      }
      return { error: e.message };
    }
    return { error: "Network error. Please try again." };
  }
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await clearAuthCookies();
  redirect("/login");
}
