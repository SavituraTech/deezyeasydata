import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { ConsoleNav } from "@/components/dashboard/admin/console-nav";
import { Shield } from "lucide-react";

export const metadata: Metadata = { title: "Admin Console" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-action-subtle)] text-[var(--color-action)]">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Admin Console
          </h1>
          <p className="text-sm text-muted-foreground">Platform management & monitoring</p>
        </div>
      </div>
      <ConsoleNav />
      {children}
    </div>
  );
}
