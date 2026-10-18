import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireAuth } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, user } = await requireAuth();
  return (
    <DashboardShell initialRole={role} user={user}>
      {children}
    </DashboardShell>
  );
}
