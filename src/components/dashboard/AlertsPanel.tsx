import { AlertTriangle, Route } from "lucide-react";
import { Card } from "@/components/ui/Card";

type Props = {
  vencidas: number;
  pendentes: number;
};

export function AlertsPanel({ vencidas, pendentes }: Props) {
  const items = [
    {
      title: "Auditorias vencidas",
      value: vencidas,
      icon: AlertTriangle,
      tone: vencidas > 0 ? "text-amber-300" : "text-zinc-500",
    },
    {
      title: "Rotas pendentes",
      value: pendentes,
      icon: Route,
      tone: pendentes > 0 ? "text-fire-yellow" : "text-zinc-500",
    },
  ];

  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-zinc-200">Alertas</h3>
      <ul className="space-y-3">
        {items.map(({ title, value, icon: Icon, tone }) => (
          <li
            key={title}
            className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-3 py-2.5"
          >
            <span className="flex items-center gap-2 text-sm text-zinc-300">
              <Icon className={`h-4 w-4 ${tone}`} />
              {title}
            </span>
            <span className="text-lg font-semibold tabular-nums text-zinc-100">{value}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
