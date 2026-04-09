import type { SupabaseClient } from "@supabase/supabase-js";
import type { Auditoria, AuditoriaStatus } from "@/types/database";
import { getErrorMessage } from "@/lib/errors";

export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Define status inicial conforme a data escolhida. */
export function initialStatusForDate(dataAuditoria: string): AuditoriaStatus {
  return dataAuditoria < todayISODate() ? "vencida" : "pendente";
}

/** Marca auditorias pendentes com data passada como vencidas. */
export async function syncAuditoriaStatuses(supabase: SupabaseClient): Promise<void> {
  const today = todayISODate();
  await supabase
    .from("auditorias")
    .update({ status: "vencida" as AuditoriaStatus })
    .eq("status", "pendente")
    .lt("data_auditoria", today);

  // Regra de vencimento por tempo: 6h após `aberta_em`.
  // (Se o projeto ainda não tiver a coluna, o PostgREST vai retornar erro; nesse caso,
  // o fluxo principal continua funcionando com a regra por data.)
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  await supabase
    .from("auditorias")
    .update({ status: "vencida" as AuditoriaStatus })
    .eq("status", "pendente")
    .lt("aberta_em", sixHoursAgo);
}

export async function listAuditorias(
  supabase: SupabaseClient,
  filters?: { unidadeId?: string; setorId?: string }
) {
  await syncAuditoriaStatuses(supabase);
  let q = supabase
    .from("auditorias")
    .select(
      `
      *,
      unidade:unidades(nome),
      setor:setores(nome),
      auditor:auditores(nome, email)
    `
    )
    .order("data_auditoria", { ascending: false });

  if (filters?.unidadeId) q = q.eq("unidade_id", filters.unidadeId);
  if (filters?.setorId) q = q.eq("setor_id", filters.setorId);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getAuditoria(supabase: SupabaseClient, id: string) {
  await syncAuditoriaStatuses(supabase);
  const { data, error } = await supabase
    .from("auditorias")
    .select(
      `
      *,
      unidade:unidades(nome),
      setor:setores(nome),
      auditor:auditores(nome, email)
    `
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Auditoria & {
    unidade: { nome: string } | null;
    setor: { nome: string } | null;
    auditor: { nome: string; email: string } | null;
  };
}

export async function createAuditoria(
  supabase: SupabaseClient,
  row: Omit<Auditoria, "id" | "created_at">
) {
  const { data, error } = await supabase.from("auditorias").insert(row).select().single();
  if (error) throw new Error(getErrorMessage(error, "Erro ao criar auditoria"));
  return data;
}

export async function updateAuditoria(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<
    Pick<
      Auditoria,
      | "status"
      | "data_auditoria"
      | "horario_abertura"
      | "aberta_em"
      | "concluida_em"
      | "parecer_atraso"
      | "parecer_atraso_em"
      | "parecer_atraso_auditor_id"
      | "unidade_id"
      | "setor_id"
      | "auditor_id"
    >
  >
) {
  const { data, error } = await supabase.from("auditorias").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteAuditoria(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("auditorias").delete().eq("id", id);
  if (error) throw error;
}
