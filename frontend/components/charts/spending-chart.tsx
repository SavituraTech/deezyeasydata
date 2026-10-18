"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNaira } from "@/lib/utils";
import type { SpendingPoint } from "@/types";

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

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="capitalize">{p.dataKey}:</span>
          <span className="font-medium text-foreground">{formatNaira(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function SpendingChart({ data = [] }: { data?: SpendingPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="fundingFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2A9D8F" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#2A9D8F" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="spendingFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#F4B400" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#F4B400" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
          tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="funding"
          stroke="#2A9D8F"
          strokeWidth={2.5}
          fill="url(#fundingFill)"
        />
        <Area
          type="monotone"
          dataKey="spending"
          stroke="#F4B400"
          strokeWidth={2.5}
          fill="url(#spendingFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
