import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle, PlusCircle, Route } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getDiaSemanaAtual } from "@/lib/utils";

type Props = {
  vencidas: number;
  pendentes: number;
  rotina?: {
    dia?: string | null;
    horario?: string | null;
    jaRealizadaHoje?: boolean;
  } | null;
};

export function AlertsPanel({ vencidas, pendentes, rotina }: Props) {
  const diaSemanaAtual = getDiaSemanaAtual();
  const isDiaDeRotina = Boolean(
    rotina?.dia && rotina.dia.toLowerCase().trim() === diaSemanaAtual.toLowerCase().trim()
  );

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
    <Card className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-200">Alertas & Escala</h3>
      </div>

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

      {rotina?.dia && (
        <div
          className={`rounded-xl border p-3.5 text-xs transition-colors ${
            isDiaDeRotina
              ? rotina.jaRealizadaHoje
                ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                : "border-fire-yellow/40 bg-fire-yellow/10 text-fire-yellow"
              : "border-zinc-800 bg-zinc-950/40 text-zinc-400"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {isDiaDeRotina && rotina.jaRealizadaHoje ? (
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div className="flex-1 space-y-1">
              <p className="font-semibold text-white">
                {isDiaDeRotina
                  ? rotina.jaRealizadaHoje
                    ? "Vistoria de hoje concluída / aberta"
                    : "Hoje é o seu dia de vistoria!"
                  : "Rotina Semanal Programada"}
              </p>
              <p>
                {isDiaDeRotina
                  ? rotina.jaRealizadaHoje
                    ? `A auditoria programada para ${rotina.dia} às ${rotina.horario || "16:00"} já foi iniciada hoje.`
                    : `Sua rota programada é hoje (${rotina.dia}) às ${rotina.horario || "16:00"}.`
                  : `Toda ${rotina.dia} às ${rotina.horario || "16:00"}.`}
              </p>
              {isDiaDeRotina && !rotina.jaRealizadaHoje && (
                <div className="pt-2">
                  <Link
                    href="/auditorias/nova"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-fire-red px-3 py-1.5 text-xs font-semibold text-white hover:bg-fire-red/90"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Iniciar vistoria agora
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
