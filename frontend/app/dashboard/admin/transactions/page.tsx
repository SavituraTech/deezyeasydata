import type { Metadata } from "next";
import { TransactionsView } from "@/components/dashboard/admin/transactions-view";

export const metadata: Metadata = { title: "Transactions" };

export default function AdminTransactionsPage() {
  return <TransactionsView />;
}
