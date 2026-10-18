"use client";

import * as React from "react";
import { Send, Bell } from "lucide-react";
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
import { notificationApi, getClientToken, type ApiNotification, type NotificationBroadcastParams } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

const SEGMENT_OPTIONS = [
  { value: "all_active", label: "All Active Users" },
  { value: "inactive_30d", label: "Inactive Users (30+ days)" },
  { value: "high_spenders", label: "High Spenders" },
  { value: "top_buyers", label: "Top Buyers by Transaction Count" },
];

const SEGMENT_LABELS: Record<string, string> = {
  all_active: "All Active",
  inactive_30d: "Inactive 30+",
  high_spenders: "High Spenders",
  top_buyers: "Top Buyers",
};

export function NotificationsView() {
  const [notifications, setNotifications] = React.useState<ApiNotification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);
  const pageSize = 20;

  const [broadcastOpen, setBroadcastOpen] = React.useState(false);
  const [broadcasting, setBroadcasting] = React.useState(false);
  const [form, setForm] = React.useState({
    title: "",
    message: "",
    segment: "all_active",
    threshold: "",
    min_transactions: "",
  });

  const fetchNotifications = React.useCallback(async () => {
    setLoading(true);
    try {
      const token = getClientToken();
      if (!token) return;
      const res = await notificationApi.list(token, { page, page_size: pageSize });
      setNotifications(res?.results ?? []);
      setTotalCount(res?.count ?? 0);
    } catch {
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [page]);

  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleBroadcast = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      toast.error("Title and message are required");
      return;
    }
    setBroadcasting(true);
    try {
      const token = getClientToken();
      if (!token) return;
      const payload: NotificationBroadcastParams & { threshold?: number; min_transactions?: number } = {
        title: form.title.trim(),
        message: form.message.trim(),
        segment: form.segment,
      };
      if (form.segment === "high_spenders" && form.threshold) {
        payload.threshold = Number(form.threshold);
      }
      if (form.segment === "top_buyers" && form.min_transactions) {
        payload.min_transactions = Number(form.min_transactions);
      }
      const result = await notificationApi.broadcast(token, payload);
      toast.success(`Notification sent to ${result.recipient_count} users`);
      setBroadcastOpen(false);
      setForm({ title: "", message: "", segment: "all_active", threshold: "", min_transactions: "" });
      fetchNotifications();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Broadcast failed";
      toast.error(msg);
    } finally {
      setBroadcasting(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Past broadcasts and their reach.</p>
        <Button size="sm" onClick={() => setBroadcastOpen(true)}>
          <Send className="h-4 w-4" />
          Broadcast
        </Button>
      </div>

      <Card className="p-5">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No notifications sent yet.</p>
          ) : (
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-3 font-medium">Title</th>
                  <th className="pb-3 font-medium">Segment</th>
                  <th className="pb-3 text-right font-medium">Recipients</th>
                  <th className="pb-3 font-medium">Sent by</th>
                  <th className="pb-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.id} className="border-b border-border last:border-0">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-action-subtle)] text-[var(--color-action)]">
                          <Bell className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{n.title}</p>
                          <p className="truncate text-xs text-muted-foreground max-w-[300px]">{n.message}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline">{SEGMENT_LABELS[n.segment] || n.segment}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-right font-medium text-foreground">{n.recipient_count}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{n.admin}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{formatDateTime(n.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
      </Card>

      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Broadcast notification</DialogTitle>
            <DialogDescription>
              Send a message to a segment of users.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Title</label>
              <Input
                placeholder="Notification title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Message</label>
              <textarea
                className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                rows={4}
                placeholder="Your message..."
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Segment</label>
              <Select value={form.segment} onValueChange={(v) => setForm({ ...form, segment: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEGMENT_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.segment === "high_spenders" && (
              <div>
                <label className="mb-1 block text-sm font-medium">Minimum spending (NGN)</label>
                <Input
                  type="number"
                  placeholder="e.g. 50000"
                  value={form.threshold}
                  onChange={(e) => setForm({ ...form, threshold: e.target.value })}
                />
              </div>
            )}
            {form.segment === "top_buyers" && (
              <div>
                <label className="mb-1 block text-sm font-medium">Minimum transactions</label>
                <Input
                  type="number"
                  placeholder="e.g. 10"
                  value={form.min_transactions}
                  onChange={(e) => setForm({ ...form, min_transactions: e.target.value })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBroadcastOpen(false)}>Cancel</Button>
            <Button loading={broadcasting} onClick={handleBroadcast}>
              <Send className="h-4 w-4" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
