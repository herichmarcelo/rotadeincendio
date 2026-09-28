import { CheckCircle2, XCircle, MinusCircle, Flame, Key, Cpu } from "lucide-react";
import { formatDateBR } from "@/lib/utils";
import type { RelatorioSemana, StatusVisita } from "@/services/relatorio";
import { ExportarRelatorioBtn } from "./ExportarRelatorioBtn";

// ─── Ícone por setor ──────────────────────────────────────────────────────────
const SETOR_ICONS: Record<string, React.ElementType> = {
  caldeira: Flame,
  "sala de máquina": Cpu,
  "sala de maquina": Cpu,
  portaria: Key,
};
function getSetorIcon(nome: string): React.ElementType {
  const k = nome.toLowerCase().trim();
  for (const [p, I] of Object.entries(SETOR_ICONS)) if (k.includes(p)) return I;
  return Flame;
}

// ─── Cores de linha por status ────────────────────────────────────────────────
type RowStyle = { bg: string; text: string; border: string };

function rowStyle(status: StatusVisita): RowStyle {
  if (status === "concluida")
    return { bg: "bg-emerald-500/15", text: "text-emerald-200", border: "border-emerald-500/20" };
  if (status === "vencida")
    return { bg: "bg-red-500/20", text: "text-red-200", border: "border-red-500/20" };
  return { bg: "bg-zinc-800/40", text: "text-zinc-400", border: "border-zinc-700/50" };
}

// ─── Ícone de status (Lucide) ─────────────────────────────────────────────────
function StatusIcon({ status }: { status: StatusVisita }) {
  if (status === "concluida")
    return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
  if (status === "vencida")
    return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
  return <MinusCircle className="h-4 w-4 text-zinc-600 shrink-0" />;
}

// ─── Barra de progresso ───────────────────────────────────────────────────────
function ProgressBar({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="px-3 pt-2.5 pb-3 border-t border-zinc-700/60 bg-zinc-900/60">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500">
          Frigorífico em Funcionamento
        </span>
        <span className={`text-xs font-bold tabular-nums ${pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400"}`}>
          {pct}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Cabeçalho da tabela ──────────────────────────────────────────────────────
function TableHeader({
  setorNome,
  semanaInicio,
  semanaFim,
}: {
  setorNome: string;
  semanaInicio: string;
  semanaFim: string;
}) {
  const Icon = getSetorIcon(setorNome);

  const semLabel = (() => {
    const m = semanaInicio.match(/\d{4}-(\d{2})-(\d{2})/);
    const m2 = semanaFim.match(/\d{4}-(\d{2})-(\d{2})/);
    if (m && m2) return `${m[2]}/${m[1]} – ${m2[2]}/${m2[1]}`;
    return "";
  })();

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-zinc-700/60 bg-zinc-800/80">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-700">
        <Icon className="h-3.5 w-3.5 text-fire-red" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-100 leading-tight truncate">
          {setorNome}
        </p>
        <p className="text-[9px] text-zinc-400 mt-0.5 font-medium">Período: {semLabel}</p>
      </div>
      {/* Rótulos de coluna */}
      <div className="flex items-center gap-6 text-[9px] font-semibold uppercase tracking-wider text-zinc-500 shrink-0">
        <span>Data</span>
        <span className="w-5 text-center">✓</span>
      </div>
    </div>
  );
}

// ─── Card de setor ────────────────────────────────────────────────────────────
function SetorCard({
  setorNome,
  visitas,
  percentualConcluido,
  semanaInicio,
  semanaFim,
}: {
  setorNome: string;
  visitas: RelatorioSemana["setores"][number]["visitas"];
  percentualConcluido: number;
  semanaInicio: string;
  semanaFim: string;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden shadow-lg">
      <TableHeader
        setorNome={setorNome}
        semanaInicio={semanaInicio}
        semanaFim={semanaFim}
      />

      {/* Linhas de visita */}
      <div className="flex-1 divide-y divide-zinc-800/60">
        {visitas.length === 0 ? (
          <div className="flex items-center justify-center py-7">
            <p className="text-xs italic text-zinc-600">Nenhuma auditoria neste período</p>
          </div>
        ) : (
          visitas.map((v, i) => {
            const s = rowStyle(v.status);
            return (
              <div
                key={v.auditoriaId ?? `${v.data}-${i}`}
                className={`grid grid-cols-[56px_1fr_32px] items-center gap-0 border-l-2 ${s.bg} ${s.border}`}
              >
                {/* Horário */}
                <span className={`px-3 py-2 text-[11px] font-bold tabular-nums border-r border-zinc-700/40 ${s.text}`}>
                  {v.horario ?? "—"}
                </span>
                {/* Data */}
                <span className={`px-3 py-2 text-[11px] tabular-nums ${s.text}`}>
                  {formatDateBR(v.data)}
                </span>
                {/* Ícone de status */}
                <div className="flex justify-center pr-1">
                  <StatusIcon status={v.status} />
                </div>
              </div>
            );
          })
        )}
      </div>

      <ProgressBar pct={percentualConcluido} />
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
interface Props {
  relatorio: RelatorioSemana;
}

export function RelatorioOperacional({ relatorio }: Props) {
  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fire-red/20 border border-fire-red/30">
            <Flame className="h-4 w-4 text-fire-red" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white leading-none">
              Relatório de Status Operacional
            </h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {relatorio.unidadeNome}
            </p>
          </div>
        </div>
        <ExportarRelatorioBtn relatorio={relatorio} />
      </div>

      {/* Cards */}
      {relatorio.setores.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 py-10 text-center">
          <p className="text-sm text-zinc-500">Nenhum setor cadastrado para esta unidade.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {relatorio.setores.map((s) => (
            <SetorCard
              key={s.setorId}
              setorNome={s.setorNome}
              visitas={s.visitas}
              percentualConcluido={s.percentualConcluido}
              semanaInicio={relatorio.semanaInicio}
              semanaFim={relatorio.semanaFim}
            />
          ))}
        </div>
      )}
    </div>
  );
}
