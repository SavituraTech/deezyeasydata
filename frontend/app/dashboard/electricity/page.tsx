import type { Metadata } from "next";
import { ElectricityForm } from "@/components/dashboard/services/electricity-form";

export const metadata: Metadata = { title: "Pay Electricity" };

export default function ElectricityPage() {
  return <ElectricityForm />;
}
