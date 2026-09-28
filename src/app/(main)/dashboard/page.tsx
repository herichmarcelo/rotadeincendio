import { CheckCircle2, ClipboardList, MapPin, AlertOctagon } from "lucide-react";
import { Suspense } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDashboardStats, getStatusDistribution } from "@/services/dashboard";
import { getAuditorForCurrentUser } from "@/services/auditores";
import { getRelatorioSemana } from "@/services/relatorio";
import { listUnidades } from "@/services/unidades";
import { getSessionAccess } from "@/lib/sessionAccess";
import { getLocalDateISO } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/StatCard";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { RelatorioOperacional } from "@/components/dashboard/RelatorioOperacional";
import { DashboardUnidadeFilter } from "@/components/dashboard/DashboardUnidadeFilter";
import { DashboardSemanaNav } from "@/components/dashboard/DashboardSemanaNav";
import { Card } from "@/components/ui/Card";

function isMissingTablesError(e: unknown): boolean {
  const msg =
    e instanceof Error
      ? e.message
      : typeof e === "object" && e !== null && "message" in e
        ? String((e as { message: unknown }).message)
        : JSON.stringify(e);
  return msg.includes("PGRST205") || msg.includes("Could not find the table");
}

function SchemaSetupHint() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
        <p className="text-sm text-zinc-400">Configure o banco no Supabase para ver os dados.</p>
      </div>
      <Card className="border-amber-500/30 bg-amber-950/20">
        <p className="text-sm font-semibold text-amber-100">Tabelas ainda não criadas (erro PGRST205)</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
          <li>
            Abra o{" "}
            <a
              href="https://supabase.com/dashboard/project/_/sql/new"
              className="text-fire-yellow underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              SQL Editor
            </a>{" "}
            do <strong>mesmo projeto</strong> da URL em{" "}
            <code className="rounded bg-zinc-900 px-1">NEXT_PUBLIC_SUPABASE_URL</code>.
          </li>
          <li>
            Cole e execute o arquivo{" "}
            <code className="rounded bg-zinc-900 px-1">supabase/schema.sql</code> do repositório (Run).
          </li>
          <li>Recarregue esta página.</li>
        </ol>
      </Card>
    </div>
  );
}

/** Retorna a segunda-feira da semana de `date` no formato YYYY-MM-DD */
function getMondayISO(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return getLocalDateISO(d);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const unidadeIdFilter =
    typeof params.unidadeId === "string" ? params.unidadeId : null;

  // Filtros de data: dataInicio + dataFim (customizado) ou semana única (legado / atalho)
  const dataInicioParam =
    typeof params.dataInicio === "string" ? params.dataInicio : null;
  const dataFimParam =
    typeof params.dataFim === "string" ? params.dataFim : null;
  const semanaParam =
    typeof params.semana === "string" ? params.semana : null;
  const semanaRef = semanaParam ?? getLocalDateISO();

  // Segunda-feira da semana atual (para comparar e desabilitar "próxima")
  const currentMonday = getMondayISO(new Date());

  let stats: Awaited<ReturnType<typeof getDashboardStats>>;
  let distribution: Awaited<ReturnType<typeof getStatusDistribution>>;
  let rotinaAuditor: {
    dia?: string | null;
    horario?: string | null;
    jaRealizadaHoje?: boolean;
  } | null = null;
  let relatorio: Awaited<ReturnType<typeof getRelatorioSemana>> = null;
  let unidades: Awaited<ReturnType<typeof listUnidades>> = [];
  let isSuperAdmin = false;

  try {
    const supabase = await createSupabaseServerClient();

    const [statsRes, distributionRes, auditor, access, unidadesRes] =
      await Promise.all([
        getDashboardStats(supabase),
        getStatusDistribution(supabase),
        getAuditorForCurrentUser(supabase),
        getSessionAccess(supabase),
        listUnidades(supabase),
      ]);

    stats = statsRes;
    distribution = distributionRes;
    unidades = unidadesRes;
    isSuperAdmin = access.isSuperAdmin;

    if (auditor?.dia_vistoria) {
      const hoje = getLocalDateISO();
      const { data: auditHoje } = await supabase
        .from("auditorias")
        .select("id")
        .eq("auditor_id", auditor.id)
        .eq("data_auditoria", hoje)
        .limit(1)
        .maybeSingle();

      rotinaAuditor = {
        dia: auditor.dia_vistoria,
        horario: auditor.horario_vistoria,
        jaRealizadaHoje: Boolean(auditHoje),
      };
    }

    // Relatório: usa o filtro de unidade ou a primeira unidade disponível
    const targetUnidadeId =
      unidadeIdFilter ?? (unidades.length > 0 ? unidades[0]!.id : null);

    if (targetUnidadeId) {
      relatorio = await getRelatorioSemana(
        supabase,
        targetUnidadeId,
        semanaRef,
        dataInicioParam ?? undefined,
        dataFimParam ?? undefined
      );
    }
  } catch (e) {
    if (isMissingTablesError(e)) {
      return <SchemaSetupHint />;
    }
    throw e;
  }

  // Verificar se o período exibido é a semana atual
  const isCustomRange = Boolean(dataInicioParam && dataFimParam);
  const isCurrentWeek =
    !isCustomRange &&
    (!semanaParam || getMondayISO(new Date(semanaRef + "T12:00:00")) === currentMonday);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
        <p className="text-sm text-zinc-400">Visão geral das auditorias e conformidade.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Auditorias realizadas"
          value={stats.totalRealizadas}
          icon={CheckCircle2}
          accent="success"
        />
        <StatCard title="Auditorias vencidas" value={stats.vencidas} icon={AlertOctagon} accent="warning" />
        <StatCard title="Locais avaliados" value={stats.locaisAvaliados} icon={MapPin} />
        <StatCard title="Não conformidades" value={stats.naoConformidades} icon={ClipboardList} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <DashboardCharts distribution={distribution} />
        </div>
        <div className="lg:col-span-2">
          <AlertsPanel vencidas={stats.vencidas} pendentes={stats.pendentes} rotina={rotinaAuditor} />
        </div>
      </div>

      {/* ── Relatório de Status Operacional ── */}
      {(isSuperAdmin || unidades.length > 0) && (
        <div className="space-y-3">
          {/* Controles: filtro de unidade + navegação de semana */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Filtro de unidade */}
            {unidades.length > 1 && (
              <Suspense>
                <DashboardUnidadeFilter
                  unidades={unidades}
                  currentUnidadeId={unidadeIdFilter ?? (unidades[0]?.id ?? null)}
                />
              </Suspense>
            )}

            {/* Navegação e filtro de período */}
            {relatorio && (
              <Suspense>
                <DashboardSemanaNav
                  semanaInicio={relatorio.semanaInicio}
                  semanaFim={relatorio.semanaFim}
                  isCurrentWeek={isCurrentWeek}
                  isCustomRange={relatorio.isCustomRange}
                />
              </Suspense>
            )}
          </div>

          {relatorio ? (
            <RelatorioOperacional relatorio={relatorio} />
          ) : (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 py-8 text-center">
              <p className="text-sm text-zinc-500">
                {unidades.length === 0
                  ? "Cadastre uma unidade para ver o relatório operacional."
                  : "Selecione uma unidade para ver o relatório."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
