import type { Metadata } from "next";
import { SettingsView } from "@/components/dashboard/admin/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default function AdminSettingsPage() {
  return <SettingsView />;
}
