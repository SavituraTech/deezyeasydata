"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, Inbox, ChevronLeft, ChevronRight } from "lucide-react";
import type { Transaction, TransactionStatus, TransactionType } from "@/types";
import type { ApiTransaction } from "@/lib/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { TransactionItem } from "@/components/cards/transaction-item";
import { TransactionDetailDialog } from "./transaction-detail-dialog";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFetch } from "@/hooks/use-api";
import type { PaginatedResponse } from "@/lib/api";

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

const TYPE_OPTIONS: { value: TransactionType | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "airtime", label: "Airtime" },
  { value: "data", label: "Data" },
  { value: "broadband", label: "Broadband" },
  { value: "electricity", label: "Electricity" },
  { value: "cable", label: "Cable TV" },
  { value: "education", label: "Education" },
  { value: "wallet-funding", label: "Wallet funding" },
];

const STATUS_OPTIONS: { value: TransactionStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "success", label: "Successful" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
];

const TYPE_TO_API: Record<string, string> = {
  airtime: "AIRTIME",
  data: "DATA",
  electricity: "ELECTRICITY",
  cable: "CABLE",
  broadband: "BROADBAND",
  education: "EDUCATION",
  "wallet-funding": "DEPOSIT",
};
const STATUS_TO_API: Record<string, string> = {
  success: "SUCCESS",
  pending: "PENDING",
  failed: "FAILED",
};

export function TransactionsView() {
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(searchParams.get("q") ?? "");
  const [debouncedQuery, setDebouncedQuery] = React.useState(searchParams.get("q") ?? "");
  const [type, setType] = React.useState<TransactionType | "all">("all");
  const [status, setStatus] = React.useState<TransactionStatus | "all">("all");
  const [page, setPage] = React.useState(1);
  const pageSize = 20;
  const [selected, setSelected] = React.useState<Transaction | null>(null);

  // Debounce search -> avoids spamming backend on every keystroke
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedQuery, type, status]);

  const qs = React.useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedQuery) p.set("search", debouncedQuery);
    if (type !== "all" && TYPE_TO_API[type]) p.set("type", TYPE_TO_API[type]);
    if (status !== "all" && STATUS_TO_API[status]) p.set("status", STATUS_TO_API[status]);
    p.set("page", String(page));
    p.set("page_size", String(pageSize));
    return p.toString();
  }, [debouncedQuery, type, status, page]);

  const path = React.useMemo(() => `/api/transactions/history/?${qs}`, [qs]);
  const { data: apiTxns, loading, error } = useFetch<PaginatedResponse<ApiTransaction>>(path);
  const allTxns = (apiTxns?.results ?? []).map(mapApiTransaction);
  const totalCount = apiTxns?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      <PageHeader title="Transactions" description="Search and review all your account activity." />

      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or reference"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={type} onValueChange={(v) => setType(v as TransactionType | "all")}>
            <SelectTrigger className="sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as TransactionStatus | "all")}>
            <SelectTrigger className="sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 divide-y divide-border">
          {loading ? (
            <div className="space-y-4 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="font-medium text-destructive">Failed to load transactions</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
          ) : allTxns.length > 0 ? (
            <>
              {allTxns.map((tx) => (
                <TransactionItem key={tx.id} tx={tx} onClick={setSelected} />
              ))}
              {totalCount > pageSize && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-xs text-muted-foreground">
                    Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalCount)} of {totalCount}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" /> Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      aria-label="Next page"
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-medium text-foreground">No transactions found</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                {debouncedQuery || type !== "all" || status !== "all"
                  ? "Try adjusting your filters."
                  : "You haven’t made any transactions yet. Start by buying airtime or data."}
              </p>
              {!debouncedQuery && type === "all" && status === "all" && (
                <Button asChild variant="action" className="mt-4">
                  <Link href="/dashboard/airtime">Go buy airtime</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      <TransactionDetailDialog tx={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
