"use client";

import Link from "next/link";
import * as React from "react";
import { Smartphone, Wifi, Zap, Tv, ArrowRight, TrendingUp, Wallet, Gift, CheckCircle, Clock, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { WalletCard } from "@/components/cards/wallet-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { SpendingChart } from "@/components/charts/spending-chart";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { useRole } from "@/components/dashboard/role-context";
import { useFetch } from "@/hooks/use-api";
import { formatNaira, formatDate, formatDateTime } from "@/lib/utils";
import type { ApiTransaction, PaginatedResponse, WalletBalance } from "@/lib/api";
import type { SpendingPoint } from "@/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  SUCCESS: {
    label: "Success",
    className: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
    icon: <CheckCircle className="h-3 w-3" />,
  },
  PENDING: {
    label: "Pending",
    className: "bg-[var(--color-muted)] text-[var(--color-text-secondary)]",
    icon: <Clock className="h-3 w-3" />,
  },
  FAILED: {
    label: "Failed",
    className: "bg-[var(--color-error-bg)] text-[var(--color-error)]",
    icon: <XCircle className="h-3 w-3" />,
  },
};

const TX_TYPE_ICON: Record<string, { icon: React.ReactNode; bg: string }> = {
  AIRTIME: { icon: <Smartphone className="h-5 w-5" />, bg: "bg-[var(--color-success)]/10 text-[var(--color-success)]" },
  DATA: { icon: <Wifi className="h-5 w-5" />, bg: "bg-[var(--color-success)]/10 text-[var(--color-success)]" },
  ELECTRICITY: { icon: <Zap className="h-5 w-5" />, bg: "bg-[var(--color-muted)] text-[var(--foreground)]" },
  CABLE: { icon: <Tv className="h-5 w-5" />, bg: "bg-[var(--color-error-bg)] text-[var(--color-error)]" },
  DEPOSIT: { icon: <Wallet className="h-5 w-5" />, bg: "bg-[var(--color-success)]/10 text-[var(--color-success)]" },
};

