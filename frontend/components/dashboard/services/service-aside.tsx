import { Info, ShieldCheck, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatNaira } from "@/lib/utils";

export function ServiceAside({ tips, balance }: { tips: string[]; balance?: number }) {
  return (
    <>
      <Card className="bg-brand-gradient p-5 text-white">
        <p className="text-xs text-white/70">Available balance</p>
        <p className="mt-1 text-2xl font-bold">{balance !== undefined ? formatNaira(balance) : "—"}</p>
        <div className="mt-4 flex items-center gap-2 text-xs text-white/80">
          <Zap className="h-4 w-4" /> Instant delivery on all purchases
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-[var(--color-action)]" />
          <h3 className="font-semibold text-foreground">Good to know</h3>
        </div>
        <ul className="mt-3 space-y-2.5">
          {tips.map((tip) => (
            <li key={tip} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-action)]" />
              {tip}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--color-action)]" />
          Every payment is protected and auto-refunded if it fails.
        </div>
      </Card>
    </>
  );
}
