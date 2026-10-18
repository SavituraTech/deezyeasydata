"use client";

import {
  Bar,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNaira } from "@/lib/utils";
import type { RevenuePoint } from "@/types";

interface TooltipEntry {
  dataKey: string;
  value: number;
  color: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}

const LABELS: Record<string, string> = {
  revenue: "Fee revenue",
  volume: "Volume processed",
};

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span>{LABELS[p.dataKey] ?? p.dataKey}:</span>
          <span className="font-medium text-foreground">{formatNaira(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function RevenueChart({ data = [] }: { data?: RevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 10, right: 8, left: -4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
        />
        <YAxis
          yAxisId="left"
          tickLine={false}
          axisLine={false}
          width={52}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
          tickFormatter={(v) => `₦${(v / 1_000_000).toFixed(0)}M`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickLine={false}
          axisLine={false}
          width={48}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
          tickFormatter={(v) => `₦${(v / 1_000_000).toFixed(1)}M`}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)", opacity: 0.4 }} />
        <Bar yAxisId="left" dataKey="volume" fill="#2A9D8F" radius={[6, 6, 0, 0]} maxBarSize={38} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="revenue"
          stroke="#F4B400"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#F4B400" }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
