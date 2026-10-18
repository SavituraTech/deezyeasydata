"use client";

import * as React from "react";
import {
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  RotateCcw,
  X,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminApi, getClientToken, type ApiTransaction, type ApiTransactionDetail } from "@/lib/api";
import { formatNaira, formatDateTime } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; variant: "success" | "destructive" | "warning" }> = {
  SUCCESS: { label: "Success", variant: "success" },
  FAILED: { label: "Failed", variant: "destructive" },
  PENDING: { label: "Pending", variant: "warning" },
};

const TYPE_CONFIG: Record<string, string> = {
  AIRTIME: "Airtime",
  DATA: "Data",
  ELECTRICITY: "Electricity",
  CABLE: "Cable TV",
  BROADBAND: "Broadband",
  EDUCATION: "Education",
  DEPOSIT: "Deposit",
};

export function TransactionsView() {
  const [transactions, setTransactions] = React.useState<ApiTransaction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);
  const pageSize = 20;

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [refundedFilter, setRefundedFilter] = React.useState<string>("all");

  const [selectedTx, setSelectedTx] = React.useState<ApiTransactionDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [resolveOpen, setResolveOpen] = React.useState(false);
  const [resolveAction, setResolveAction] = React.useState<"success" | "fail" | "refund">("success");
  const [resolveNote, setResolveNote] = React.useState("");
  const [resolveRef, setResolveRef] = React.useState("");
  const [resolving, setResolving] = React.useState(false);

  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [bulkRefundOpen, setBulkRefundOpen] = React.useState(false);
  const [bulkNote, setBulkNote] = React.useState("");
  const [bulkRefunding, setBulkRefunding] = React.useState(false);

  const fetchTransactions = React.useCallback(async () => {
    setLoading(true);
    try {
      const token = getClientToken();
      if (!token) return;
      const params: Record<string, unknown> = { page, page_size: pageSize };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== "all") params.status = statusFilter;
      if (typeFilter !== "all") params.type = typeFilter;
      if (refundedFilter === "refunded") params.refunded = true;
      if (refundedFilter === "not_refunded") params.refunded = false;
      const res = await adminApi.transactions(token, params as Parameters<typeof adminApi.transactions>[1]);
      setTransactions(res?.results ?? []);
      setTotalCount(res?.count ?? 0);
    } catch {
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, typeFilter, refundedFilter]);

  React.useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTransactions();
  };

  const openDetail = async (tx: ApiTransaction) => {
    setDetailLoading(true);
    setSelectedTx(null);
    try {
      const token = getClientToken();
      if (!token) return;
      const detail = await adminApi.transactionDetail(token, tx.id);
      setSelectedTx(detail);
    } catch {
      toast.error("Failed to load transaction detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedTx || !resolveNote.trim()) {
      toast.error("Note is required");
      return;
    }
    setResolving(true);
    try {
      const token = getClientToken();
      if (!token) return;
      await adminApi.resolveTransaction(token, selectedTx.id, {
        action: resolveAction,
        note: resolveNote.trim(),
        provider_reference: resolveRef.trim() || undefined,
      });
      toast.success(`Transaction ${resolveAction === "success" ? "marked as successful" : resolveAction === "fail" ? "marked as failed" : "refunded"}`);
      setResolveOpen(false);
      setResolveNote("");
      setResolveRef("");
      fetchTransactions();
      if (selectedTx) {
        const detail = await adminApi.transactionDetail(token, selectedTx.id);
        setSelectedTx(detail);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Resolution failed";
      toast.error(msg);
    } finally {
      setResolving(false);
    }
  };

  const handleBulkRefund = async () => {
    if (!bulkNote.trim()) {
      toast.error("Note is required for bulk refund");
      return;
    }
    setBulkRefunding(true);
    try {
      const token = getClientToken();
      if (!token) return;
      const ids = Array.from(selectedIds);
      const res = await adminApi.bulkRefund(token, { transaction_ids: ids, note: bulkNote.trim() });
      toast.success(`Refunded ${res.refunded_count} transaction(s)`);
      setBulkRefundOpen(false);
      setBulkNote("");
      setSelectedIds(new Set());
      fetchTransactions();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Bulk refund failed";
      toast.error(msg);
    } finally {
      setBulkRefunding(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const refundableTxs = transactions.filter(
    (t) => t.status === "FAILED" && !t.is_refunded
  );
  const allSelected = refundableTxs.length > 0 && refundableTxs.every((t) => selectedIds.has(t.id));

  const totalPages = Math.ceil(totalCount / pageSize);
  const activeFilterCount = [statusFilter !== "all", typeFilter !== "all", refundedFilter !== "all", search.trim()].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by target, type, reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11"
          />
        </form>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]">
              <Filter className="h-3.5 w-3.5" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="SUCCESS">Success</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]">
              <Filter className="h-3.5 w-3.5" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(TYPE_CONFIG).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={refundedFilter} onValueChange={(v) => { setRefundedFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]">
              <Filter className="h-3.5 w-3.5" />
              <SelectValue placeholder="Refund" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All refunds</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
              <SelectItem value="not_refunded">Not refunded</SelectItem>
            </SelectContent>
          </Select>
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter("all");
                setTypeFilter("all");
                setRefundedFilter("all");
                setSearch("");
                setPage(1);
              }}
            >
              <X className="h-3.5 w-3.5" />
              Clear ({activeFilterCount})
            </Button>
          )}
        </div>
      </div>

      {refundableTxs.length > 0 && (
        <Card className="flex items-center gap-3 p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (allSelected) {
                setSelectedIds(new Set());
              } else {
                setSelectedIds(new Set(refundableTxs.map((t) => t.id)));
              }
            }}
          >
            {allSelected ? "Deselect all" : "Select all refundable"}
          </Button>
          {selectedIds.size > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBulkRefundOpen(true)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Bulk refund ({selectedIds.size})
            </Button>
          )}
        </Card>
      )}

      <Card className="p-5">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No transactions found.</p>
          ) : (
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-3 font-medium">ID</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Target</th>
                  <th className="pb-3 text-right font-medium">Amount</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Refund</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4 font-medium text-foreground">#{tx.id}</td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline">{TYPE_CONFIG[tx.transaction_type] || tx.transaction_type}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground max-w-[160px] truncate">{tx.target || "—"}</td>
                    <td className="py-3 pr-4 text-right font-medium text-foreground">{formatNaira(Number(tx.amount))}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={STATUS_CONFIG[tx.status]?.variant || "default"}>
                        {STATUS_CONFIG[tx.status]?.label || tx.status}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4">
                      {tx.is_refunded ? (
                        <Badge variant="success">Refunded</Badge>
                      ) : tx.status === "FAILED" ? (
                        <Badge variant="warning">Pending</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{formatDateTime(tx.created_at)}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {tx.status === "FAILED" && !tx.is_refunded && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(tx.id)}
                            onChange={() => toggleSelect(tx.id)}
                            className="h-4 w-4 rounded border-border"
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetail(tx)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
      </Card>

      <Dialog open={!!selectedTx || detailLoading} onOpenChange={(open) => { if (!open) { setSelectedTx(null); setResolveOpen(false); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailLoading && !selectedTx ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : selectedTx ? (
            <>
              <DialogHeader>
                <DialogTitle>Transaction #{selectedTx.id}</DialogTitle>
                <DialogDescription>
                  {TYPE_CONFIG[selectedTx.transaction_type] || selectedTx.transaction_type} &middot; {formatDateTime(selectedTx.created_at)}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="text-lg font-semibold">{formatNaira(Number(selectedTx.amount))}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={STATUS_CONFIG[selectedTx.status]?.variant || "default"}>
                    {STATUS_CONFIG[selectedTx.status]?.label || selectedTx.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Target</p>
                  <p className="font-medium">{selectedTx.target || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Product</p>
                  <p className="font-medium">{selectedTx.product_name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Provider Reference</p>
                  <p className="font-mono text-xs">{selectedTx.provider_reference || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="text-sm">{selectedTx.description || "—"}</p>
                </div>
                {selectedTx.is_refunded && (
                  <>
                    <div>
                      <p className="text-xs text-muted-foreground">Refund Reference</p>
                      <p className="font-mono text-xs">{selectedTx.refund_reference || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Refunded At</p>
                      <p className="text-sm">{selectedTx.refunded_at ? formatDateTime(selectedTx.refunded_at) : "—"}</p>
                    </div>
                  </>
                )}
              </div>

              {selectedTx.provider_request && (
                <div className="mt-4">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Provider Request</p>
                  <pre className="overflow-x-auto rounded-xl bg-muted p-3 text-xs">
                    {JSON.stringify(selectedTx.provider_request, null, 2)}
                  </pre>
                </div>
              )}

              {selectedTx.provider_response && (
                <div className="mt-4">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Provider Response</p>
                  <pre className="overflow-x-auto rounded-xl bg-muted p-3 text-xs">
                    {JSON.stringify(selectedTx.provider_response, null, 2)}
                  </pre>
                </div>
              )}

              <DialogFooter>
                {selectedTx.status === "PENDING" && (
                  <Button
                    onClick={() => {
                      setResolveAction("success");
                      setResolveOpen(true);
                    }}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Mark Success
                  </Button>
                )}
                {selectedTx.status === "PENDING" && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setResolveAction("fail");
                      setResolveOpen(true);
                    }}
                  >
                    <XCircle className="h-4 w-4" />
                    Mark Failed
                  </Button>
                )}
                {selectedTx.status === "FAILED" && !selectedTx.is_refunded && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setResolveAction("refund");
                      setResolveOpen(true);
                    }}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Refund
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resolveAction === "success" ? "Mark as Successful" : resolveAction === "fail" ? "Mark as Failed" : "Refund Transaction"}
            </DialogTitle>
            <DialogDescription>
              {resolveAction === "refund"
                ? "This will refund the full amount to the user's wallet."
                : "Provide a note explaining this action."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {resolveAction === "success" && (
              <div>
                <label className="mb-1 block text-sm font-medium">Provider Reference (optional)</label>
                <Input
                  placeholder="Provider reference"
                  value={resolveRef}
                  onChange={(e) => setResolveRef(e.target.value)}
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">Note (required)</label>
              <textarea
                className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                rows={3}
                placeholder="Explain why you are taking this action..."
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOpen(false)}>Cancel</Button>
            <Button loading={resolving} onClick={handleResolve}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkRefundOpen} onOpenChange={setBulkRefundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Refund ({selectedIds.size} transactions)</DialogTitle>
            <DialogDescription>
              This will refund all selected failed transactions. A note is required for the audit log.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="mb-1 block text-sm font-medium">Note (required)</label>
            <textarea
              className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              placeholder="Explain why you are processing this bulk refund..."
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkRefundOpen(false)}>Cancel</Button>
            <Button loading={bulkRefunding} onClick={handleBulkRefund}>
              Confirm Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
