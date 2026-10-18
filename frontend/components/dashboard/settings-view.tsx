"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const PREFERENCES = [
  { id: "tx", label: "Transaction alerts", desc: "Get notified about every payment.", default: true },
  { id: "promo", label: "Promotions & offers", desc: "Cashback, discounts and news.", default: true },
  { id: "security", label: "Security alerts", desc: "New logins and password changes.", default: true },
  { id: "product", label: "Product updates", desc: "New features and improvements.", default: false },
];

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Customise your experience and secure your account." />

      <Card className="p-6">
        <h3 className="font-semibold text-foreground">Appearance</h3>
        <p className="text-sm text-muted-foreground">Choose how Deezy Easy Data looks to you.</p>
        <div className="mt-4 grid grid-cols-3 gap-3 sm:max-w-md">
          {THEMES.map((t) => {
            const active = mounted && theme === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 transition-all",
                  active ? "border-[var(--color-action)] ring-2 ring-[var(--color-action)]/30" : "border-border hover:border-[var(--color-action)]/40"
                )}
              >
                <t.icon className={cn("h-5 w-5", active ? "text-[var(--color-action)]" : "text-muted-foreground")} />
                <span className="text-sm font-medium text-foreground">{t.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-foreground">Notifications</h3>
        <p className="text-sm text-muted-foreground">Pick what you want to hear about.</p>
        <div className="mt-4 divide-y divide-border">
          {PREFERENCES.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="font-medium text-foreground">{p.label}</p>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </div>
              <Switch
                defaultChecked={p.default}
                onCheckedChange={(v) =>
                  toast.success(`${p.label} ${v ? "enabled" : "disabled"}`)
                }
              />
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-destructive/30 p-6">
        <h3 className="font-semibold text-destructive">Danger zone</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently delete your account and all associated data.
        </p>
        <Button
          variant="outline"
          className="mt-4 border-destructive/40 text-destructive hover:bg-destructive/10"
          disabled
        >
          Delete account
        </Button>
      </Card>
    </div>
  );
}
