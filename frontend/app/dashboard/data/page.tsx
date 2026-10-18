import type { Metadata } from "next";
import { DataForm } from "@/components/dashboard/services/data-form";

export const metadata: Metadata = { title: "Buy Data" };

export default function DataPage() {
  return <DataForm />;
}
