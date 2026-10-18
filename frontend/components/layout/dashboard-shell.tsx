"use client";

import * as React from "react";
import { Sidebar, MobileSidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { RoleProvider } from "@/components/dashboard/role-context";
import { UnauthorizedToast } from "@/components/dashboard/unauthorized-toast";
import { DashboardPageWrapper } from "@/components/dashboard/dashboard-page-wrapper";
import type { UserRole } from "@/types";
import type { ApiUser } from "@/lib/api";

export function DashboardShell({
  initialRole,
  user,
  children,
}: {
  initialRole: UserRole;
  user: ApiUser;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <RoleProvider initialRole={initialRole} user={user}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-background focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <UnauthorizedToast />
      <div className="min-h-screen bg-[#f3f7fa] dark:bg-background">
        <Sidebar />
        <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="lg:pl-[260px]">
          <Topbar onMenuClick={() => setMobileOpen(true)} />
          <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1240px] px-4 py-6 sm:px-7 lg:px-10 lg:py-9 focus:outline-none">
            <DashboardPageWrapper>
              {children}
            </DashboardPageWrapper>
          </main>
        </div>
      </div>
    </RoleProvider>
  );
}
