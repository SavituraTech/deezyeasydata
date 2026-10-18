"use client";

import * as React from "react";
import { Search, Shield } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminApi, getClientToken, type AdminAuditLogEntry } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

const ACTION_CONFIG: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "teal" | "navy" | "default" }> = {
  RESOLVE_SUCCESS: { label: "Resolve Success", variant: "success" },
  RESOLVE_FAIL: { label: "Resolve Fail", variant: "destructive" },
  RESOLVE_REFUND: { label: "Resolve Refund", variant: "warning" },
  BULK_REFUND: { label: "Bulk Refund", variant: "warning" },
  WALLET_CREDIT: { label: "Wallet Credit", variant: "teal" },
  WALLET_DEBIT: { label: "Wallet Debit", variant: "navy" },
  USER_CREATE: { label: "User Create", variant: "teal" },
  USER_UPDATE: { label: "User Update", variant: "default" },
  USER_SUSPEND: { label: "User Suspend", variant: "destructive" },
  USER_DELETE: { label: "User Delete", variant: "destructive" },
  ADJUSTMENT_REJECTED: { label: "Adjustment Rejected", variant: "destructive" },
  PASSWORD_RESET: { label: "Password Reset", variant: "warning" },
};

export function AuditLogView() {
  const [entries, setEntries] = React.useState<AdminAuditLogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);
  const pageSize = 50;

  const [actionFilter, setActionFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");

  const fetchLog = React.useCallback(async () => {
    setLoading(true);
    try {
      const token = getClientToken();
      if (!token) return;
      const params: Record<string, unknown> = { page, page_size: pageSize };
      if (actionFilter !== "all") params.action = actionFilter;
      const res = await adminApi.auditLog(token, params as Parameters<typeof adminApi.auditLog>[1]);
      setEntries(res?.results ?? []);
      setTotalCount(res?.count ?? 0);
    } catch {
      toast.error("Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  React.useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  const filtered = entries.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.admin.toLowerCase().includes(q) ||
      e.action.toLowerCase().includes(q) ||
      (e.target_user || "").toLowerCase().includes(q) ||
      e.note.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(totalCount / pageSize);
  const actionTypes = Object.keys(ACTION_CONFIG);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Track all admin actions across the platform.</p>
        <div className="flex items-center gap-3">
          <form onSubmit={(e) => e.preventDefault()} className="relative max-w-sm">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by admin, action, user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11"
            />
          </form>
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <Shield className="h-3.5 w-3.5" />
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actionTypes.map((key) => (
                <SelectItem key={key} value={key}>
                  {ACTION_CONFIG[key]?.label || key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="p-5">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No audit entries found.</p>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Admin</th>
                  <th className="pb-3 font-medium">Action</th>
                  <th className="pb-3 font-medium">Txn ID</th>
                  <th className="pb-3 font-medium">Target User</th>
                  <th className="pb-3 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const actionCfg = ACTION_CONFIG[entry.action];
                  return (
                    <tr key={entry.id} className="border-b border-border last:border-0">
                      <td className="py-3 pr-4 text-muted-foreground">{formatDateTime(entry.created_at)}</td>
                      <td className="py-3 pr-4 font-medium text-foreground">{entry.admin}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={actionCfg?.variant || "default"}>
                          {actionCfg?.label || entry.action}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {entry.transaction_id ? `#${entry.transaction_id}` : "—"}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{entry.target_user || "—"}</td>
                      <td className="py-3 pr-4 max-w-[200px] truncate text-muted-foreground">{entry.note || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
      </Card>
    </div>
  );
}
