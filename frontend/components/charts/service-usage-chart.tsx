"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNaira } from "@/lib/utils";
import type { ServiceUsage } from "@/types";

interface TooltipEntry {
  payload: { name: string; transactions: number; volume: number; color: string };
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 flex items-center gap-2 font-semibold text-foreground">
        <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
        {item.name}
      </p>
      <p className="text-muted-foreground">
        {item.transactions.toLocaleString()} transactions
      </p>
      <p className="text-muted-foreground">
        Volume: <span className="font-medium text-foreground">{formatNaira(item.volume)}</span>
      </p>
    </div>
  );
}

export function ServiceUsageChart({ data = [] }: { data?: ServiceUsage[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 12, left: 8, bottom: 4 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={72}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)", opacity: 0.4 }} />
        <Bar dataKey="transactions" radius={[0, 6, 6, 0]} maxBarSize={26}>
          {data.map((s) => (
            <Cell key={s.name} fill={s.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
