"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatNaira } from "@/lib/utils";
import type { ExpenseSlice } from "@/types";

interface TooltipEntry {
  name: string;
  value: number;
  payload: { color: string };
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: item.payload.color }} />
        <span className="font-medium text-foreground">{item.name}</span>
        <span className="text-muted-foreground">{formatNaira(item.value)}</span>
      </p>
    </div>
  );
}

export function ExpenseChart({ data = [] }: { data?: ExpenseSlice[] }) {
  const total = data.reduce((sum, e) => sum + e.value, 0);

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={88}
              paddingAngle={3}
              stroke="none"
            >
              {data.map((e) => (
                <Cell key={e.name} fill={e.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-lg font-bold text-foreground">{formatNaira(total, { compact: true })}</span>
        </div>
      </div>

      <ul className="w-full flex-1 space-y-3">
        {data.map((e) => (
          <li key={e.name} className="flex items-center gap-3 text-sm">
            <span className="h-3 w-3 rounded-full" style={{ background: e.color }} />
            <span className="flex-1 text-muted-foreground">{e.name}</span>
            <span className="font-medium text-foreground">{formatNaira(e.value)}</span>
            {total > 0 && (
              <span className="w-10 text-right text-xs text-muted-foreground">
                {Math.round((e.value / total) * 100)}%
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
