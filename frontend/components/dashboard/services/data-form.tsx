"use client";

import * as React from "react";
import { Check, AlertTriangle, Rocket, Radio, Phone, Signal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { PaymentDialog } from "@/components/dashboard/payment-dialog";
import {
  groupDataPlansByCategory,
  getAvailableDataCategories,
  type DataPlanCategory,
} from "@/lib/data-categories";
import type { ApiProduct, WalletBalance } from "@/lib/api";
import type { PaymentResult } from "@/components/dashboard/payment-dialog";

const NETWORK_COLORS: Record<string, { bg: string; text: string }> = {
  MTN: { bg: "bg-[#FFCC00]", text: "text-black" },
  AIRTEL: { bg: "bg-[#E30613]", text: "text-white" },
  GLO: { bg: "bg-[#00953E]", text: "text-white" },
  "9MOBILE": { bg: "bg-[#006341]", text: "text-white" },
};

export function DataForm() {
  const { data: products, loading } = useFetch<ApiProduct[]>("/api/products/");
  const { data: wallet } = useFetch<WalletBalance>("/api/wallets/");
  const dataProducts = toArray(products).filter((p) => p.category === "DATA" && p.is_active);

  const networks = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string; short: string; image_url?: string | null }>();
    for (const p of dataProducts) {
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
  }, [dataProducts]);

  const [network, setNetwork] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [plan, setPlan] = React.useState<ApiProduct | null>(null);
  const [selectedCategory, setSelectedCategory] = React.useState<DataPlanCategory | null>(null);
  const [open, setOpen] = React.useState(false);

  const filteredByNetwork = dataProducts.filter((p) => p.network === network);
  const grouped = React.useMemo(() => groupDataPlansByCategory(filteredByNetwork), [filteredByNetwork]);
  const availableCategories = React.useMemo(() => getAvailableDataCategories(grouped), [grouped]);
  const activeCategory = selectedCategory || (availableCategories.length > 0 ? availableCategories[0] : null);
  const displayedPlans = activeCategory ? grouped[activeCategory] : [];

  // Unified Nigerian phone validation — mirrors backend is_valid_nigerian_phone: ^0[789][01]\d{8}$
  const validPhone = /^0[789][01]\d{8}$/.test(phone);
  const phoneError = phone.length > 0 && !validPhone ? "Invalid Nigerian number (e.g. 08012345678)" : null;
  const planPrice = plan ? Number(plan.selling_price) : 0;
  const insufficientBalance = wallet && planPrice > 0 && planPrice > Number(wallet.balance);
  const canPay = validPhone && !!plan && !insufficientBalance;
  const networkName = networks.find((n) => n.id === network)?.name ?? "";
  const disableReason = !network
    ? "Select a network"
    : !validPhone
      ? phoneError ?? "Enter a valid phone number"
      : !plan
        ? "Select a data plan"
        : insufficientBalance
          ? `Insufficient wallet (need ${formatNaira(planPrice)}, have ${formatNaira(Number(wallet?.balance ?? 0))})`
          : null;

  const handlePay = async (): Promise<PaymentResult> => {
    if (!plan) return { ok: false, error: "No plan selected." };
    try {
      const res = await buyApi.data({ product_id: plan.id, phone });
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
            <Skeleton className="h-64 w-full rounded-xl" />
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
        <div className="lg:col-span-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-[1px] bg-[var(--color-surface-dark)]" />
            <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-[0.2em]">Instant Connectivity</span>
          </div>
          <h1 className="text-3xl font-bold text-[var(--foreground)] max-w-2xl leading-tight">
            Top up your digital life with <span className="text-[var(--color-success)]">premium data bundles</span> tailored for your lifestyle.
          </h1>
        </div>
        <div className="hidden lg:flex lg:col-span-4 justify-end">
          <div className="text-right">
            <div className="text-2xl font-bold text-[var(--color-text-secondary)] opacity-20">DATA HUB</div>
            <div className="text-xs text-[var(--color-text-secondary)] uppercase">Fast • Reliable • Secure</div>
          </div>
        </div>
      </div>

      {/* Step 1: Provider & Destination */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Network Selection Card */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <Card variant="bordered" className="p-6 relative overflow-hidden group transition-all hover:shadow-xl">
            <div className="flex items-center justify-between z-10">
              <span className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase">01. Provider</span>
              <span className="text-[var(--color-success)]">
                <Radio className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 z-10 mt-4">
              {networks.map((n) => {
                const isSelected = network === n.id;
                const netColors = NETWORK_COLORS[n.id] || { bg: "bg-gray-500", text: "text-white" };
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      setNetwork(n.id);
                      setPlan(null);
                      setSelectedCategory(null);
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all gap-2 ${
                      isSelected
                        ? "border-[var(--foreground)] bg-[var(--color-surface-elevated)]"
                        : "border-transparent hover:border-[var(--color-border)] bg-[var(--color-surface-elevated)]"
                    }`}
                  >
                    {n.image_url ? (
                      <div className="w-10 h-10 rounded-full bg-[var(--color-surface-elevated)] flex items-center justify-center shadow-sm border border-[var(--color-border)] overflow-hidden">
                        <ProductLogo
                          product={{ image_url: n.image_url, network: n.id }}
                          alt={n.name}
                          className="w-8 h-8 object-contain"
                        />
                      </div>
                    ) : (
                      <div className={`w-10 h-10 ${netColors.bg} rounded-full flex items-center justify-center font-bold text-xs shadow-sm ${netColors.text}`}>
                        {n.short}
                      </div>
                    )}
                    <span className="text-xs font-medium text-[var(--foreground)]">{n.name}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Number Input Card */}
          <Card variant="bordered" className="p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase">02. Destination</span>
              <span className="text-[var(--color-success)]">
                <Phone className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <input
              aria-invalid={!!phoneError}
              aria-describedby={phoneError ? "phone-error" : undefined}
              className="w-full py-4 px-4 rounded-lg bg-[var(--color-surface-elevated)] text-lg text-[var(--foreground)] focus:ring-2 focus:ring-[var(--foreground)]/10 transition-all placeholder:opacity-30 aria-[invalid=true]:border-destructive"
              type="tel"
              inputMode="numeric"
              placeholder="0800 000 0000"
              value={phone}
              onChange={(e) => {
                let v = e.target.value.replace(/\D/g, "");
                if (v.startsWith("234") && v.length > 11) v = v.slice(3);
                if (!v.startsWith("0") && v.length === 10) v = "0" + v;
                setPhone(v.slice(0, 11));
              }}
            />
            {phoneError && (
              <p id="phone-error" className="text-xs text-destructive px-1" role="alert">
                {phoneError}
              </p>
            )}
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <span>ℹ️</span>
              <span>Verify number matches selected network</span>
            </div>
          </Card>
        </div>

        {/* Step 2: Data Plan Selection */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Card variant="bordered" className="p-6 h-full flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase">03. Choose Plan</span>
                <div className="h-px w-12 bg-[var(--color-border)]" />
              </div>
              {/* Type Filter */}
              {availableCategories.length > 0 && (
                <div className="flex bg-[var(--color-surface-container-highest)] p-1 rounded-full">
                  {availableCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setSelectedCategory(cat);
                        setPlan(null);
                      }}
                      className={cn(
                        "px-6 py-1.5 rounded-full text-sm font-medium transition-all",
                        activeCategory === cat
                          ? "bg-[var(--color-surface-dark)] text-[var(--color-text-inverse)]"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--foreground)]"
                      )}
                    >
                      {cat === "ALL" ? "All" : cat.charAt(0) + cat.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Plan Grid */}
            {network ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto max-h-[600px] pr-2">
                {displayedPlans.map((p) => {
                  const isSelected = plan?.id === p.id;
                  const logo = p.image_url || getProductLogo(p);
                  return (
                    <div
                      key={p.id}
                      onClick={() => setPlan(p)}
                      className={`relative cursor-pointer p-6 rounded-xl border-2 transition-all flex flex-col gap-4 group ${
                        isSelected
                          ? "border-[var(--color-success)] bg-[var(--color-success)]/5"
                          : "border-transparent hover:border-[var(--color-success)] bg-[var(--color-surface-elevated)]"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className={`p-2 rounded-lg ${isSelected ? "bg-[var(--color-success)] text-white" : "bg-[var(--color-success)]/10 text-[var(--color-success)]"}`}>
                          <Signal className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-[var(--color-text-secondary)] uppercase block">Validity</span>
                          <span className="text-sm font-medium text-[var(--foreground)]">{p.data_validity || "30 Days"}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-2xl font-bold text-[var(--foreground)] leading-none">{p.data_size || p.name}</span>
                        <span className="block text-sm text-[var(--color-text-secondary)] mt-1">{p.name}</span>
                      </div>
                      <div className="mt-auto pt-4 border-t border-[var(--color-border)] flex items-center justify-between">
                        <span className="text-xl font-bold text-[var(--color-success)]">{formatNaira(Number(p.selling_price))}</span>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          isSelected
                            ? "bg-[var(--color-success)] border-2 border-[var(--color-success)]"
                            : "border-2 border-[var(--color-border)] group-hover:bg-[var(--color-success)] group-hover:border-[var(--color-success)]"
                        }`}>
                          <Check className={`text-[18px] ${isSelected ? "text-white" : "text-transparent group-hover:text-white"}`} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {displayedPlans.length === 0 && activeCategory && (
                  <p className="col-span-2 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                    No plans found in this category.
                  </p>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-[var(--color-text-secondary)]">
                Select a network to view available data plans
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Step 3: Confirmation & Action */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-[var(--color-surface-dark)] p-6 lg:p-12 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-success)]/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--color-action)]/20 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        <div className="flex flex-col gap-2 z-10">
          <h2 className="text-xl font-semibold text-white">Summary</h2>
          <div className="flex items-center gap-4 text-white/60">
            <span className="text-sm font-medium">{networkName} • {plan?.data_size || "—"}</span>
            <span className="w-1 h-1 bg-white/30 rounded-full" />
            <span className="text-sm font-medium">{phone.length === 11 ? phone.replace(/(\d{4})(\d{3})(\d{4})/, "$1 $2 $3") : "---- --- ----"}</span>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4 z-10 w-full lg:w-auto">
          <div className="text-center md:text-right px-4">
            <span className="text-xs text-white/60 uppercase block">Total Amount</span>
            <span className="text-2xl font-bold text-white">{plan ? formatNaira(Number(plan.selling_price)) : "₦0.00"}</span>
          </div>            <button
              onClick={() => setOpen(true)}
              disabled={!canPay}
              title={disableReason ?? undefined}
              aria-disabled={!canPay}
              className="group relative overflow-hidden bg-[var(--color-success)] text-white px-12 py-5 rounded-xl text-lg font-semibold transition-all hover:scale-[1.02] active:scale-95 shadow-2xl flex items-center gap-3 w-full md:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="relative z-10">PURCHASE DATA</span>
              <Rocket className="relative z-10 h-5 w-5 animate-pulse" />
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            {disableReason && planPrice > 0 && (
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
          <span>Insufficient balance. You need {formatNaira(planPrice)} but have {formatNaira(Number(wallet?.balance || 0))}.</span>
        </div>
      )}

      <PaymentDialog
        open={open}
        onOpenChange={setOpen}
        title={`${networkName} Data`}
        amount={plan ? Number(plan.selling_price) : 0}
        summary={[
          { label: "Network", value: networkName },
          { label: "Bundle", value: plan ? `${plan.data_size || plan.name} · ${plan.data_validity || "30 days"}` : "" },
          { label: "Phone", value: phone },
        ]}
        onSubmit={handlePay}
      />
    </div>
  );
}
