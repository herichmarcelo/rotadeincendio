import { CheckCircle2, ClipboardList, MapPin, AlertOctagon } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDashboardStats, getStatusDistribution } from "@/services/dashboard";
import { StatCard } from "@/components/dashboard/StatCard";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
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
            do <strong>mesmo projeto</strong> da URL em <code className="rounded bg-zinc-900 px-1">NEXT_PUBLIC_SUPABASE_URL</code>.
          </li>
          <li>
            Cole e execute o arquivo <code className="rounded bg-zinc-900 px-1">supabase/schema.sql</code> do repositório (Run).
          </li>
          <li>Recarregue esta página.</li>
        </ol>
      </Card>
    </div>
  );
}

export default async function DashboardPage() {
  let stats: Awaited<ReturnType<typeof getDashboardStats>>;
  let distribution: Awaited<ReturnType<typeof getStatusDistribution>>;

  try {
    const supabase = await createSupabaseServerClient();
    [stats, distribution] = await Promise.all([
      getDashboardStats(supabase),
      getStatusDistribution(supabase),
    ]);
  } catch (e) {
    if (isMissingTablesError(e)) {
      return <SchemaSetupHint />;
    }
    throw e;
  }

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
        <StatCard
          title="Não conformidades"
          value={stats.naoConformidades}
          icon={ClipboardList}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <DashboardCharts distribution={distribution} />
        </div>
        <div className="lg:col-span-2">
          <AlertsPanel vencidas={stats.vencidas} pendentes={stats.pendentes} />
        </div>
      </div>
    </div>
  );
}
