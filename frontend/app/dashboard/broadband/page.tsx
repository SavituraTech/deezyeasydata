import type { Metadata } from "next";
import { BroadbandForm } from "@/components/dashboard/services/broadband-form";

export const metadata: Metadata = { title: "Broadband" };

export default function BroadbandPage() {
  return <BroadbandForm />;
}
