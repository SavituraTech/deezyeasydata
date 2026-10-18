"use client";

import * as React from "react";
import { ArrowRight, Check, Smartphone } from "lucide-react";
import { AIRTIME_PRESETS } from "@/constants";
import { PaymentDialog } from "@/components/dashboard/payment-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNaira } from "@/lib/utils";
import { useFetch } from "@/hooks/use-api";
import { buyApi } from "@/lib/api";
import { toArray } from "@/lib/utils";
import { friendlyError } from "@/lib/errors";
import { getProductLogo } from "@/data/service-images";
import { ProductLogo } from "@/components/dashboard/product-logo";
import type { ApiProduct, WalletBalance } from "@/lib/api";
import type { PaymentResult } from "@/components/dashboard/payment-dialog";

const NETWORK_COLORS: Record<string, { bg: string; text: string }> = {
  MTN: { bg: "bg-[#FFCC00]", text: "text-black" },
  AIRTEL: { bg: "bg-[#ED1C24]", text: "text-white" },
  GLO: { bg: "bg-[#00FF00]", text: "text-black" },
  "9MOBILE": { bg: "bg-[#006838]", text: "text-white" },
};

export function AirtimeForm() {
  const { data: products, loading } = useFetch<ApiProduct[]>("/api/products/");
  const { data: wallet } = useFetch<WalletBalance>("/api/wallets/");
  const airtimeProducts = toArray(products).filter((p) => p.category === "AIRTIME" && p.is_active);

  const networks = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string; short: string; image_url?: string | null }>();
    for (const p of airtimeProducts) {
      if (p.network && !map.has(p.network)) {
        const colors: Record<string, string> = { MTN: "bg-[var(--color-accent)]", AIRTEL: "bg-red-500", GLO: "bg-green-600", "9MOBILE": "bg-green-800" };
        map.set(p.network, {
          id: p.network,
          name: p.network,
          color: colors[p.network] || "bg-gray-500",
          short: p.network.slice(0, 3),
          image_url: p.image_url || getProductLogo(p),
        });
      }
    }
    return Array.from(map.values());
  }, [airtimeProducts]);

  const [network, setNetwork] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [amount, setAmount] = React.useState<number | null>(null);
  const [custom, setCustom] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const effectiveAmount = custom ? Number(custom) : amount ?? 0;
  // Unified Nigerian phone validation — mirrors backend is_valid_nigerian_phone: ^0[789][01]\d{8}$
  const validPhone = /^0[789][01]\d{8}$/.test(phone);
  const phoneError =
    phone.length > 0 && !validPhone ? "Invalid Nigerian number (e.g. 08012345678)" : null;

  const filteredProducts = airtimeProducts.filter((p) => p.network === network);
  // VTU variable amounts: allow any amount 50–50000 directly; pick cheapest active product for network as template
  const matchedProduct = React.useMemo(() => {
    if (!effectiveAmount || filteredProducts.length === 0) return null;
    if (effectiveAmount < 50 || effectiveAmount > 50000) return null;
    // Exact match preferred; otherwise fallback to first active product (VTU variable)
    const exact = filteredProducts.find((p) => Number(p.selling_price) === effectiveAmount);
    return exact ?? filteredProducts[0] ?? null;
  }, [filteredProducts, effectiveAmount]);

  const insufficientBalance = wallet && effectiveAmount > 0 && effectiveAmount > Number(wallet.balance);
  const canPay = validPhone && effectiveAmount >= 50 && effectiveAmount <= 50000 && !!matchedProduct && !insufficientBalance;
  const networkName = networks.find((n) => n.id === network)?.name ?? "";
  const disableReason = !network
    ? "Select a network"
    : !validPhone
      ? phoneError ?? "Enter a valid phone number"
      : effectiveAmount < 50
        ? "Minimum amount is ₦50"
        : effectiveAmount > 50000
          ? "Maximum amount is ₦50,000"
          : !matchedProduct
            ? "No product available for this network/amount"
            : insufficientBalance
              ? `Insufficient wallet (need ${formatNaira(effectiveAmount)}, have ${formatNaira(Number(wallet?.balance ?? 0))})`
              : null;

  const handlePay = async (): Promise<PaymentResult> => {
    if (!matchedProduct) return { ok: false, error: "No matching product found." };
    try {
      // For VTU variable amounts, send amount explicitly if product price differs
      const payload: { product_id: number; phone: string; amount?: number } = {
        product_id: matchedProduct.id,
        phone,
      };
      if (Number(matchedProduct.selling_price) !== effectiveAmount) {
        payload.amount = effectiveAmount;
      }
      const res = await buyApi.airtime(payload);
      const txn = res.data.transaction;
      const isPending = txn.status === "PENDING";
      return {
        ok: true,
        id: txn.id,
        reference: txn.provider_reference || `TXN-${txn.id}`,
        cashbackAmount: res.data.cashback_amount,
        pending: isPending,
      };
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
            <Skeleton className="h-20 w-full rounded-lg" />
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
          <span className="text-sm font-semibold text-[var(--color-success)] uppercase tracking-widest">Instant Recharge</span>
        </div>
        <h1 className="text-3xl font-bold text-[var(--foreground)] leading-tight">
          Airtime <span className="text-[var(--color-success)]">Top-up</span>
        </h1>
        <p className="text-lg text-[var(--color-text-secondary)] mt-2">
          Fast, secure airtime purchase for all major Nigerian networks with instant value delivery.
        </p>
      </section>

      {/* Main Content: Asymmetric Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Panel: Form Entry */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Network Selection */}
          <Card variant="bordered" className="p-6">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase mb-4 block">1. Select Network Provider</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {networks.map((n) => {
                const isSelected = network === n.id;
                const netColors = NETWORK_COLORS[n.id] || { bg: "bg-gray-500", text: "text-white" };
                return (
                  <button
                    key={n.id}
                    onClick={() => setNetwork(n.id)}
                    className={`relative flex flex-col items-center justify-center p-4 rounded-lg transition-all border-2 active:scale-95 ${
                      isSelected
                        ? "border-[var(--color-success)] bg-[var(--color-success)]/5"
                        : "border-transparent bg-[var(--color-surface-elevated)] hover:bg-[var(--color-muted)]"
                    }`}
                  >
                    {n.image_url ? (
                      <div className="w-12 h-12 rounded-full bg-[var(--color-surface-elevated)] flex items-center justify-center mb-2 shadow-sm border border-[var(--color-border)] overflow-hidden">
                        <ProductLogo
                          product={{ image_url: n.image_url, network: n.id }}
                          alt={n.name}
                          className="w-10 h-10 object-contain"
                        />
                      </div>
                    ) : (
                      <div className={`w-12 h-12 rounded-full ${netColors.bg} flex items-center justify-center mb-2 shadow-sm`}>
                        <span className={`font-bold text-xs ${netColors.text}`}>{n.short}</span>
                      </div>
                    )}
                    <span className="text-sm font-medium text-[var(--foreground)]">{n.name}</span>
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

          {/* Phone Number & Amount */}
          <Card variant="bordered" className="p-6 flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase block">2. Beneficiary Details</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
                  <Smartphone className="h-5 w-5" aria-hidden="true" />
                </span>
                <input
                  aria-invalid={!!phoneError}
                  aria-describedby={phoneError ? "phone-error" : undefined}
                  className="w-full pl-12 pr-4 py-4 rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border)] focus:border-[var(--foreground)] focus:bg-[var(--color-surface-elevated)] transition-all text-lg text-[var(--foreground)] aria-[invalid=true]:border-destructive"
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="0800 000 0000"
                  value={phone}
                  onChange={(e) => {
                    let v = e.target.value.replace(/\D/g, "");
                    if (v.startsWith("234") && v.length > 11) v = v.slice(3);
                    if (!v.startsWith("0") && v.length === 10) v = "0" + v;
                    setPhone(v.slice(0, 11));
                  }}
                />
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] italic px-1">
                Ensure the number matches the selected network.
              </p>
              {phoneError && (
                <p id="phone-error" className="text-xs text-destructive px-1" role="alert">
                  {phoneError}
                </p>
              )}
              {insufficientBalance && (
                <p className="text-xs text-destructive px-1" role="alert" aria-live="polite">
                  Insufficient wallet (need {formatNaira(effectiveAmount)}, have {formatNaira(Number(wallet?.balance ?? 0))})
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase block">3. Recharge Amount</label>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {AIRTIME_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setAmount(preset);
                      setCustom("");
                    }}
                    className={`py-3 px-2 rounded-lg text-sm font-medium transition-all ${
                      amount === preset && !custom
                        ? "bg-[var(--color-surface-dark)] text-[var(--color-text-inverse)] border border-[var(--foreground)]"
                        : "bg-[var(--color-surface-elevated)] hover:bg-[var(--color-muted)] border border-[var(--color-border)] text-[var(--foreground)]"
                    }`}
                  >
                    ₦{preset.toLocaleString()}
                  </button>
                ))}
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-[var(--color-text-secondary)]">₦</span>
                <input
                  className="w-full pl-10 pr-4 py-4 rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border)] focus:border-[var(--foreground)] focus:bg-[var(--color-surface-elevated)] transition-all text-lg text-[var(--foreground)]"
                  type="number"
                  placeholder="Other Amount"
                  value={custom}
                  onChange={(e) => {
                    setCustom(e.target.value);
                    setAmount(null);
                  }}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right Panel: Summary & Validation */}
        <div className="lg:col-span-5 flex flex-col gap-4 lg:sticky lg:top-24">
          <div className="bg-[var(--color-surface-dark)] text-white p-6 rounded-xl shadow-xl overflow-hidden relative">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-3xl" />
            <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-[var(--color-success)]/20 rounded-full blur-3xl" />
            <h3 className="text-sm font-semibold uppercase tracking-widest text-white/60 mb-6 relative z-10">Transaction Summary</h3>
            <div className="space-y-4 relative z-10">
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-sm text-white/70">Provider</span>
                <span className="text-sm font-medium">{network || "Not Selected"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-sm text-white/70">Recipient</span>
                <span className="text-sm font-medium">
                  {phone.length === 11 ? phone.replace(/(\d{4})(\d{3})(\d{4})/, "$1 $2 $3") : "---- --- ----"}
                </span>
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
                title={disableReason ?? undefined}
                aria-disabled={!canPay}
                className="w-full py-4 rounded-full bg-[var(--color-success)] text-white text-lg font-semibold hover:bg-[var(--color-success)]/90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed group flex items-center justify-center gap-2"
              >
                <span>Purchase Now</span>
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
              {disableReason && effectiveAmount > 0 && (
                <p className="text-center text-xs text-white/70 mt-2" role="alert">
                  {disableReason}
                </p>
              )}
              <p className="text-center text-xs text-white/50 mt-2">Funds will be deducted from your wallet balance.</p>
            </div>
          </div>

        </div>
      </div>

      <PaymentDialog
        open={open}
        onOpenChange={setOpen}
        title={`${networkName} Airtime`}
        amount={effectiveAmount}
        summary={[
          { label: "Network", value: networkName },
          { label: "Phone", value: phone },
        ]}
        onSubmit={handlePay}
      />
    </div>
  );
}
