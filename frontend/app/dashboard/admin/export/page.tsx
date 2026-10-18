import type { Metadata } from "next";
import { ExportView } from "@/components/dashboard/admin/export-view";

export const metadata: Metadata = { title: "Export" };

export default function AdminExportPage() {
  return <ExportView />;
}
