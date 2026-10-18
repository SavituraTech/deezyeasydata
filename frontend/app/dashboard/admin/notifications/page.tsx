import type { Metadata } from "next";
import { NotificationsView } from "@/components/dashboard/admin/notifications-view";

export const metadata: Metadata = { title: "Notifications" };

export default function AdminNotificationsPage() {
  return <NotificationsView />;
}
