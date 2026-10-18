import type { Metadata } from "next";
import { AirtimeForm } from "@/components/dashboard/services/airtime-form";

export const metadata: Metadata = { title: "Buy Airtime" };

export default function AirtimePage() {
  return <AirtimeForm />;
}
