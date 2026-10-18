"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Download, Share2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatNaira } from "@/lib/utils";

export interface SuccessDetail {
  label: string;
  value: string;
}

interface TransactionSuccessProps {
  title?: string;
  amount: number;
  reference: string;
  details: SuccessDetail[];
  onDone: () => void;
  doneLabel?: string;
}

export function TransactionSuccess({
  title = "Payment successful",
  amount,
  reference,
  details,
  onDone,
  doneLabel = "Make another payment",
}: TransactionSuccessProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex max-w-md flex-col items-center text-center"
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-success/12"
      >
        <CheckCircle2 className="h-11 w-11 text-success" />
      </motion.div>
      <h2 className="mt-5 text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-3xl font-bold text-foreground">{formatNaira(amount)}</p>

      <div className="mt-6 w-full rounded-2xl border border-border bg-muted/40 p-5 text-left">
        {details.map((d, i) => (
          <div key={d.label}>
            {i > 0 && <Separator className="my-3" />}
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">{d.label}</span>
              <span className="font-medium text-foreground">{d.value}</span>
            </div>
          </div>
        ))}
        <Separator className="my-3" />
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Reference</span>
          <span className="font-mono text-xs font-medium text-foreground">{reference}</span>
        </div>
      </div>

      <div className="mt-5 flex w-full gap-3">
        <Button variant="outline" size="md" className="flex-1">
          <Download className="h-4 w-4" /> Receipt
        </Button>
        <Button variant="outline" size="md" className="flex-1">
          <Share2 className="h-4 w-4" /> Share
        </Button>
      </div>

      <div className="mt-3 flex w-full flex-col gap-2">
        <Button variant="primary" size="md" onClick={onDone} className="w-full">
          {doneLabel}
        </Button>
        <Button variant="ghost" size="md" asChild className="w-full">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </motion.div>
  );
}
