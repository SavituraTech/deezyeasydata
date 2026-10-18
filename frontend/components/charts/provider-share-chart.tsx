"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ProviderShare } from "@/types";

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
        <span className="text-muted-foreground">{item.value}%</span>
      </p>
    </div>
  );
}

export function ProviderShareChart({ data = [] }: { data?: ProviderShare[] }) {
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={52}
              outerRadius={84}
              paddingAngle={3}
              stroke="none"
            >
              {data.map((p) => (
                <Cell key={p.name} fill={p.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="w-full flex-1 space-y-2.5">
        {data.map((p) => (
          <li key={p.name} className="flex items-center gap-3 text-sm">
            <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
            <span className="flex-1 text-muted-foreground">{p.name}</span>
            <span className="font-medium text-foreground">{p.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
