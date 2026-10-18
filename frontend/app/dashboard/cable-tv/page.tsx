import type { Metadata } from "next";
import { CableForm } from "@/components/dashboard/services/cable-form";

export const metadata: Metadata = { title: "Cable TV" };

export default function CableTvPage() {
  return <CableForm />;
}
