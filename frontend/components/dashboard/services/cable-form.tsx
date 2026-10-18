"use client";

import * as React from "react";
import { Tv, AlertTriangle, CheckCircle2, Loader2, Check } from "lucide-react";
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
import { ProductLogo } from "@/components/dashboard/product-logo";
import type { ApiProduct, WalletBalance } from "@/lib/api";
import type { PaymentResult } from "@/components/dashboard/payment-dialog";

const CABLE_COLORS: Record<string, { bg: string; text: string }> = {
  DSTV: { bg: "bg-[#0066FF]", text: "text-white" },
  GOTV: { bg: "bg-[#FF6600]", text: "text-white" },
  STARTIMES: { bg: "bg-[#E30613]", text: "text-white" },
  SHOWMAX: { bg: "bg-[#00953E]", text: "text-white" },
};

export function CableForm() {
  const { data: products, loading } = useFetch<ApiProduct[]>("/api/products/");
  const { data: wallet } = useFetch<WalletBalance>("/api/wallets/");
  const cableProducts = toArray(products).filter((p) => p.category === "CABLE" && p.is_active);

  const extractCableProvider = (product: ApiProduct): string => {
    const name = (product.name || "").toLowerCase();
    const code = (product.provider_product_code || "").toLowerCase();
    if (name.includes("dstv") || code.includes("dstv")) return "DSTV";
    if (name.includes("gotv") || code.includes("gotv")) return "GOTV";
    if (name.includes("startimes") || code.includes("startimes")) return "STARTIMES";
    if (name.includes("showmax") || code.includes("showmax")) return "SHOWMAX";
    return "OTHER";
  };

  const providers = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string; short: string; image_url?: string | null }>();
    for (const p of cableProducts) {
      const cableProvider = extractCableProvider(p);
      if (!map.has(cableProvider)) {
        map.set(cableProvider, {
          id: cableProvider,
          name: cableProvider,
          color: CABLE_COLORS[cableProvider]?.bg || "bg-[var(--color-action)]",
          short: cableProvider.slice(0, 2),
          image_url: p.image_url || getProductLogo(p),
        });
      }
    }
    return Array.from(map.values());
  }, [cableProducts]);

  const [provider, setProvider] = React.useState("");
  const [smartcard, setSmartcard] = React.useState("");
  const [pkg, setPkg] = React.useState<ApiProduct | null>(null);
  const [open, setOpen] = React.useState(false);

  const [customerName, setCustomerName] = React.useState<string | null>(null);
  const [verifying, setVerifying] = React.useState(false);
  const [verifyError, setVerifyError] = React.useState<string | null>(null);

  const packages = cableProducts.filter((p) => extractCableProvider(p) === provider);
  const validCard = /^\d{10,11}$/.test(smartcard);
  const pkgPrice = pkg ? Number(pkg.selling_price) : 0;
  const canPay = validCard && !!pkg && !!customerName;
  const insufficientBalance = wallet && pkgPrice > 0 && pkgPrice > Number(wallet.balance);
  const providerName = providers.find((p) => p.id === provider)?.name ?? "";

  const handleVerify = async () => {
    if (!validCard || !provider) return;
    setVerifying(true);
    setVerifyError(null);
    setCustomerName(null);
    try {
      const res = await buyApi.verifySmartcard({
        smartcard_number: smartcard,
        cable_provider: provider,
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
  }, [smartcard, provider]);

  const handlePay = async (): Promise<PaymentResult> => {
    if (!pkg) return { ok: false, error: "No package selected." };
    try {
      const res = await buyApi.cable({ product_id: pkg.id, smartcard_number: smartcard });
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
        <Card className="p-6 space-y-4">
          <Skeleton className="h-6 w-1/3" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-7 p-6 space-y-4">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </Card>
          <Card className="lg:col-span-5 p-6 space-y-4">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </Card>
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
          <span className="text-sm font-semibold text-[var(--color-success)] uppercase tracking-widest">Cable Subscription</span>
        </div>
        <h1 className="text-3xl font-bold text-[var(--foreground)] leading-tight">
          Renew <span className="text-[var(--color-success)]">Cable TV</span> Subscription
        </h1>
        <p className="text-lg text-[var(--color-text-secondary)] mt-2">
          Renew your DStv, GOtv, StarTimes or Showmax subscription instantly.
        </p>
      </section>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Panel: Form Entry */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Provider Selection */}
          <Card variant="bordered" className="p-6">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase mb-4 block">1. Select Provider</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {providers.map((p) => {
                const isSelected = provider === p.id;
                const cableColor = CABLE_COLORS[p.name] || { bg: "bg-gray-500", text: "text-white" };
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setProvider(p.id);
                      setPkg(null);
                      setCustomerName(null);
                      setVerifyError(null);
                    }}
                    className={`relative flex flex-col items-center justify-center p-4 rounded-lg transition-all border-2 active:scale-95 ${
                      isSelected
                        ? "border-[var(--color-success)] bg-[var(--color-success)]/5"
                        : "border-transparent bg-[var(--color-surface-elevated)] hover:bg-[var(--color-muted)]"
                    }`}
                  >
                    {p.image_url ? (
                      <div className="w-12 h-12 rounded-full bg-[var(--color-surface-elevated)] flex items-center justify-center mb-2 shadow-sm border border-[var(--color-border)] overflow-hidden">
                        <ProductLogo
                          product={{ image_url: p.image_url, provider: p.id }}
                          alt={p.name}
                          className="w-10 h-10 object-contain"
                        />
                      </div>
                    ) : (
                      <div className={`w-12 h-12 rounded-full ${cableColor.bg} flex items-center justify-center mb-2 shadow-sm`}>
                        <span className={`font-bold text-xs ${cableColor.text}`}>{p.short}</span>
                      </div>
                    )}
                    <span className="text-sm font-medium text-[var(--foreground)]">{p.name}</span>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-surface-elevated)] text-[var(--color-success)]">
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Smartcard & Verify */}
          <Card variant="bordered" className="p-6 flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase block">2. Smartcard / IUC Number</label>
              <div className="flex gap-2">
                <Input
                  id="smartcard"
                  inputMode="numeric"
                  placeholder="1234567890"
                  value={smartcard}
                  onChange={(e) => setSmartcard(e.target.value.replace(/\D/g, "").slice(0, 11))}
                />
                <Button
                  variant="outline"
                  onClick={handleVerify}
                  disabled={!validCard || !provider || verifying}
                  className="shrink-0"
                >
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                </Button>
              </div>
              {smartcard && !validCard && (
                <p className="text-xs text-destructive">Enter a valid smartcard number.</p>
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

          {/* Package Selection */}
          <Card variant="bordered" className="p-6 flex flex-col gap-4">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase block">3. Choose Package</label>
            <div className="grid gap-3 sm:grid-cols-2">
              {packages.map((p) => (
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
              {packages.length === 0 && provider && (
                <p className="col-span-2 py-8 text-center text-sm text-muted-foreground">
                  No packages available for this provider.
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
                <span className="text-sm text-white/70">Smartcard</span>
                <span className="text-sm font-medium">{smartcard || "----"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-sm text-white/70">Package</span>
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
                <span>Renew Now</span>
                <Tv className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
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
          { label: "Package", value: pkg?.name ?? "" },
          { label: "Smartcard", value: smartcard },
          { label: "Account name", value: customerName || "" },
        ]}
        onSubmit={handlePay}
      />
    </div>
  );
}
