"use client";

import { Copy, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import type { Transaction } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatNaira } from "@/lib/utils";

const TYPE_LABELS: Record<Transaction["type"], string> = {
  airtime: "Airtime",
  data: "Data",
  electricity: "Electricity",
  cable: "Cable TV",
  broadband: "Broadband",
  education: "Education",
  "wallet-funding": "Wallet Funding",
};

const STATUS_CONFIG: Record<Transaction["status"], { label: string; variant: "success" | "destructive" | "warning" }> = {
  success: { label: "Successful", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
  pending: { label: "Pending", variant: "warning" },
};

export function TransactionDetailDialog({
  tx,
  onOpenChange,
}: {
  tx: Transaction | null;
  onOpenChange: (open: boolean) => void;
}) {
  const isCredit = tx?.direction === "in";

  const copyRef = () => {
    if (!tx) return;
    navigator.clipboard.writeText(tx.reference);
    toast.success("Reference copied");
  };

  return (
    <Dialog open={!!tx} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {tx && (
          <>
            <DialogHeader>
              <DialogTitle>Transaction details</DialogTitle>
            </DialogHeader>

            {/* Amount + Status */}
            <div className="text-center">
              <p className={`text-3xl font-bold ${isCredit ? "text-success" : "text-foreground"}`}>
                {isCredit ? "+" : "-"}
                {formatNaira(tx.amount)}
              </p>
              <div className="mt-2 flex justify-center">
                <Badge variant={STATUS_CONFIG[tx.status].variant}>
                  {STATUS_CONFIG[tx.status].label}
                </Badge>
              </div>
            </div>

            {/* Detail rows */}
            <dl className="divide-y divide-border rounded-xl border border-border">
              <div className="flex justify-between gap-4 px-4 py-3 text-sm">
                <dt className="text-muted-foreground">Type</dt>
                <dd className="text-right font-medium text-foreground">
                  {TYPE_LABELS[tx.type] || tx.type}
                </dd>
              </div>
              {tx.title && (
                <div className="flex justify-between gap-4 px-4 py-3 text-sm">
                  <dt className="text-muted-foreground">Service</dt>
                  <dd className="text-right font-medium text-foreground">{tx.title}</dd>
                </div>
              )}
              {tx.description && (
                <div className="flex justify-between gap-4 px-4 py-3 text-sm">
                  <dt className="text-muted-foreground">{isCredit ? "Source" : "Recipient"}</dt>
                  <dd className="text-right font-medium text-foreground break-all">{tx.description}</dd>
                </div>
              )}
              {tx.provider && (
                <div className="flex justify-between gap-4 px-4 py-3 text-sm">
                  <dt className="text-muted-foreground">Provider</dt>
                  <dd className="text-right font-medium text-foreground">{tx.provider}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4 px-4 py-3 text-sm">
                <dt className="text-muted-foreground">Date</dt>
                <dd className="text-right font-medium text-foreground">{formatDateTime(tx.date)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <dt className="text-muted-foreground">Reference</dt>
                <dd className="flex items-center gap-2 font-medium text-foreground">
                  <span className="font-mono text-xs">{tx.reference}</span>
                  <button onClick={copyRef} aria-label="Copy reference" className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </dd>
              </div>
            </dl>

            <Button variant="outline" size="lg" className="w-full" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
