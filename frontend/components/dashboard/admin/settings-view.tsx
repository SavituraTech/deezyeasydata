"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi, walletConfigApi, getClientToken, type PlatformKyc, type WalletConfig } from "@/lib/api";

const CATEGORIES = ["AIRTIME", "DATA", "ELECTRICITY", "CABLE", "BROADBAND", "EDUCATION"];
const CATEGORY_LABELS: Record<string, string> = {
  AIRTIME: "Airtime",
  DATA: "Data",
  ELECTRICITY: "Electricity",
  CABLE: "Cable TV",
  BROADBAND: "Broadband",
  EDUCATION: "Education",
};

export function SettingsView() {
  const [config, setConfig] = React.useState<WalletConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [kyc, setKyc] = React.useState<PlatformKyc | null>(null);

  React.useEffect(() => {
    const fetchConfig = async () => {
      const token = getClientToken();
      if (!token) return;
      try {
        const [data, kycData] = await Promise.all([walletConfigApi.get(token), adminApi.platformKyc(token)]);
        setConfig(data);
        setKyc(kycData);
      } catch {
        toast.error("Failed to load wallet config");
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const token = getClientToken();
      if (!token) return;
      const updated = await walletConfigApi.update(token, {
        funding_charge: config.funding_charge,
        cashback_rate_percent: config.cashback_rate_percent,
        cashback_rate_by_category: config.cashback_rate_by_category,
        paymentpoint_enabled: false,
        payvessel_enabled: true,
        default_payment_provider: "payvessel",
      });
      if (kyc?.id_type && kyc.id_number) {
        setKyc(await adminApi.updatePlatformKyc(token, { id_type: kyc.id_type, id_number: kyc.id_number }));
      }
      setConfig(updated);
      toast.success("Settings saved");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-5 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </Card>
    );
  }

  if (!config) {
    return (
      <Card className="p-5">
        <p className="text-center text-muted-foreground">Failed to load settings.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Configure funding charges and cashback rates.</p>
        <Button size="sm" loading={saving} onClick={handleSave}>
          <Save className="h-4 w-4" />
          Save
        </Button>
      </div>

      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Funding charge (NGN)</label>
            <Input
              type="number"
              step="0.01"
              value={config.funding_charge}
              onChange={(e) => setConfig({ ...config, funding_charge: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">Flat fee charged on wallet deposits.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Default cashback rate (%)</label>
            <Input
              type="number"
              step="0.01"
              value={config.cashback_rate_percent}
              onChange={(e) => setConfig({ ...config, cashback_rate_percent: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">Fallback cashback rate for all categories.</p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 font-semibold text-foreground">Payment Provider</h2>
        <p className="mb-4 text-sm text-muted-foreground">Wallet funding and virtual accounts are processed by PayVessel.</p>
        <div className="flex items-center gap-3 rounded-lg border border-[var(--color-action)]/30 bg-[var(--color-action-subtle)] p-4 text-sm font-medium">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-success)]" />
          PayVessel · Active
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 font-semibold text-foreground">Shared Virtual Account KYC</h2>
        <p className="mb-4 text-sm text-muted-foreground">Used server-side for customer accounts. Customers cannot view this value.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="mb-1 block text-sm font-medium">Identity type</label><select className="h-10 w-full rounded-md border bg-background px-3" value={kyc?.id_type ?? "bvn"} onChange={(e) => setKyc({ id_type: e.target.value as "bvn" | "nin", id_number: kyc?.id_number ?? "", updated_at: kyc?.updated_at ?? "" })}><option value="bvn">BVN</option><option value="nin">NIN</option></select></div>
          <div><label className="mb-1 block text-sm font-medium">11-digit number</label><Input type="password" inputMode="numeric" maxLength={11} value={kyc?.id_number ?? ""} onChange={(e) => setKyc({ id_type: kyc?.id_type ?? "bvn", id_number: e.target.value.replace(/\D/g, "").slice(0, 11), updated_at: kyc?.updated_at ?? "" })} /></div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 font-semibold text-foreground">Cashback by Category</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Per-category cashback rates override the default rate above.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((cat) => (
            <div key={cat}>
              <label className="mb-1 block text-sm font-medium">{CATEGORY_LABELS[cat]}</label>
              <Input
                type="number"
                step="0.01"
                value={config.cashback_rate_by_category[cat] || "0.00"}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    cashback_rate_by_category: {
                      ...config.cashback_rate_by_category,
                      [cat]: e.target.value,
                    },
                  })
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">% rate</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
