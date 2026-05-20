import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditoriaStatus, DashboardStats } from "@/types/database";
import { getSessionAccess } from "@/lib/sessionAccess";
import { syncAuditoriaStatuses } from "./auditorias";

export type StatusDistribution = Record<AuditoriaStatus, number>;

async function auditoriaIdsForScope(
  supabase: SupabaseClient,
  auditorId: string
): Promise<string[]> {
  const { data, error } = await supabase.from("auditorias").select("id").eq("auditor_id", auditorId);
  if (error) throw error;
  return (data ?? []).map((r) => r.id);
}

export async function getStatusDistribution(supabase: SupabaseClient): Promise<StatusDistribution> {
  await syncAuditoriaStatuses(supabase);
  const access = await getSessionAccess(supabase);

  let q = supabase.from("auditorias").select("status");
  if (!access.isSuperAdmin && access.auditorId) {
    q = q.eq("auditor_id", access.auditorId);
  } else if (!access.isSuperAdmin) {
    return { pendente: 0, concluida: 0, vencida: 0 };
  }

  const { data, error } = await q;
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
  const access = await getSessionAccess(supabase);

  if (!access.isSuperAdmin && !access.auditorId) {
    return {
      totalRealizadas: 0,
      vencidas: 0,
      locaisAvaliados: 0,
      naoConformidades: 0,
      pendentes: 0,
    };
  }

  let realizadasQ = supabase
    .from("auditorias")
    .select("id", { count: "exact", head: true })
    .eq("status", "concluida");
  let vencidasQ = supabase
    .from("auditorias")
    .select("id", { count: "exact", head: true })
    .eq("status", "vencida");
  let pendentesQ = supabase
    .from("auditorias")
    .select("id", { count: "exact", head: true })
    .eq("status", "pendente");
  let locaisQ = supabase.from("auditorias").select("unidade_id", { count: "exact", head: false });

  if (!access.isSuperAdmin && access.auditorId) {
    realizadasQ = realizadasQ.eq("auditor_id", access.auditorId);
    vencidasQ = vencidasQ.eq("auditor_id", access.auditorId);
    pendentesQ = pendentesQ.eq("auditor_id", access.auditorId);
    locaisQ = locaisQ.eq("auditor_id", access.auditorId);
  }

  const [realizadas, vencidas, pendentes, locais] = await Promise.all([
    realizadasQ,
    vencidasQ,
    pendentesQ,
    locaisQ,
  ]);

  let naoConfCount = 0;
  if (access.isSuperAdmin) {
    const naoConf = await supabase
      .from("checklist_respostas")
      .select("id", { count: "exact", head: true })
      .eq("nao_conforme", true);
    if (naoConf.error) throw naoConf.error;
    naoConfCount = naoConf.count ?? 0;
  } else if (access.auditorId) {
    const ids = await auditoriaIdsForScope(supabase, access.auditorId);
    if (ids.length > 0) {
      const naoConf = await supabase
        .from("checklist_respostas")
        .select("id", { count: "exact", head: true })
        .eq("nao_conforme", true)
        .in("auditoria_id", ids);
      if (naoConf.error) throw naoConf.error;
      naoConfCount = naoConf.count ?? 0;
    }
  }

  const unidades = new Set((locais.data ?? []).map((r: { unidade_id: string }) => r.unidade_id));

  return {
    totalRealizadas: realizadas.count ?? 0,
    vencidas: vencidas.count ?? 0,
    locaisAvaliados: unidades.size,
    naoConformidades: naoConfCount,
    pendentes: pendentes.count ?? 0,
  };
}
