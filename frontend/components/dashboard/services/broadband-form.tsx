"use client";

import * as React from "react";
import { Globe, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { ProviderPicker } from "@/components/dashboard/provider-picker";
import { PaymentDialog } from "@/components/dashboard/payment-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatNaira } from "@/lib/utils";
import { useFetch } from "@/hooks/use-api";
import { buyApi } from "@/lib/api";
import { toArray } from "@/lib/utils";
import { friendlyError } from "@/lib/errors";
import { getProductLogo } from "@/data/service-images";
import type { ApiProduct, WalletBalance } from "@/lib/api";
import type { PaymentResult } from "@/components/dashboard/payment-dialog";

const ISP_COLORS: Record<string, { bg: string; text: string }> = {
  MTN: { bg: "bg-[#FFCC00]", text: "text-black" },
  "9mobile": { bg: "bg-[#006341]", text: "text-white" },
  Swift: { bg: "bg-[#0066FF]", text: "text-white" },
  ipNX: { bg: "bg-[#E30613]", text: "text-white" },
};

export function BroadbandForm() {
  const { data: products, loading } = useFetch<ApiProduct[]>("/api/products/");
  const { data: wallet } = useFetch<WalletBalance>("/api/wallets/");
  const broadbandProducts = toArray(products).filter((p) => p.category === "BROADBAND" && p.is_active);

  const extractBroadbandProvider = (product: ApiProduct): string => {
    const name = (product.name || "").toLowerCase();
    const code = (product.provider_product_code || "").toLowerCase();
    if (name.includes("smile") || code.includes("smile")) return "SMILE";
    if (name.includes("spectranet") || code.includes("spectranet")) return "SPECTRANET";
    if (name.includes("mtn") || code.includes("mtn")) return "MTN";
    if (name.includes("9mobile") || name.includes("etisalat") || code.includes("9mobile") || code.includes("etisalat")) return "9MOBILE";
    if (name.includes("swift") || code.includes("swift")) return "SWIFT";
    if (name.includes("ipnx") || code.includes("ipnx")) return "IPNX";
    return "OTHER";
  };

  const providers = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string; short: string; image_url?: string | null }>();
    for (const p of broadbandProducts) {
      const broadbandProvider = extractBroadbandProvider(p);
      if (!map.has(broadbandProvider)) {
        map.set(broadbandProvider, {
          id: broadbandProvider,
          name: broadbandProvider,
          color: ISP_COLORS[broadbandProvider]?.bg || "bg-[var(--color-action)]",
          short: broadbandProvider.slice(0, 2),
          image_url: p.image_url || getProductLogo(p),
        });
      }
    }
    return Array.from(map.values());
  }, [broadbandProducts]);

  const [provider, setProvider] = React.useState("");
  const [account, setAccount] = React.useState("");
  const [pkg, setPkg] = React.useState<ApiProduct | null>(null);
  const [open, setOpen] = React.useState(false);

  const [customerName, setCustomerName] = React.useState<string | null>(null);
  const [verifying, setVerifying] = React.useState(false);
  const [verifyError, setVerifyError] = React.useState<string | null>(null);

  const plans = broadbandProducts.filter((p) => extractBroadbandProvider(p) === provider);
  const validAccount = /^\d{10,11}$/.test(account);
  const pkgPrice = pkg ? Number(pkg.selling_price) : 0;
  const canPay = validAccount && !!pkg && !!customerName;
  const insufficientBalance = wallet && pkgPrice > 0 && pkgPrice > Number(wallet.balance);
  const providerName = providers.find((p) => p.id === provider)?.name ?? "";

  const handleVerify = async () => {
    if (!validAccount || !provider) return;
    setVerifying(true);
    setVerifyError(null);
    setCustomerName(null);
    try {
      const res = await buyApi.verifyBroadband({
        account_number: account,
        broadband_provider: provider,
      });
      setCustomerName(res.data.customer_name || "Verified");
    } catch (e) {
      setVerifyError(friendlyError(e instanceof Error ? e.message : null));
    } finally {
      setVerifying(false);
    }
  };

  React.useEffect(() => {
    setCustomerName(null);
    setVerifyError(null);
  }, [account, provider]);

  const handlePay = async (): Promise<PaymentResult> => {
    if (!pkg) return { ok: false, error: "No plan selected." };
    try {
      const res = await buyApi.broadband({ product_id: pkg.id, account_number: account });
      const txn = res.data.transaction;
      const isPending = txn.status === "PENDING";
      return { ok: true, id: txn.id, reference: txn.provider_reference || `TXN-${txn.id}`, cashbackAmount: res.data.cashback_amount, pending: isPending };
    } catch (e) {
      return { ok: false, error: friendlyError(e instanceof Error ? e.message : null) };
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="border-b border-[var(--color-muted)] pb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-8 h-[2px] bg-[var(--color-success)]" />
          <span className="text-sm font-semibold text-[var(--color-success)] uppercase tracking-widest">ISP Subscription</span>
        </div>
        <h1 className="text-3xl font-bold text-[var(--foreground)] leading-tight">
          Pay <span className="text-[var(--color-success)]">Broadband</span> Bills
        </h1>
        <p className="text-lg text-[var(--color-text-secondary)] mt-2">
          Pay for your ISP subscription and stay connected to the internet.
        </p>
      </section>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Panel: Form Entry */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Provider Selection */}
          <Card variant="bordered" className="p-6">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase mb-4 block">1. Select Provider</label>
            <ProviderPicker
              providers={providers}
              value={provider}
              onChange={(id) => {
                setProvider(id);
                setPkg(null);
                setCustomerName(null);
                setVerifyError(null);
              }}
            />
          </Card>

          {/* Account & Verify */}
          <Card variant="bordered" className="p-6 flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase block">2. Account Number</label>
              <div className="flex gap-2">
                <Input
                  id="account-number"
                  inputMode="numeric"
                  placeholder="1234567890"
                  value={account}
                  onChange={(e) => setAccount(e.target.value.replace(/\D/g, "").slice(0, 11))}
                />
                <Button
                  variant="outline"
                  onClick={handleVerify}
                  disabled={!validAccount || !provider || verifying}
                  className="shrink-0"
                >
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                </Button>
              </div>
              {account && !validAccount && (
                <p className="text-xs text-destructive">Enter a valid account number.</p>
              )}
              {verifyError && (
                <p className="text-xs text-destructive">{verifyError}</p>
              )}
              {customerName && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Account verified: <strong>{customerName}</strong></span>
                </div>
              )}
            </div>
          </Card>

          {/* Plan Selection */}
          <Card variant="bordered" className="p-6 flex flex-col gap-4">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase block">3. Choose Plan</label>
            <div className="grid gap-3 sm:grid-cols-2">
              {plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPkg(p)}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-4 text-left transition-all",
                    pkg?.id === p.id
                      ? "border-[var(--color-success)] ring-2 ring-[var(--color-success)]/30 bg-[var(--color-success)]/5"
                      : "border-[var(--color-border)] hover:border-[var(--color-success)]/40 bg-[var(--color-surface-elevated)]"
                  )}
                >
                  <div>
                    <p className="font-semibold text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.description || "Monthly"}</p>
                  </div>
                  <p className="font-bold text-foreground">{formatNaira(Number(p.selling_price))}</p>
                </button>
              ))}
              {plans.length === 0 && provider && (
                <p className="col-span-2 py-8 text-center text-sm text-muted-foreground">
                  No plans available for this provider.
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Right Panel: Summary */}
        <div className="lg:col-span-5 flex flex-col gap-4 lg:sticky lg:top-24">
          <div className="bg-[var(--color-surface-dark)] text-white p-6 rounded-xl shadow-xl overflow-hidden relative">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-3xl" />
            <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-[var(--color-success)]/20 rounded-full blur-3xl" />
            <h3 className="text-sm font-semibold uppercase tracking-widest text-white/60 mb-6 relative z-10">Transaction Summary</h3>
            <div className="space-y-4 relative z-10">
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-sm text-white/70">Provider</span>
                <span className="text-sm font-medium">{provider || "Not Selected"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-sm text-white/70">Account Number</span>
                <span className="text-sm font-medium">{account || "----"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-sm text-white/70">Plan</span>
                <span className="text-sm font-medium">{pkg?.name || "----"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-sm text-white/70">Account Name</span>
                <span className="text-sm font-medium">{customerName || "----"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-sm text-white/70">Fee / Margin</span>
                <span className="text-sm font-medium text-[var(--color-success)]">
                  {pkg?.margin ? `₦${Number(pkg.margin).toFixed(2)}` : "₦0.00"}
                </span>
              </div>
              <div className="flex justify-between items-end pt-6 pb-2">
                <span className="text-lg font-semibold">Total Payable</span>
                <span className="text-2xl font-bold">{pkgPrice > 0 ? formatNaira(pkgPrice) : "₦0.00"}</span>
              </div>
            </div>
            <div className="mt-6 relative z-10">
              <button
                onClick={() => setOpen(true)}
                disabled={!canPay}
                className="w-full py-4 rounded-full bg-[var(--color-success)] text-white text-lg font-semibold hover:bg-[var(--color-success)]/90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed group flex items-center justify-center gap-2"
              >
                <span>Pay Now</span>
                <Globe className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <p className="text-center text-xs text-white/50 mt-4">Funds will be deducted from your wallet balance.</p>
            </div>
          </div>

          {insufficientBalance && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Insufficient balance. You need {formatNaira(pkgPrice)} but have {formatNaira(Number(wallet?.balance || 0))}.</span>
            </div>
          )}


        </div>
      </div>

      <PaymentDialog
        open={open}
        onOpenChange={setOpen}
        title={`${provider} Subscription`}
        amount={pkgPrice}
        summary={[
          { label: "Provider", value: provider },
          { label: "Plan", value: pkg?.name ?? "" },
          { label: "Account number", value: account },
          { label: "Account name", value: customerName || "" },
        ]}
        onSubmit={handlePay}
      />
    </div>
  );
}
