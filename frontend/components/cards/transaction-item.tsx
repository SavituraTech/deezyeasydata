import {
  Smartphone,
  Wifi,
  Zap,
  Tv,
  GraduationCap,
  ArrowDownLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Transaction, TransactionStatus, TransactionType } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateTime, formatNaira } from "@/lib/utils";

const TYPE_ICON: Record<TransactionType, LucideIcon> = {
  airtime: Smartphone,
  data: Wifi,
  broadband: Wifi,
  electricity: Zap,
  cable: Tv,
  education: GraduationCap,
  "wallet-funding": ArrowDownLeft,
};

const STATUS_VARIANT: Record<TransactionStatus, "success" | "warning" | "destructive"> = {
  success: "success",
  pending: "warning",
  failed: "destructive",
};

export function StatusBadge({ status }: { status: TransactionStatus }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <Badge variant={STATUS_VARIANT[status]}>{label}</Badge>;
}

export function TransactionItem({
  tx,
  onClick,
}: {
  tx: Transaction;
  onClick?: (tx: Transaction) => void;
}) {
  const Icon = TYPE_ICON[tx.type];
  const isCredit = tx.direction === "in";

  return (
    <button
      type="button"
      onClick={() => onClick?.(tx)}
      className="flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left transition-colors hover:bg-muted"
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
          isCredit ? "bg-success/12 text-success" : "bg-muted text-foreground"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{tx.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {tx.description} · {formatDateTime(tx.date)}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1">
        <span
          className={cn(
            "whitespace-nowrap text-sm font-semibold",
            isCredit ? "text-success" : "text-foreground"
          )}
        >
          {isCredit ? "+" : "-"}
          {formatNaira(tx.amount)}
        </span>
        <StatusBadge status={tx.status} />
      </div>
    </button>
  );
}
