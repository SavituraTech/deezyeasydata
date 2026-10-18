"use client";

import * as React from "react";
import { Zap, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { ProviderPicker } from "@/components/dashboard/provider-picker";
import { AmountPresets } from "@/components/dashboard/amount-presets";
import { PaymentDialog } from "@/components/dashboard/payment-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNaira } from "@/lib/utils";
import { useFetch } from "@/hooks/use-api";
import { buyApi } from "@/lib/api";
import { toArray } from "@/lib/utils";
import { friendlyError } from "@/lib/errors";
import { getProductLogo } from "@/data/service-images";
import type { ApiProduct, WalletBalance } from "@/lib/api";
import type { PaymentResult } from "@/components/dashboard/payment-dialog";

const PRESETS = [1000, 2000, 3000, 5000, 10000, 20000];

const PROVIDER_COLORS: Record<string, string> = {
  IKEDC: "bg-[#0066FF]",
  EKEDC: "bg-[#E30613]",
  IBEDC: "bg-[#FFCC00]",
  AEDC: "bg-[#00953E]",
  KEDCO: "bg-[#006838]",
  JOS: "bg-[#FF6600]",
  BEDC: "bg-[#0066FF]",
};

export function ElectricityForm() {
  const { data: products, loading } = useFetch<ApiProduct[]>("/api/products/");
  const { data: wallet } = useFetch<WalletBalance>("/api/wallets/");
  const elecProducts = toArray(products).filter((p) => p.category === "ELECTRICITY" && p.is_active);

  const extractElecProvider = (product: ApiProduct): string => {
    const name = (product.name || "").toLowerCase();
    const code = (product.provider_product_code || "").toLowerCase();
    if (name.includes("ikedc") || code.includes("ikedc")) return "IKEDC";
    if (name.includes("ekedc") || code.includes("ekedc")) return "EKEDC";
    if (name.includes("ibedc") || code.includes("ibedc")) return "IBEDC";
    if (name.includes("aedc") || code.includes("aedc")) return "AEDC";
    if (name.includes("kedco") || code.includes("kedco")) return "KEDCO";
    if (name.includes("jos") || code.includes("jos")) return "JOS";
    if (name.includes("bedc") || code.includes("bedc")) return "BEDC";
    if (name.includes("yedc") || code.includes("yedc")) return "YEDC";
    if (name.includes("kedc") || code.includes("kedc")) return "KEDC";
    if (name.includes("phed") || code.includes("phed")) return "PHED";
    if (name.includes("eedc") || code.includes("eedc")) return "EEDC";
    if (name.includes("jedc") || code.includes("jedc")) return "JEDC";
    if (name.includes("nepa") || code.includes("nepa") || name.includes("electric") || code.includes("electric")) return "OTHER";
    return "OTHER";
  };

  const providers = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string; short: string; image_url?: string | null }>();
    for (const p of elecProducts) {
      const elecProvider = extractElecProvider(p);
      if (!map.has(elecProvider)) {
        map.set(elecProvider, {
          id: elecProvider,
          name: elecProvider,
          color: PROVIDER_COLORS[elecProvider] || "bg-[var(--color-action)]",
          short: elecProvider.slice(0, 3),
          image_url: p.image_url || getProductLogo(p),
        });
      }
    }
    return Array.from(map.values());
  }, [elecProducts]);

  const [provider, setProvider] = React.useState("");
  const [meterType, setMeterType] = React.useState("prepaid");
  const [meter, setMeter] = React.useState("");
  const [amount, setAmount] = React.useState<number | null>(null);
  const [custom, setCustom] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const [customerName, setCustomerName] = React.useState<string | null>(null);
  const [verifying, setVerifying] = React.useState(false);
  const [verifyError, setVerifyError] = React.useState<string | null>(null);

  const effectiveAmount = custom ? Number(custom) : amount ?? 0;
  const validMeter = /^\d{10,13}$/.test(meter);
  const matchedProduct = elecProducts.find(
    (p) => extractElecProvider(p) === provider && Number(p.selling_price) === effectiveAmount
  );
  const canPay = validMeter && effectiveAmount >= 500 && !!matchedProduct && !!customerName;
  const insufficientBalance = wallet && effectiveAmount > 0 && effectiveAmount > Number(wallet.balance);
  const providerName = providers.find((p) => p.id === provider)?.name ?? "";

  const handleVerify = async () => {
    if (!validMeter || !provider) return;
    setVerifying(true);
    setVerifyError(null);
    setCustomerName(null);
    try {
      const res = await buyApi.verifyMeter({
        meter_number: meter,
        meter_type: meterType as "prepaid" | "postpaid",
        disco_code: provider,
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
  }, [meter, meterType, provider]);

  const handlePay = async (): Promise<PaymentResult> => {
    if (!matchedProduct) return { ok: false, error: "No matching product found." };
    try {
      const res = await buyApi.electricity({
        product_id: matchedProduct.id,
        meter_number: meter,
        amount: String(effectiveAmount),
        meter_type: meterType as "prepaid" | "postpaid",
      });
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
          <Skeleton className="h-32 w-full rounded-xl" />
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
          <span className="text-sm font-semibold text-[var(--color-success)] uppercase tracking-widest">Instant Payment</span>
        </div>
        <h1 className="text-3xl font-bold text-[var(--foreground)] leading-tight">
          Pay <span className="text-[var(--color-success)]">Electricity</span> Bills
        </h1>
        <p className="text-lg text-[var(--color-text-secondary)] mt-2">
          Buy prepaid units or settle postpaid bills for all distribution companies.
        </p>
      </section>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Panel: Form Entry */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Provider Selection */}
          <Card variant="bordered" className="p-6">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase mb-4 block">1. Distribution Company</label>
            <ProviderPicker providers={providers} value={provider} onChange={setProvider} columns={5} />
          </Card>

          {/* Meter Details */}
          <Card variant="bordered" className="p-6 flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase block">2. Meter Details</label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Meter type</Label>
                  <Select value={meterType} onValueChange={setMeterType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prepaid">Prepaid</SelectItem>
                      <SelectItem value="postpaid">Postpaid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="meter">Meter number</Label>
                  <div className="flex gap-2">
                    <Input
                      id="meter"
                      inputMode="numeric"
                      placeholder="1234567890"
                      value={meter}
                      onChange={(e) => setMeter(e.target.value.replace(/\D/g, "").slice(0, 13))}
                    />
                    <Button
                      variant="outline"
                      onClick={handleVerify}
                      disabled={!validMeter || !provider || verifying}
                      className="shrink-0"
                    >
                      {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                    </Button>
                  </div>
                </div>
              </div>
              {meter && !validMeter && (
                <p className="text-xs text-destructive">Enter a valid meter number (10-13 digits).</p>
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

          {/* Amount */}
          <Card variant="bordered" className="p-6 flex flex-col gap-4">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase block">3. Amount</label>
            <AmountPresets
              presets={PRESETS}
              value={custom ? null : amount}
              onSelect={(a) => {
                setAmount(a);
                setCustom("");
              }}
            />
            <Input
              type="number"
              min={500}
              placeholder="Or enter a custom amount"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                setAmount(null);
              }}
            />
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
                <span className="text-sm text-white/70">Meter Type</span>
                <span className="text-sm font-medium">{meterType === "prepaid" ? "Prepaid" : "Postpaid"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-sm text-white/70">Meter Number</span>
                <span className="text-sm font-medium">{meter || "----"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-sm text-white/70">Account Name</span>
                <span className="text-sm font-medium">{customerName || "----"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-sm text-white/70">Fee / Margin</span>
                <span className="text-sm font-medium text-[var(--color-success)]">
                  {matchedProduct?.margin ? `₦${Number(matchedProduct.margin).toFixed(2)}` : "₦0.00"}
                </span>
              </div>
              <div className="flex justify-between items-end pt-6 pb-2">
                <span className="text-lg font-semibold">Total Payable</span>
                <span className="text-2xl font-bold">{effectiveAmount > 0 ? formatNaira(effectiveAmount) : "₦0.00"}</span>
              </div>
            </div>
            <div className="mt-6 relative z-10">
              <button
                onClick={() => setOpen(true)}
                disabled={!canPay}
                className="w-full py-4 rounded-full bg-[var(--color-success)] text-white text-lg font-semibold hover:bg-[var(--color-success)]/90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed group flex items-center justify-center gap-2"
              >
                <span>Pay Now</span>
                <Zap className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <p className="text-center text-xs text-white/50 mt-4">Funds will be deducted from your wallet balance.</p>
            </div>
          </div>

          {insufficientBalance && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Insufficient balance. You need {formatNaira(effectiveAmount)} but have {formatNaira(Number(wallet?.balance || 0))}.</span>
            </div>
          )}


        </div>
      </div>

      <PaymentDialog
        open={open}
        onOpenChange={setOpen}
        title={`${provider} Electricity`}
        amount={effectiveAmount}
        summary={[
          { label: "Provider", value: provider },
          { label: "Meter type", value: meterType === "prepaid" ? "Prepaid" : "Postpaid" },
          { label: "Meter number", value: meter },
          { label: "Account name", value: customerName || "" },
        ]}
        onSubmit={handlePay}
      />
    </div>
  );
}
