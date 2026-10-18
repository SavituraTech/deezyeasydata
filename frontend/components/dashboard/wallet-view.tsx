"use client";

import * as React from "react";
import { TrendingUp, Wallet, Gift, Building2, Copy, Check, Loader2, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatNaira, formatDate } from "@/lib/utils";
import { useFetch } from "@/hooks/use-api";
import { walletApi, getClientToken } from "@/lib/api";
import type { ApiTransaction, PaginatedResponse, VirtualAccount, WalletBalance } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  SUCCESS: { label: "SUCCESSFUL", className: "bg-[var(--color-success)]/10 text-[var(--color-success)]" },
  PENDING: { label: "PENDING", className: "bg-[var(--color-muted)] text-[var(--color-text-secondary)]" },
  FAILED: { label: "FAILED", className: "bg-[var(--color-error-bg)] text-[var(--color-error)]" },
};

export function WalletView() {
  const [copied, setCopied] = React.useState<number | null>(null);
  const { data: balanceData, loading: balanceLoading, refetch: refetchBalance } = useFetch<WalletBalance>("/api/wallets/");
  const { data: txData, refetch: refetchTx } = useFetch<PaginatedResponse<ApiTransaction>>("/api/transactions/history/?page_size=50");
  const [virtualAccounts, setVirtualAccounts] = React.useState<VirtualAccount[]>([]);
  const [vaLoading, setVaLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [fundOpen, setFundOpen] = React.useState(false);
  const [fundAmount, setFundAmount] = React.useState("");
  const [funding, setFunding] = React.useState(false);
  const fundProvider = "payvessel" as const;
  const [withdrawing, setWithdrawing] = React.useState(false);

  React.useEffect(() => {
    const fetchVA = async () => {
      const token = getClientToken();
      if (!token) {
        setVaLoading(false);
        return;
      }
      try {
        const accounts = await walletApi.virtualAccounts(token);
        setVirtualAccounts(Array.isArray(accounts) ? accounts : []);
      } catch {
        setVirtualAccounts([]);
      } finally {
        setVaLoading(false);
      }
    };
    fetchVA();
  }, []);

  const handleGenerateAccount = async () => {
    const token = getClientToken();
    if (!token) {
      toast.error("Not authenticated");
      return;
    }
    setCreating(true);
    try {
      const va = await walletApi.createVirtualAccount(token, "PAYVESSEL");
      if (!va || !va.account_number) {
        toast.error("Account creation pending — please refresh shortly.");
        return;
      }
      const accounts = await walletApi.virtualAccounts(token);
      setVirtualAccounts(Array.isArray(accounts) ? accounts : [va]);
      toast.success("Virtual account created successfully!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create virtual account. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = async (text: string, accountId?: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(accountId ?? -1);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Failed to copy — please copy manually.");
    }
  };

  const handleAddFunds = async () => {
    const amount = Number(fundAmount);
    if (!amount || amount < 100) {
      toast.error("Enter an amount of at least ₦100");
      return;
    }
    const token = getClientToken();
    if (!token) {
      toast.error("Not authenticated");
      return;
    }
    setFunding(true);
    try {
      const res = await walletApi.deposit(token, String(amount), fundProvider);
      const url = (res as unknown as { data?: { payment?: { authorization_url?: string } } })?.data?.payment?.authorization_url;
      if (url) {
        toast.success("Redirecting to payment gateway...");
        window.location.href = url;
      } else {
        toast.success("Deposit initiated — complete payment with your provider.");
        setFundOpen(false);
        refetchTx();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to initiate deposit");
    } finally {
      setFunding(false);
    }
  };

  const handleWithdrawCashback = async () => {
    const token = getClientToken();
    if (!token) {
      toast.error("Not authenticated");
      return;
    }
    if (cashbackBalance <= 0) {
      toast.error("No cashback to withdraw");
      return;
    }
    setWithdrawing(true);
    try {
      await walletApi.withdrawCashback(token);
      toast.success("Cashback withdrawn to wallet");
      refetchBalance();
      refetchTx();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Withdraw failed — contact support.");
    } finally {
      setWithdrawing(false);
    }
  };

  const txList = txData?.results ?? [];
  const userBalance = balanceData ? Number(balanceData.balance) : 0;
  const cashbackBalance = balanceData ? Number(balanceData.cashback_balance) : 0;

  // Filter deposits for funding history
  const deposits = txList.filter((t) => t.transaction_type === "DEPOSIT");
  const pageSize = 5;
  const totalPages = Math.ceil(deposits.length / pageSize);
  const paginatedDeposits = deposits.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <PageHeader title="Wallet" description="Your balances and recent activity." />

      {/* Top Section: Asymmetric Hero Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Balance Card */}
        <div className="lg:col-span-7 relative group overflow-hidden rounded-xl bg-[var(--color-surface-dark)] text-white p-6 shadow-xl flex flex-col justify-between min-h-[280px]">
          <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
            <Wallet className="h-[120px] w-[120px]" strokeWidth={0.5} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium uppercase tracking-widest text-white/60">Available Liquidity</span>
              <div className="h-px w-12 bg-white/20" />
            </div>
            <div className="flex flex-col">
              <span className="text-5xl font-bold tracking-tight">
                {balanceLoading ? "—" : formatNaira(userBalance)}
              </span>
              <span className="mt-2 flex items-center gap-1 text-sm text-white/60">
                <TrendingUp className="h-4 w-4 text-[var(--color-success)]" />
                +12.5% from last month
              </span>
            </div>
          </div>
          <div className="relative z-10 flex flex-wrap gap-3 mt-6">
            <button
              onClick={() => setFundOpen(true)}
              className="bg-[var(--color-success)] text-white px-8 py-4 rounded-lg text-sm font-medium flex items-center gap-2 hover:scale-[1.02] transition-transform active:scale-95"
              aria-label="Add funds to wallet"
            >
              <span className="text-lg">+</span> Add Funds
            </button>
          </div>
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-[var(--color-success)]/20 blur-[80px] rounded-full" />
        </div>

        {/* Virtual Account Card */}
        <div className="lg:col-span-5 bg-[var(--color-surface-container-highest)] rounded-xl p-6 flex flex-col justify-center relative overflow-hidden group">
          <div className="flex flex-col gap-4 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase text-[var(--color-text-secondary)]">Virtual Settlement Account</span>
            </div>
            {vaLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                {virtualAccounts.length > 0 ? (
                  <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                    {virtualAccounts.map((account) => (
                      <div key={account.id} className="rounded-lg bg-[var(--color-surface-container)] p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs text-[var(--color-text-secondary)]">{account.bank_name}</p>
                            <p className="text-xs font-medium text-[var(--foreground)]">PayVessel</p>
                          </div>
                          <Building2 className="h-5 w-5 text-[var(--color-text-secondary)]/40" />
                        </div>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 text-left"
                          onClick={() => copyToClipboard(account.account_number, account.id)}
                        >
                          <span className="text-xl font-bold tracking-widest text-[var(--foreground)]">{account.account_number}</span>
                          {copied === account.id ? <Check className="h-5 w-5 text-[var(--color-success)]" /> : <Copy className="h-5 w-5 text-[var(--color-text-secondary)]" />}
                        </button>
                        <p className="mt-2 truncate text-xs text-[var(--color-text-secondary)]">{account.account_name}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    No virtual account yet. Generate one to fund your wallet via bank transfer.
                  </p>
                )}

                <div className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-4 sm:flex-row">
                  <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm font-medium">
                    <span className="h-2 w-2 rounded-full bg-[var(--color-success)]" /> PayVessel
                  </div>
                  <Button onClick={handleGenerateAccount} disabled={creating} variant="primary" className="flex-1 gap-2">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                    {creating ? "Creating account..." : virtualAccounts.length ? "Generate Another Account" : "Generate Account"}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <span className="absolute -right-4 bottom-4 text-[140px] font-bold text-black/[0.03] select-none pointer-events-none -rotate-12">VIRTUAL</span>
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[var(--foreground)]/5 to-transparent translate-x-full group-hover:translate-x-0 transition-transform duration-700" />
        </div>
      </div>

      {/* Middle Section: Cashback Rewards */}
      <div className="flex justify-center">
        <div className="bg-[var(--color-surface-elevated)] rounded-xl p-6 shadow-sm border border-[var(--color-border)] flex flex-col gap-4 w-full max-w-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-success)]/10 text-[var(--color-success)]">
            <Gift className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Cashback Rewards</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">Earned from data & utility purchases</p>
          </div>
        </div>
        <div className="bg-[var(--color-surface-container-low)] rounded-lg p-4 flex justify-between items-center">
          <div>
            <span className="text-xs font-medium text-[var(--color-text-secondary)] block uppercase">Accrued Balance</span>
            <span className="text-xl font-bold text-[var(--color-success)]">{balanceLoading ? "—" : formatNaira(cashbackBalance)}</span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleWithdrawCashback}
            disabled={withdrawing || cashbackBalance <= 0}
            title={cashbackBalance <= 0 ? "No cashback available" : "Move cashback to main wallet"}
            aria-label="Withdraw cashback to wallet"
          >
            {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Withdraw to Wallet
          </Button>
        </div>
      </div>
      </div>

      {/* Funding History */}
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between px-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Funding History</h2>
            <p className="text-base text-[var(--color-text-secondary)]">Real-time settlement logs for your deposits.</p>
          </div>
          <button className="text-sm font-medium text-[var(--color-action)] hover:underline flex items-center gap-1">
            View Full Ledger <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="bg-[var(--color-surface-elevated)] rounded-xl overflow-hidden shadow-sm">
          {/* Mobile card fallback */}
          <div className="sm:hidden p-3 space-y-3">
            {paginatedDeposits.length > 0 ? (
              paginatedDeposits.map((tx) => {
                const statusInfo = STATUS_CONFIG[tx.status] || STATUS_CONFIG.PENDING;
                return (
                  <Card key={tx.id} className="p-4 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium">{formatDate(tx.created_at)}</span>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${statusInfo.className}`}>{statusInfo.label}</span>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground truncate">{tx.provider_reference || `DEP-${tx.id}`}</p>
                    <p className="font-bold text-foreground">{formatNaira(Number(tx.amount))}</p>
                  </Card>
                );
              })
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No funding history yet</p>
            )}
          </div>
          <div className="overflow-x-auto hidden sm:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--color-surface-container-low)] border-b border-[var(--color-border)]">
                  <th className="px-6 py-4 text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-4 text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider hidden md:table-cell">Reference</th>
                  <th className="px-6 py-4 text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-muted)]">
                {paginatedDeposits.length > 0 ? (
                  paginatedDeposits.map((tx) => {
                    const statusInfo = STATUS_CONFIG[tx.status] || STATUS_CONFIG.PENDING;
                    return (
                      <tr key={tx.id} className="hover:bg-[var(--color-surface-container)]/30 transition-colors">
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-[var(--foreground)]">{formatDate(tx.created_at)}</span>
                            <span className="text-xs text-[var(--color-text-secondary)]">{new Date(tx.created_at).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 font-mono text-sm text-[var(--color-text-secondary)] hidden md:table-cell">
                          {tx.provider_reference || `DEP-${tx.id}`}
                        </td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${statusInfo.className}`}>
                            {tx.status === "SUCCESS" && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />}
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right font-bold text-[var(--foreground)]">{formatNaira(Number(tx.amount))}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-sm text-[var(--color-text-secondary)]">
                      No funding history yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {deposits.length > pageSize && (
            <div className="p-6 bg-[var(--color-surface-container-low)]/50 flex items-center justify-between">
              <p className="text-sm text-[var(--color-text-secondary)]">
                Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, deposits.length)} of {deposits.length} deposits
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Funds Dialog */}
      <Dialog open={fundOpen} onOpenChange={setFundOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Funds</DialogTitle>
            <DialogDescription>Fund your wallet securely with PayVessel.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="number"
              placeholder="Amount e.g. 5000"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              aria-label="Funding amount"
            />
            <div className="flex gap-2 flex-wrap">
              {[1000, 5000, 10000, 20000].map((a) => (
                <Button key={a} variant="outline" size="sm" onClick={() => setFundAmount(String(a))}>
                  ₦{a.toLocaleString()}
                </Button>
              ))}
            </div>
            <div className="rounded-lg border border-[var(--color-action)] bg-[var(--color-action-subtle)] p-3 text-sm">
              <span className="block font-medium">PayVessel</span>
              <span className="text-xs text-muted-foreground">Secure card and bank transfer</span>
            </div>
            <Button onClick={handleAddFunds} disabled={funding} className="w-full" aria-live="polite">
              {funding ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {funding ? "Processing..." : "Proceed to Pay"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
