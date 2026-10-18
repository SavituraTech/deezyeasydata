import type { Metadata } from "next";
import { WalletAdjustmentsView } from "@/components/dashboard/admin/wallet-adjustments-view";

export const metadata: Metadata = { title: "Approvals" };

export default function AdminApprovalsPage() {
  return <WalletAdjustmentsView />;
}
