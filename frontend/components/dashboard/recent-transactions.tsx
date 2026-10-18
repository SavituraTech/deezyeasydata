"use client";

import * as React from "react";
import type { Transaction } from "@/types";
import type { ApiTransaction } from "@/lib/api";
import { TransactionItem } from "@/components/cards/transaction-item";
import { TransactionDetailDialog } from "./transaction-detail-dialog";

function mapApiTransaction(tx: ApiTransaction): Transaction {
  const typeMap: Record<string, Transaction["type"]> = {
    AIRTIME: "airtime",
    DATA: "data",
    ELECTRICITY: "electricity",
    CABLE: "cable",
    BROADBAND: "broadband",
    EDUCATION: "education",
    DEPOSIT: "wallet-funding",
  };
  const statusMap: Record<string, Transaction["status"]> = {
    SUCCESS: "success",
    PENDING: "pending",
    FAILED: "failed",
  };
  return {
    id: String(tx.id),
    reference: tx.provider_reference || `TXN-${tx.id}`,
    type: typeMap[tx.transaction_type] || "airtime",
    title: tx.product_name,
    description: tx.target,
    amount: Number(tx.amount),
    direction: tx.transaction_type === "DEPOSIT" ? "in" : "out",
    status: statusMap[tx.status] || "pending",
    date: tx.created_at,
  };
}

interface RecentTransactionsProps {
  limit?: number;
  transactions?: ApiTransaction[];
}

export function RecentTransactions({ limit = 5, transactions }: RecentTransactionsProps) {
  const [selected, setSelected] = React.useState<Transaction | null>(null);
  const items = (transactions || []).slice(0, limit).map(mapApiTransaction);

  return (
    <>
      <div className="divide-y divide-border">
        {items.length > 0 ? (
          items.map((tx) => (
            <TransactionItem key={tx.id} tx={tx} onClick={setSelected} />
          ))
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No transactions yet</p>
        )}
      </div>
      <TransactionDetailDialog tx={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </>
  );
}
