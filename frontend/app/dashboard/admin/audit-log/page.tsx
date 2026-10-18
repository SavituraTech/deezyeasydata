import type { Metadata } from "next";
import { AuditLogView } from "@/components/dashboard/admin/audit-log-view";

export const metadata: Metadata = { title: "Audit Log" };

export default function AdminAuditLogPage() {
  return <AuditLogView />;
}
