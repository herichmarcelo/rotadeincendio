"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StatusDistribution } from "@/services/dashboard";
import { Card } from "@/components/ui/Card";

const labels: Record<keyof StatusDistribution, string> = {
  pendente: "Pendentes",
  concluida: "Concluídas",
  vencida: "Vencidas",
};

export function DashboardCharts({ distribution }: { distribution: StatusDistribution }) {
  const data = (Object.keys(distribution) as (keyof StatusDistribution)[]).map((k) => ({
    name: labels[k],
    key: k,
    total: distribution[k],
  }));

  return (
    <Card className="h-[280px]">
      <h3 className="mb-4 text-sm font-semibold text-zinc-200">Auditorias por status</h3>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: "rgba(183, 28, 28, 0.08)" }}
              contentStyle={{
                backgroundColor: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: "12px",
                fontSize: 12,
              }}
              labelStyle={{ color: "#e4e4e7" }}
            />
            <Bar dataKey="total" fill="#B71C1C" radius={[6, 6, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
