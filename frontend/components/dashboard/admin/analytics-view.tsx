"use client";

import * as React from "react";
import {
  Receipt,
  TrendingUp,
  Users,
  DollarSign,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { ServiceUsageChart } from "@/components/charts/service-usage-chart";
import { adminApi, getClientToken, type AdminStats, type AdminAnalyticsResponse, type AdminTopProductsResponse, type ApiUser } from "@/lib/api";
import { formatNaira } from "@/lib/utils";
import type { RevenuePoint, ServiceUsage } from "@/types";

const SERVICE_COLORS: Record<string, string> = {
  AIRTIME: "#2A9D8F",
  DATA: "#F4B400",
  SME_DATA: "#3B82F6",
  ELECTRICITY: "#1E3A5F",
  CABLE: "#E76F51",
  BROADBAND: "#264653",
  EDUCATION: "#2A9D8F",
  STREAMING: "#9333EA",
  DEPOSIT: "#8884d8",
};

const SERVICE_LABELS: Record<string, string> = {
  AIRTIME: "Airtime",
  DATA: "Data",
  SME_DATA: "SME Data",
  ELECTRICITY: "Electricity",
  CABLE: "Cable TV",
  BROADBAND: "Broadband",
  EDUCATION: "Education",
  STREAMING: "Streaming",
  DEPOSIT: "Deposits",
};

export function AnalyticsView() {
  const [stats, setStats] = React.useState<AdminStats | null>(null);
  const [analytics, setAnalytics] = React.useState<AdminAnalyticsResponse | null>(null);
  const [topProducts, setTopProducts] = React.useState<AdminTopProductsResponse | null>(null);
  const [recentUsers, setRecentUsers] = React.useState<ApiUser[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      const token = getClientToken();
      if (!token) return;
      try {
        const [statsRes, analyticsRes, topRes, usersRes] = await Promise.all([
          adminApi.stats(token),
          adminApi.analytics(token, 30),
          adminApi.topProducts(token, 30, 10),
          adminApi.users(token, { page_size: 5 }),
        ]);
        setStats(statsRes ?? null);
        setAnalytics(analyticsRes ?? null);
        setTopProducts(topRes ?? null);
        setRecentUsers(usersRes?.results ?? []);
      } catch {
        // Stats may fail if backend isn't fully ready
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Normalize analytics daily: support both legacy `daily` and new `daily_revenue_series`
  const revenueData: RevenuePoint[] = (() => {
    const series = (analytics?.daily_revenue_series ?? analytics?.daily ?? []) as unknown as Array<Record<string, unknown>>;
    return series.map((d) => ({
      month: String(d.day ?? d.date ?? ""),
      revenue: Number(d.revenue ?? 0),
      volume: Number(d.count ?? d.transactions ?? 0),
    }));
  })();

  const serviceUsage: ServiceUsage[] = (() => {
    const raw = stats?.transactions_by_type;
    if (!raw) return [];
    // Backend new shape: [{type,count,revenue}] vs legacy Record
    const entries: Array<[string, number]> = Array.isArray(raw)
      ? (raw as Array<{ type: string; count: number }>).map((r) => [r.type, r.count] as [string, number])
      : Object.entries(raw as Record<string, number>);
    return entries
      .filter(([key]) => key !== "DEPOSIT")
      .map(([key, count]) => ({
        name: SERVICE_LABELS[key] || key,
        transactions: count as number,
        volume: 0,
        color: SERVICE_COLORS[key] || "#8884d8",
      }));
  })();

  const statusEntries = React.useMemo(() => {
    const raw = stats?.transactions_by_status;
    if (!raw) return [] as Array<[string, number]>;
    if (Array.isArray(raw)) {
      return (raw as Array<{ status: string; count: number }>).map((r) => [r.status, r.count] as [string, number]);
    }
    return Object.entries(raw as Record<string, number>);
  }, [stats?.transactions_by_status]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-11 w-11 rounded-xl" />
              <Skeleton className="mt-4 h-7 w-24" />
              <Skeleton className="mt-1 h-4 w-32" />
            </Card>
          ))
        ) : (
          <>
            <StatCard
              label="Total users"
              value={String(stats?.total_users ?? 0)}
              sub={`${stats?.active_users ?? 0} active`}
              icon={Users}
              accent="bg-[var(--color-action-subtle)] text-[var(--color-action)]"
            />
            <StatCard
              label="Total transactions"
              value={String(stats?.total_transactions ?? 0)}
              sub={`${stats?.today_transactions ?? 0} today`}
              icon={Receipt}
              accent="bg-[var(--color-accent)]/15 text-[var(--color-accent)] dark:text-[var(--color-accent)]"
            />
            <StatCard
              label="Today revenue"
              value={formatNaira(Number(stats?.today_revenue ?? 0), { compact: true })}
              sub={`Week: ${formatNaira(Number(stats?.week_revenue ?? 0), { compact: true })}`}
              icon={DollarSign}
              accent="bg-success/12 text-success"
            />
            <StatCard
              label="Month revenue"
              value={formatNaira(Number(stats?.month_revenue ?? 0), { compact: true })}
              icon={TrendingUp}
              accent="bg-[var(--color-primary)]/10 text-[var(--color-primary)] dark:bg-white/10 dark:text-white"
            />
          </>
        )}
      </div>

      {statusEntries.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {statusEntries.map(([status, count]) => {
            const total = stats?.total_transactions || statusEntries.reduce((s, [, c]) => s + c, 0) || 1;
            const pct = Math.round((count / total) * 100);
            const color = status === "SUCCESS" ? "bg-success" : status === "FAILED" ? "bg-destructive" : "bg-warning";
            return (
              <Card key={status} className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{status}</p>
                  <span className="text-sm font-medium">{pct}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{count} transactions</p>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground">Revenue &amp; volume</h2>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </div>
          </div>
          {loading ? <Skeleton className="h-[280px] w-full" /> : <RevenueChart data={revenueData} />}
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 font-semibold text-foreground">Service usage</h2>
          <p className="mb-4 text-xs text-muted-foreground">Transactions by service</p>
          {loading ? <Skeleton className="h-[280px] w-full" /> : <ServiceUsageChart data={serviceUsage} />}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-foreground">Top products (30d)</h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          ) : topProducts?.top_products && topProducts.top_products.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-3 font-medium">Product</th>
                  <th className="pb-3 text-right font-medium">Sales</th>
                  <th className="pb-3 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.top_products.map((p, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4 font-medium text-foreground">{p.name}</td>
                    <td className="py-3 pr-4 text-right text-muted-foreground">{p.count}</td>
                    <td className="py-3 pr-4 text-right font-medium text-foreground">{formatNaira(Number(p.revenue))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-4 text-center text-muted-foreground">No data available.</p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-foreground">Recent users</h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          ) : recentUsers.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-3 font-medium">User</th>
                  <th className="pb-3 font-medium">Role</th>
                  <th className="pb-3 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-foreground">{u.name || u.username}</p>
                      <p className="text-xs text-muted-foreground">{u.email || u.phone}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={u.role === "ADMIN" ? "teal" : "outline"}>
                        {u.role === "ADMIN" ? "Admin" : "User"}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-right font-medium text-foreground">
                      {formatNaira(Number(u.balance))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-4 text-center text-muted-foreground">No users found.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  accent: string;
}) {
  return (
    <Card className="p-5 transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}