export default function DashboardPage() {
  const { isAdmin, user } = useRole();
  const { data: balanceData, loading: balanceLoading } = useFetch<WalletBalance>("/api/wallets/");
  const { data: txData, loading: txLoading } = useFetch<PaginatedResponse<ApiTransaction>>("/api/transactions/history/");

  const txList = txData?.results ?? [];
  const loading = balanceLoading || txLoading;
  const userBalance = balanceData ? Number(balanceData.balance) : 0;
  const cashbackBalance = balanceData ? Number(balanceData.cashback_balance) : 0;

  // Calculate stats from real data
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthTxns = txList.filter((t) => {
    const d = new Date(t.created_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalSpent = monthTxns
    .filter((t) => t.transaction_type !== "DEPOSIT" && t.status === "SUCCESS")
    .reduce((s, t) => s + Number(t.amount), 0);

  const txCount = monthTxns.length;
  const successfulTxns = monthTxns.filter((t) => t.status === "SUCCESS").length;

  // Spending chart data
  const spendingData: SpendingPoint[] = (() => {
    const points: SpendingPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = MONTHS[d.getMonth()];
      const monthAllTxns = txList.filter((t) => {
        const td = new Date(t.created_at);
        return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
      });
      const funding = monthAllTxns
        .filter((t) => t.transaction_type === "DEPOSIT" && t.status === "SUCCESS")
        .reduce((s, t) => s + Number(t.amount), 0);
      const spending = monthAllTxns
        .filter((t) => t.transaction_type !== "DEPOSIT" && t.status === "SUCCESS")
        .reduce((s, t) => s + Number(t.amount), 0);
      points.push({ month, funding, spending });
    }
    return points;
  })();

  if (isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
              Welcome back, {user.first_name || user.username}
            </h1>
            <Badge variant="action">Admin</Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Platform overview and key metrics at a glance.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard label="Wallet Balance" value={loading ? "—" : formatNaira(userBalance)} icon={<Wallet className="h-5 w-5" />} variant="default" />
          <StatCard label="Cashback Earned" value={loading ? "—" : formatNaira(cashbackBalance)} icon={<Gift className="h-5 w-5" />} variant="success" change={12} />
          <StatCard label="Transactions" value={loading ? "—" : String(txCount)} icon={<TrendingUp className="h-5 w-5" />} variant="dark" />
        </div>

        <QuickActions />

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card variant="bordered" className="p-0 overflow-hidden">
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">Spending Overview</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">Transaction volume across all services.</p>
                </div>
              </div>
              <SpendingChart data={spendingData} />
            </div>
          </Card>

          <Card variant="bordered" className="p-0 overflow-hidden">
            <div className="p-6 border-b border-[var(--color-muted)]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[var(--foreground)]">Recent Activity</h3>
                <Link href="/dashboard/transactions" className="flex items-center gap-1 text-sm font-medium text-[var(--color-action)] hover:underline">
                  View All <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <RecentActivityTable transactions={txList.slice(0, 5)} />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <motion.div
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {/* Wallet Balance Card */}
        <motion.div variants={staggerItem}>
          <Card variant="bordered" className="relative overflow-hidden p-6">
            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[var(--color-success)]/5 -mr-8 -mt-8" />
            <span className="text-xs font-medium uppercase tracking-widest text-[var(--color-text-secondary)]">
              Wallet Balance
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              {loading ? (
                <span className="text-4xl font-bold tracking-tight text-[var(--foreground)]">—</span>
              ) : (
                <AnimatedCounter
                  value={userBalance}
                  format={(n) => formatNaira(n)}
                  className="text-4xl font-bold tracking-tight text-[var(--foreground)]"
                />
              )}
            </div>
            <div className="mt-4">
              <Link
                href="/dashboard/wallet"
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-surface-dark)] px-4 py-2 text-sm font-medium text-[var(--color-text-inverse)] hover:opacity-90 transition-all active:scale-[0.98]"
              >
                <Wallet className="h-4 w-4" /> Fund Wallet
              </Link>
            </div>
          </Card>
        </motion.div>

        {/* Cashback Card */}
        <motion.div variants={staggerItem}>
          <Card variant="bordered" className="p-6 border-l-4 border-l-[var(--color-success)]">
            <span className="text-xs font-medium uppercase tracking-widest text-[var(--color-text-secondary)]">
              Cashback Earned
            </span>
            <div className="mt-2">
              {loading ? (
                <span className="text-4xl font-bold tracking-tight text-[var(--color-success)]">—</span>
              ) : (
                <AnimatedCounter
                  value={cashbackBalance}
                  format={(n) => formatNaira(n)}
                  className="text-4xl font-bold tracking-tight text-[var(--color-success)]"
                />
              )}
            </div>
            <div className="mt-4 flex items-center gap-1 rounded w-fit bg-[var(--color-success)]/10 px-2 py-1 text-xs font-medium text-[var(--color-success)]">
              <TrendingUp className="h-3 w-3" /> +12% from last month
            </div>
          </Card>
        </motion.div>

        {/* Monthly Summary Card */}
        <motion.div variants={staggerItem}>
          <div className="rounded-xl bg-[var(--color-surface-dark)] p-6 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <span className="text-xs font-medium uppercase tracking-widest text-white/60">
                Monthly Summary
              </span>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-sm text-white/60">Total Spent</span>
                  {loading ? (
                    <span className="text-sm font-medium">—</span>
                  ) : (
                    <AnimatedCounter
                      value={totalSpent}
                      format={(n) => formatNaira(n)}
                      className="text-sm font-medium"
                    />
                  )}
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-sm text-white/60">Transactions</span>
                  <span className="text-sm font-medium">{loading ? "—" : `${successfulTxns} successful`}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Total Cashback</span>
                  {loading ? (
                    <span className="text-sm font-medium text-[var(--color-secondary)]">—</span>
                  ) : (
                    <AnimatedCounter
                      value={cashbackBalance}
                      format={(n) => formatNaira(n)}
                      className="text-sm font-medium text-[var(--color-secondary)]"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Spending Chart & Activity */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card variant="bordered" className="p-0 overflow-hidden">
          <div className="p-6">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--foreground)]">Spending Overview</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">Transaction volume across all services.</p>
              </div>
            </div>
            <div className="h-[340px]">
              <SpendingChart data={spendingData} />
            </div>
          </div>
        </Card>

        <Card variant="bordered" className="p-0 overflow-hidden">
          <div className="p-6 border-b border-[var(--color-muted)] flex justify-between items-center">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Recent Activity</h3>
            <Link href="/dashboard/transactions" className="flex items-center gap-1 text-sm font-medium text-[var(--color-action)] hover:underline">
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <RecentActivityTable transactions={txList.slice(0, 5)} />
        </Card>
      </div>

      {/* Referral Banner */}
      <div className="relative w-full h-48 rounded-2xl overflow-hidden shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--foreground)] via-[var(--foreground)]/80 to-transparent z-10 flex flex-col justify-center px-8">
          <h2 className="text-white text-2xl font-bold">Refer & Earn Big</h2>
          <p className="text-white/70 text-base max-w-md mt-2">
            Get ₦500 bonus for every friend you refer who funds their wallet with at least ₦2,000.
          </p>
          <div className="mt-4 flex gap-4">
            <button className="bg-[var(--color-success)] text-white px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">
              Get Referral Link
            </button>
            <button className="border border-white/30 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-white hover:text-[var(--foreground)] transition-all">
              Learn More
            </button>
          </div>
        </div>
        <div className="absolute inset-0 z-0 bg-[var(--color-surface-dark)]/20" />
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  icon,
  variant = "default",
  change,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant?: "default" | "success" | "dark";
  change?: number;
}) {
  if (variant === "dark") {
    return (
      <div className="rounded-xl bg-[var(--color-surface-dark)] p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-xs font-medium uppercase tracking-widest text-white/60">{label}</span>
          <div className="mt-2">
            <span className="text-3xl font-bold tracking-tight">{value}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card variant="bordered" className="p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
          variant === "success" ? "bg-[var(--color-success)]/10 text-[var(--color-success)]" : "bg-[var(--color-muted)] text-[var(--foreground)]"
        }`}>
          {icon}
        </div>
        <div>
          <span className="text-xs font-medium uppercase tracking-widest text-[var(--color-text-secondary)]">{label}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-[var(--foreground)]">{value}</span>
          </div>
          {change !== undefined && (
            <div className="mt-1 flex items-center gap-1 text-xs font-medium text-[var(--color-success)]">
              <TrendingUp className="h-3 w-3" /> +{change}% from last month
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// Recent Activity Table
function RecentActivityTable({ transactions }: { transactions: ApiTransaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
        No recent activity
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
            <th className="px-6 py-4">Service</th>
            <th className="px-6 py-4">Reference</th>
            <th className="px-6 py-4 text-right">Amount</th>
            <th className="px-6 py-4">Status</th>
          </tr>
        </thead>
        <motion.tbody
          className="divide-y divide-[var(--color-muted)]"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {transactions.map((tx) => {
            const typeInfo = TX_TYPE_ICON[tx.transaction_type] || TX_TYPE_ICON.AIRTIME;
            const statusInfo = STATUS_CONFIG[tx.status] || STATUS_CONFIG.PENDING;
            return (
              <motion.tr
                key={tx.id}
                variants={staggerItem}
                className="hover:bg-[var(--color-surface-container-low)] transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${typeInfo.bg}`}>
                      {typeInfo.icon}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[var(--foreground)]">{tx.product_name}</div>
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        {formatDate(tx.created_at)}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-[var(--color-text-secondary)]">
                  {tx.provider_reference || `TXN-${tx.id}`}
                </td>
                <td className="px-6 py-4 text-right text-sm font-medium text-[var(--foreground)]">
                  {formatNaira(Number(tx.amount))}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${statusInfo.className}`}>
                    {statusInfo.icon}
                    {statusInfo.label}
                  </span>
                </td>
              </motion.tr>
            );
          })}
        </motion.tbody>
      </table>
    </div>
  );
}
