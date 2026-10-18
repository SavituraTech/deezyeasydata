import type { Metadata } from "next";
import { AnalyticsView } from "@/components/dashboard/admin/analytics-view";

export const metadata: Metadata = { title: "Admin Console" };

export default function AdminPage() {
  return <AnalyticsView />;
}
