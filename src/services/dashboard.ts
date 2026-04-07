import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditoriaStatus, DashboardStats } from "@/types/database";
import { syncAuditoriaStatuses } from "./auditorias";

export type StatusDistribution = Record<AuditoriaStatus, number>;

export async function getStatusDistribution(supabase: SupabaseClient): Promise<StatusDistribution> {
  await syncAuditoriaStatuses(supabase);
  const { data, error } = await supabase.from("auditorias").select("status");
  if (error) throw error;
  const map: StatusDistribution = { pendente: 0, concluida: 0, vencida: 0 };
  for (const row of data ?? []) {
    const s = row.status as AuditoriaStatus;
    if (s in map) map[s]++;
  }
  return map;
}

export async function getDashboardStats(supabase: SupabaseClient): Promise<DashboardStats> {
  await syncAuditoriaStatuses(supabase);

  const [
    realizadas,
    vencidas,
    pendentes,
    locais,
    naoConf,
  ] = await Promise.all([
    supabase.from("auditorias").select("id", { count: "exact", head: true }).eq("status", "concluida"),
    supabase.from("auditorias").select("id", { count: "exact", head: true }).eq("status", "vencida"),
    supabase.from("auditorias").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    supabase.from("auditorias").select("unidade_id", { count: "exact", head: false }),
    supabase.from("checklist_respostas").select("id", { count: "exact", head: true }).eq("nao_conforme", true),
  ]);

  const unidades = new Set((locais.data ?? []).map((r: { unidade_id: string }) => r.unidade_id));

  return {
    totalRealizadas: realizadas.count ?? 0,
    vencidas: vencidas.count ?? 0,
    locaisAvaliados: unidades.size,
    naoConformidades: naoConf.count ?? 0,
    pendentes: pendentes.count ?? 0,
  };
}
