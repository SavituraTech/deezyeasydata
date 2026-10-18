"use client";

import * as React from "react";
import { Download, FileText, Receipt, Users } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { downloadExport, getClientToken } from "@/lib/api";

const datasets = [
  { key: "users", label: "Users", description: "All registered users with profiles and status.", icon: Users },
  { key: "transactions", label: "Transactions", description: "All processed transactions across the platform.", icon: Receipt },
  { key: "products", label: "Products", description: "Product catalogue with pricing and margins.", icon: FileText },
] as const;

export function ExportView() {
  const [exporting, setExporting] = React.useState<string | null>(null);

  const handleExport = async (dataset: string) => {
    setExporting(dataset);
    try {
      const token = getClientToken();
      if (!token) throw new Error("Not authenticated");
      const blob = await downloadExport(token, dataset);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${dataset}-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${dataset} exported successfully`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Export failed";
      toast.error(msg);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Download platform data as CSV files for reporting and analysis.</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {datasets.map((ds) => (
          <Card key={ds.key} className="p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-action-subtle)] text-[var(--color-action)]">
              <ds.icon className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-foreground">{ds.label}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{ds.description}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              loading={exporting === ds.key}
              onClick={() => handleExport(ds.key)}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
