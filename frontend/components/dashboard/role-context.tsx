"use client";

import * as React from "react";
import type { UserRole } from "@/types";
import type { ApiUser } from "@/lib/api";

interface RoleContextValue {
  role: UserRole;
  isAdmin: boolean;
  user: ApiUser;
}

const RoleContext = React.createContext<RoleContextValue | null>(null);

export function RoleProvider({
  initialRole,
  user,
  children,
}: {
  initialRole: UserRole;
  user: ApiUser;
  children: React.ReactNode;
}) {
  const value = React.useMemo<RoleContextValue>(
    () => ({ role: initialRole, isAdmin: initialRole === "admin", user }),
    [initialRole, user]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = React.useContext(RoleContext);
  if (!ctx) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return ctx;
}
