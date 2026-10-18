"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { clientFetch } from "@/lib/api";
import type { ApiTransaction } from "@/lib/api";
import { formatNaira } from "@/lib/utils";

type Status = "verifying" | "success" | "failed";

export default function DepositVerifyPage() {
  const [status, setStatus] = React.useState<Status>("verifying");
  const [transaction, setTransaction] = React.useState<ApiTransaction | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 15;

    const verify = async () => {
      while (!cancelled && attempts < maxAttempts) {
        attempts++;
        try {
          const txn = await clientFetch<ApiTransaction>("/api/wallets/");
          if (!cancelled) {
            setTransaction(txn);
            if (txn.status === "SUCCESS") {
              setStatus("success");
            } else if (txn.status === "FAILED") {
              setStatus("failed");
            } else {
              await new Promise((r) => setTimeout(r, 2000));
              continue;
            }
          }
        } catch {
          if (!cancelled) {
            setStatus("failed");
          }
        }
        return;
      }
      if (!cancelled) {
        setStatus("failed");
      }
    };

    verify();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md p-8 text-center">
        {status === "verifying" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-action-subtle)] text-[var(--color-action)]">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <h1 className="mt-6 text-xl font-bold text-foreground">Verifying deposit</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Please wait while we confirm your payment. This may take a moment.
            </p>
          </>
        )}

        {status === "success" && transaction && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/12 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="mt-6 text-xl font-bold text-foreground">Deposit confirmed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your wallet has been credited with{" "}
              <span className="font-semibold text-foreground">{formatNaira(Number(transaction.amount))}</span>.
            </p>
            <div className="mt-4 rounded-xl bg-muted p-4 text-left text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium text-foreground">{formatNaira(Number(transaction.amount))}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-foreground">{transaction.status}</span>
              </div>
            </div>
            <Button variant="accent" size="lg" asChild className="mt-6 w-full">
              <Link href="/dashboard/wallet">Back to wallet</Link>
            </Button>
          </>
        )}

        {status === "failed" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/12 text-destructive">
              <XCircle className="h-8 w-8" />
            </div>
            <h1 className="mt-6 text-xl font-bold text-foreground">Deposit failed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We couldn&apos;t verify your deposit. If you were charged, please contact support.
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" size="lg" asChild className="flex-1">
                <Link href="/dashboard/wallet">Back to wallet</Link>
              </Button>
              <Button variant="accent" size="lg" asChild className="flex-1">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
