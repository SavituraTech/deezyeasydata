"use client";

import * as React from "react";
import { Check, X, Clock } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  adminApi,
  getClientToken,
  type ApiWalletAdjustment,
  type WalletAdjustmentStatus,
} from "@/lib/api";
import { formatNaira, formatDateTime } from "@/lib/utils";

type Tab = "PENDING_APPROVAL" | "APPLIED" | "REJECTED" | "ALL";

const TABS: { value: Tab; label: string }[] = [
  { value: "PENDING_APPROVAL", label: "Pending" },
  { value: "APPLIED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
];

const STATUS_CONFIG: Record<WalletAdjustmentStatus, { label: string; variant: "warning" | "success" | "destructive" }> = {
  PENDING_APPROVAL: { label: "Pending", variant: "warning" },
  APPLIED: { label: "Applied", variant: "success" },
  REJECTED: { label: "Rejected", variant: "destructive" },
};

export function WalletAdjustmentsView() {
  const [tab, setTab] = React.useState<Tab>("PENDING_APPROVAL");
  const [rows, setRows] = React.useState<ApiWalletAdjustment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);
  const [pendingCount, setPendingCount] = React.useState(0);
  const pageSize = 20;

  const [target, setTarget] = React.useState<{ adj: ApiWalletAdjustment; decision: "approve" | "reject" } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const fetchRows = React.useCallback(async () => {
    setLoading(true);
    try {
      const token = getClientToken();
      if (!token) return;
      const res = await adminApi.walletAdjustments(token, {
        status: tab === "ALL" ? undefined : tab,
        page,
        page_size: pageSize,
      });
      setRows(res?.results ?? []);
      setTotalCount(res?.count ?? 0);
      setPendingCount(res?.pending_count ?? 0);
    } catch {
      toast.error("Failed to load adjustments");
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  React.useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const handleDecision = async () => {
    if (!target) return;
    setSubmitting(true);
    try {
      const token = getClientToken();
      if (!token) throw new Error("Not authenticated");
      await adminApi.decideWalletAdjustment(token, target.adj.id, target.decision);
      toast.success(target.decision === "approve" ? "Adjustment approved and applied" : "Adjustment rejected");
      setTarget(null);
      fetchRows();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Action failed");
      // The row may have been decided by someone else meanwhile.
      setTarget(null);
      fetchRows();
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Wallet adjustment approvals</h1>
        <p className="text-sm text-muted-foreground">
          Large manual credits and debits only take effect once a different admin approves them.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button
            key={t.value}
            size="sm"
            variant={tab === t.value ? "teal" : "outline"}
            onClick={() => {
              setTab(t.value);
              setPage(1);
            }}
          >
            {t.label}
            {t.value === "PENDING_APPROVAL" && pendingCount > 0 && (
              <Badge variant="warning" className="ml-2">{pendingCount}</Badge>
            )}
          </Button>
        ))}
      </div>

      <Card className="p-5">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {tab === "PENDING_APPROVAL" ? "Nothing waiting for approval." : "No adjustments found."}
            </p>
          ) : (
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-3 font-medium">User</th>
                  <th className="pb-3 font-medium">Adjustment</th>
                  <th className="pb-3 text-right font-medium">Amount</th>
                  <th className="pb-3 font-medium">Reason</th>
                  <th className="pb-3 font-medium">Requested by</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((adj) => (
                  <tr key={adj.id} className="border-b border-border last:border-0 align-top">
                    <td className="py-3 pr-4 font-medium text-foreground">{adj.user_username}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={adj.type === "CREDIT" ? "teal" : "navy"}>
                        {adj.type === "CREDIT" ? "Credit" : "Debit"}
                      </Badge>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {adj.source === "CASHBACK" ? "Cashback" : "Wallet"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right font-medium text-foreground">
                      {formatNaira(Number(adj.amount))}
                    </td>
                    <td className="py-3 pr-4 max-w-[240px] text-muted-foreground">{adj.reason}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      <div>{adj.admin_username}</div>
                      <div className="text-xs">{formatDateTime(adj.created_at)}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={STATUS_CONFIG[adj.status].variant}>{STATUS_CONFIG[adj.status].label}</Badge>
                      {adj.approved_by_username && adj.decided_at && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          by {adj.approved_by_username}
                        </div>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {adj.status === "PENDING_APPROVAL" ? (
                        adj.can_approve ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="teal" onClick={() => setTarget({ adj, decision: "approve" })}>
                              <Check className="h-3.5 w-3.5" />
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setTarget({ adj, decision: "reject" })}>
                              <X className="h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end gap-1.5">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />
                              Needs another admin
                            </span>
                            <Button size="sm" variant="ghost" onClick={() => setTarget({ adj, decision: "reject" })}>
                              Cancel request
                            </Button>
                          </div>
                        )
                      ) : adj.reference ? (
                        <span className="font-mono text-xs text-muted-foreground">{adj.reference}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
      </Card>

      <Dialog open={!!target} onOpenChange={(open) => { if (!open && !submitting) setTarget(null); }}>
        <DialogContent>
          {target && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {target.decision === "approve"
                    ? "Approve adjustment"
                    : target.adj.can_approve
                      ? "Reject adjustment"
                      : "Cancel request"}
                </DialogTitle>
                <DialogDescription>
                  {target.decision === "approve"
                    ? "This moves the money immediately and cannot be undone from here."
                    : "The wallet will not be changed."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1 rounded-xl border border-border p-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">User</span><span className="font-medium">{target.adj.user_username}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Action</span><span className="font-medium">{target.adj.type === "CREDIT" ? "Credit" : "Debit"} ({target.adj.source === "CASHBACK" ? "cashback" : "wallet"})</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-medium">{formatNaira(Number(target.adj.amount))}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Reason</span><span className="text-right">{target.adj.reason}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Requested by</span><span>{target.adj.admin_username}</span></div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" disabled={submitting} onClick={() => setTarget(null)}>Back</Button>
                <Button
                  size="sm"
                  variant={target.decision === "approve" ? "teal" : "destructive"}
                  loading={submitting}
                  onClick={handleDecision}
                >
                  {target.decision === "approve" ? "Approve & apply" : "Reject"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
