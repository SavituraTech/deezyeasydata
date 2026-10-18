import type { Metadata } from "next";
import { ProvidersView } from "@/components/dashboard/admin/providers-view";

export const metadata: Metadata = { title: "Providers" };

export default function AdminProvidersPage() {
  return <ProvidersView />;
}
