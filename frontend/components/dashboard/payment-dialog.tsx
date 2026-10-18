"use client";

import * as React from "react";
import { CheckCircle2, Gift, XCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/utils";
import { buyApi } from "@/lib/api";

export interface PaymentSummary {
  label: string;
  value: string;
}

export type PaymentResult =
  | { ok: true; id: number; reference: string; cashbackAmount?: number | string | null; pending?: boolean }
  | { ok: false; error: string };

type Stage = "review" | "processing" | "pending" | "done" | "error";

export function PaymentDialog({
  open,
  onOpenChange,
  title,
  amount,
  summary,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  amount: number;
  summary: PaymentSummary[];
  onSubmit: () => Promise<PaymentResult>;
}) {
  const [stage, setStage] = React.useState<Stage>("review");
  const [reference, setReference] = React.useState("");
  const [cashbackAmount, setCashbackAmount] = React.useState<number | string | null>(null);
  const [error, setError] = React.useState("");
  const [pendingId, setPendingId] = React.useState<number | null>(null);
  const idempotencyRef = React.useRef<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setStage("review");
      setReference("");
      setCashbackAmount(null);
      setError("");
      setPendingId(null);
      idempotencyRef.current = null;
    }
    onOpenChange(next);
  };

  const handleTryAgain = () => {
    setStage("review");
    setError("");
    setPendingId(null);
  };

  // Poll order-status when pending (provider timeout via vending_handler:202)
  React.useEffect(() => {
    if (stage !== "pending" || pendingId == null) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 12;
    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const res = await buyApi.orderStatus(pendingId);
        const txn = res.data.transaction;
        if (txn.status === "SUCCESS") {
          if (!cancelled) {
            setReference(txn.provider_reference || `TXN-${txn.id}`);
            setStage("done");
            clearInterval(interval);
          }
        } else if (txn.status === "FAILED") {
          if (!cancelled) {
            setError("Provider could not complete the order — refund processed if debited.");
            setStage("error");
            clearInterval(interval);
          }
        }
      } catch {
        // ignore transient poll errors
      }
      if (attempts >= maxAttempts && !cancelled) {
        clearInterval(interval);
        setError("Order is still pending — check Transactions for updates.");
        setStage("error");
      }
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [stage, pendingId]);

  const handleConfirm = async () => {
    // Generate idempotency key once per confirmation attempt
    if (!idempotencyRef.current) {
      try {
        idempotencyRef.current = crypto.randomUUID();
      } catch {
        idempotencyRef.current = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      }
    }
    setStage("processing");
    try {
      const result = await onSubmit();
      if (result.ok) {
        if ((result as { pending?: boolean }).pending) {
          setPendingId(result.id);
          setReference(result.reference || `TXN-${result.id}`);
          setCashbackAmount(result.cashbackAmount ?? null);
          setStage("pending");
        } else {
          setReference(result.reference || `TXN-${result.id}`);
          setCashbackAmount(result.cashbackAmount ?? null);
          setStage("done");
        }
      } else {
        setError(result.error);
        setStage("error");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setStage("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={stage === "done" || stage === "pending" ? undefined : undefined}>
        {/* aria-live for status */}
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {stage === "processing" ? "Processing payment" : stage === "pending" ? "Payment pending, polling status" : stage === "done" ? "Transaction successful" : stage === "error" ? `Payment failed: ${error}` : "Review payment"}
        </span>
        {stage === "pending" ? (
          <div className="py-8 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-[var(--color-action)]" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">Processing your order</h2>
            <p className="mt-1 text-sm text-muted-foreground">Provider is confirming — this can take a few seconds. Don’t close this window.</p>
            <p className="mt-2 text-xs font-mono text-muted-foreground">{reference}</p>
            <Button variant="outline" size="lg" className="mt-6 w-full" onClick={() => handleOpenChange(false)}>
              Keep polling in background
            </Button>
          </div>
        ) : stage === "done" ? (
          <div className="py-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/12 text-success">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h2 className="mt-5 text-xl font-bold text-foreground">Transaction Successful</h2>
            <p className="mt-1 text-sm text-muted-foreground">{title}</p>
            <div className="mt-5 rounded-xl bg-muted p-4 text-left text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reference</span>
                <span className="font-medium text-foreground">{reference}</span>
              </div>
              {summary.map((s) => (
                <div key={s.label} className="mt-2 flex justify-between">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-medium text-foreground">{s.value}</span>
                </div>
              ))}
              <div className="mt-2 flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium text-foreground">
                  {new Date().toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </span>
              </div>
            </div>
            {(() => {
              const cb = Number(cashbackAmount);
              const hasCashback = !!cashbackAmount && !Number.isNaN(cb) && cb > 0;
              if (!hasCashback) return null;
              return (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                  <Gift className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                    You earned {formatNaira(cb)} cashback, credited to your wallet.
                  </p>
                </div>
              );
            })()}
            <Button
              variant="accent"
              size="lg"
              className="mt-6 w-full"
              onClick={() => handleOpenChange(false)}
            >
              Done
            </Button>
          </div>
        ) : stage === "error" ? (
          <div className="py-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/12 text-destructive">
              <XCircle className="h-9 w-9" />
            </div>
            <h2 className="mt-5 text-xl font-bold text-foreground">Payment failed</h2>
            <p className="mt-1 text-sm text-muted-foreground" role="alert" aria-live="assertive">{error}</p>
            <div className="mt-6 flex gap-2">
              <Button variant="outline" size="lg" className="flex-1" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button variant="accent" size="lg" className="flex-1" onClick={handleTryAgain}>
                Try again
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Confirm payment</DialogTitle>
              <DialogDescription>Review the details and confirm to pay.</DialogDescription>
            </DialogHeader>

            <div className="rounded-xl bg-muted p-4 text-sm">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-muted-foreground">Amount</span>
                <span className="text-lg font-bold text-foreground">{formatNaira(amount)}</span>
              </div>
              <div className="space-y-2 pt-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service</span>
                  <span className="font-medium text-foreground">{title}</span>
                </div>
                {summary.map((s) => (
                  <div key={s.label} className="flex justify-between">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="font-medium text-foreground">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleOpenChange(false)}
                disabled={stage === "processing"}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                variant="accent"
                size="lg"
                onClick={handleConfirm}
                loading={stage === "processing"}
                className="w-full sm:w-auto"
              >
                {stage === "processing" ? "Processing" : `Pay ${formatNaira(amount)}`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
