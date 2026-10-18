import type { Metadata } from "next";
import { UserDetailView } from "@/components/dashboard/admin/user-detail-view";

export const metadata: Metadata = { title: "User Detail" };

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserDetailView userId={Number(id)} />;
}
