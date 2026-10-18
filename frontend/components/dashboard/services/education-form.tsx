"use client";

import * as React from "react";
import { GraduationCap, Minus, Plus, AlertTriangle, Check } from "lucide-react";
import { ProviderPicker } from "@/components/dashboard/provider-picker";
import { PaymentDialog } from "@/components/dashboard/payment-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const EDU_COLORS: Record<string, { bg: string; text: string }> = {
  WAEC: { bg: "bg-[#0066FF]", text: "text-white" },
  JAMB: { bg: "bg-[#00953E]", text: "text-white" },
  NECO: { bg: "bg-[#E30613]", text: "text-white" },
  NABTEB: { bg: "bg-[#FF6600]", text: "text-white" },
};

export function EducationForm() {
  const { data: products, loading } = useFetch<ApiProduct[]>("/api/products/");
  const { data: wallet } = useFetch<WalletBalance>("/api/wallets/");
  const eduProducts = toArray(products).filter((p) => p.category === "EDUCATION" && p.is_active);

  const extractEduProvider = (product: ApiProduct): string => {
    const name = (product.name || "").toLowerCase();
    const code = (product.provider_product_code || "").toLowerCase();
    if (name.includes("waec") || code.includes("waec")) return "WAEC";
    if (name.includes("jamb") || code.includes("jamb")) return "JAMB";
    if (name.includes("neco") || code.includes("neco")) return "NECO";
    if (name.includes("nabteb") || code.includes("nabteb")) return "NABTEB";
    return "OTHER";
  };

  const providers = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string; short: string; image_url?: string | null }>();
    for (const p of eduProducts) {
      const eduProvider = extractEduProvider(p);
      if (!map.has(eduProvider)) {
        map.set(eduProvider, {
          id: eduProvider,
          name: eduProvider,
          color: EDU_COLORS[eduProvider]?.bg || "bg-[var(--color-action)]",
          short: eduProvider.slice(0, 2),
          image_url: p.image_url || getProductLogo(p),
        });
      }
    }
    return Array.from(map.values());
  }, [eduProducts]);

  const [provider, setProvider] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [qty, setQty] = React.useState(1);
  const [open, setOpen] = React.useState(false);

  const matchedProduct = eduProducts.find((p) => extractEduProvider(p) === provider);
  const unit = matchedProduct ? Number(matchedProduct.selling_price) : 0;
  const total = unit * qty;
  // Unified Nigerian phone validation — mirrors backend is_valid_nigerian_phone: ^0[789][01]\d{8}$
  const validPhone = /^0[789][01]\d{8}$/.test(phone);
  const phoneError = phone.length > 0 && !validPhone ? "Invalid Nigerian number (e.g. 08012345678)" : null;
  const insufficientBalance = wallet && total > 0 && total > Number(wallet.balance);
  const canPay = validPhone && qty >= 1 && !!matchedProduct && !insufficientBalance;
  const providerName = providers.find((p) => p.id === provider)?.name ?? "";
  const disableReason = !provider
    ? "Select a service"
    : !validPhone
      ? phoneError ?? "Enter a valid phone number"
      : !matchedProduct
        ? "No service available"
        : insufficientBalance
          ? `Insufficient wallet (need ${formatNaira(total)}, have ${formatNaira(Number(wallet?.balance ?? 0))})`
          : null;

  const handlePay = async (): Promise<PaymentResult> => {
    if (!matchedProduct) return { ok: false, error: "No service selected." };
    try {
      const res = await buyApi.education({ product_id: matchedProduct.id, quantity: qty });
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
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
          <span className="text-sm font-semibold text-[var(--color-success)] uppercase tracking-widest">Education PINs</span>
        </div>
        <h1 className="text-3xl font-bold text-[var(--foreground)] leading-tight">
          Buy <span className="text-[var(--color-success)]">Education</span> PINs
        </h1>
        <p className="text-lg text-[var(--color-text-secondary)] mt-2">
          Buy WAEC, JAMB and NECO PINs and tokens for examination registration.
        </p>
      </section>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Panel: Form Entry */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Service Selection */}
          <Card variant="bordered" className="p-6">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase mb-4 block">1. Select Service</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {providers.map((p) => {
                const isSelected = provider === p.id;
                const eduColor = EDU_COLORS[p.name] || { bg: "bg-gray-500", text: "text-white" };
                return (
                  <button
                    key={p.id}
                    onClick={() => setProvider(p.id)}
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
                      <div className={`w-12 h-12 rounded-full ${eduColor.bg} flex items-center justify-center mb-2 shadow-sm`}>
                        <span className={`font-bold text-xs ${eduColor.text}`}>{p.short}</span>
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

          {/* Phone Number */}
          <Card variant="bordered" className="p-6 flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase block">2. Phone Number</label>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                placeholder="08012345678"
                value={phone}
                onChange={(e) => {
                  let v = e.target.value.replace(/\D/g, "");
                  if (v.startsWith("234") && v.length > 11) v = v.slice(3);
                  if (!v.startsWith("0") && v.length === 10) v = "0" + v;
                  setPhone(v.slice(0, 11));
                }}
              />
              {phoneError && (
                <p id="phone-error" className="text-xs text-destructive" role="alert">{phoneError}</p>
              )}
            </div>
          </Card>

          {/* Quantity */}
          <Card variant="bordered" className="p-6 flex flex-col gap-4">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase block">3. Quantity</label>
            <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-elevated)]">
              <div>
                <p className="text-sm font-medium text-foreground">Number of PINs</p>
                <p className="text-xs text-muted-foreground">{unit > 0 ? `${formatNaira(unit)} each` : "Select a service"}</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-6 text-center font-semibold text-foreground">{qty}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQty((q) => Math.min(10, q + 1))}
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
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
                <span className="text-sm text-white/70">Service</span>
                <span className="text-sm font-medium">{provider || "Not Selected"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-sm text-white/70">Phone</span>
                <span className="text-sm font-medium">
                  {phone.length === 11 ? phone.replace(/(\d{4})(\d{3})(\d{4})/, "$1 $2 $3") : "---- --- ----"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-sm text-white/70">Quantity</span>
                <span className="text-sm font-medium">{qty} PIN{qty > 1 ? "s" : ""}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-sm text-white/70">Unit Price</span>
                <span className="text-sm font-medium">{unit > 0 ? formatNaira(unit) : "₦0.00"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-sm text-white/70">Fee</span>
                <span className="text-sm font-medium text-[var(--color-success)]">₦0.00</span>
              </div>
              <div className="flex justify-between items-end pt-6 pb-2">
                <span className="text-lg font-semibold">Total Payable</span>
                <span className="text-2xl font-bold">{total > 0 ? formatNaira(total) : "₦0.00"}</span>
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
                <span>Buy PIN{qty > 1 ? "s" : ""}</span>
                <GraduationCap className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
              {disableReason && total > 0 && (
                <p className="text-center text-xs text-white/70 mt-2" role="alert">
                  {disableReason}
                </p>
              )}
              <p className="text-center text-xs text-white/50 mt-2">Funds will be deducted from your wallet balance.</p>
            </div>
          </div>

          {insufficientBalance && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Insufficient balance. You need {formatNaira(total)} but have {formatNaira(Number(wallet?.balance || 0))}.</span>
            </div>
          )}


        </div>
      </div>

      <PaymentDialog
        open={open}
        onOpenChange={setOpen}
        title={provider}
        amount={total}
        summary={[
          { label: "Service", value: provider },
          { label: "Quantity", value: String(qty) },
          { label: "Phone", value: phone },
        ]}
        onSubmit={handlePay}
      />
    </div>
  );
}
