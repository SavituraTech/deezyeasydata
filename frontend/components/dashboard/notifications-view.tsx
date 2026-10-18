"use client";

import * as React from "react";
import { BellOff, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFetch } from "@/hooks/use-api";
import type { ApiNotification, PaginatedResponse } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const } },
};

export function NotificationsView() {
  const [page, setPage] = React.useState(1);
  const { data, loading, error, refetch } = useFetch<PaginatedResponse<ApiNotification>>(
    `/api/notifications/?page=${page}&page_size=20`
  );

  // Poll every 30s for new notifications (SSE alternative via notifications/services.py)
  React.useEffect(() => {
    const id = setInterval(() => refetch(), 30000);
    return () => clearInterval(id);
  }, [refetch]);

  const list = data?.results ?? [];
  const unreadCount = list.length; // backend doesn't expose read flag yet

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={unreadCount ? `${unreadCount} notification${unreadCount > 1 ? "s" : ""} • polling every 30s` : "You're all caught up."}
      />
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={refetch} aria-label="Refresh notifications">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <Card className="p-6 text-center text-sm text-destructive">Failed to load: {error}</Card>
      ) : list.length > 0 ? (
        <motion.div
          className="space-y-3"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {list.map((n) => (
            <motion.div key={n.id} variants={staggerItem}>
              <Card className="p-4 flex flex-col gap-1 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start gap-4">
                  <h3 className="font-medium text-foreground">{n.title}</h3>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(n.created_at)}</span>
                </div>
                <p className="text-sm text-muted-foreground">{n.message}</p>
                <p className="text-xs text-muted-foreground">Segment: {n.segment} • Recipients: {n.recipient_count}</p>
              </Card>
            </motion.div>
          ))}
          {data && data.count > 20 && (
            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={list.length < 20}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </motion.div>
      ) : (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <BellOff className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium text-foreground">No notifications</p>
          <p className="text-sm text-muted-foreground">You&apos;ll see notifications here as they arrive.</p>
        </Card>
      )}
    </div>
  );
}
