import type { Metadata } from "next";
import { CreateUserView } from "@/components/dashboard/admin/create-user-view";

export const metadata: Metadata = { title: "Create User" };

export default function AdminCreateUserPage() {
  return <CreateUserView />;
}
