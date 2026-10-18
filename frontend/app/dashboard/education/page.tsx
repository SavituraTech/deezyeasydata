import type { Metadata } from "next";
import { EducationForm } from "@/components/dashboard/services/education-form";

export const metadata: Metadata = { title: "Education" };

export default function EducationPage() {
  return <EducationForm />;
}
