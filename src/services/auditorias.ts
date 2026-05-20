import type { SupabaseClient } from "@supabase/supabase-js";
import type { Auditoria, AuditoriaStatus } from "@/types/database";
import { getErrorMessage } from "@/lib/errors";
import {
  assertCanAccessAuditoria,
  AuditoriaAccessError,
  canAccessAuditoria,
  getSessionAccess,
} from "@/lib/sessionAccess";

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
  const access = await getSessionAccess(supabase);

  if (!access.isSuperAdmin && !access.auditorId) {
    return [];
  }

  let q = supabase
    .from("auditorias")
    .select(
      `
      *,
      unidade:unidades(nome),
      setor:setores(nome),
      auditor:auditores!auditorias_auditor_id_fkey(nome, email),
      parecer_auditor:auditores!auditorias_parecer_atraso_auditor_id_fkey(nome, email)
    `
    )
    .order("data_auditoria", { ascending: false });

  if (!access.isSuperAdmin && access.auditorId) {
    q = q.eq("auditor_id", access.auditorId);
  }

  if (filters?.unidadeId) q = q.eq("unidade_id", filters.unidadeId);
  if (filters?.setorId) q = q.eq("setor_id", filters.setorId);

  const { data, error } = await q;
  if (error) throw new Error(getErrorMessage(error, "Erro ao carregar auditorias"));
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
      auditor:auditores!auditorias_auditor_id_fkey(nome, email),
      parecer_auditor:auditores!auditorias_parecer_atraso_auditor_id_fkey(nome, email)
    `
    )
    .eq("id", id)
    .single();
  if (error) throw new Error(getErrorMessage(error, "Erro ao carregar auditoria"));

  const access = await getSessionAccess(supabase);
  if (!canAccessAuditoria(access, data as { auditor_id: string })) {
    throw new AuditoriaAccessError();
  }

  return data as Auditoria & {
    unidade: { nome: string } | null;
    setor: { nome: string } | null;
    auditor: { nome: string; email: string } | null;
    parecer_auditor: { nome: string; email: string } | null;
  };
}

export async function createAuditoria(
  supabase: SupabaseClient,
  row: Omit<Auditoria, "id" | "created_at">
) {
  const access = await getSessionAccess(supabase);
  if (!access.isSuperAdmin) {
    if (!access.auditorId || row.auditor_id !== access.auditorId) {
      throw new AuditoriaAccessError("Você só pode criar auditorias em seu próprio nome.");
    }
  }

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
  await assertCanAccessAuditoria(supabase, id);
  const { data, error } = await supabase.from("auditorias").update(patch).eq("id", id).select().single();
  if (error) throw new Error(getErrorMessage(error, "Erro ao atualizar auditoria"));
  return data;
}

export async function deleteAuditoria(supabase: SupabaseClient, id: string) {
  await assertCanAccessAuditoria(supabase, id);
  const { error } = await supabase.from("auditorias").delete().eq("id", id);
  if (error) throw new Error(getErrorMessage(error, "Erro ao excluir auditoria"));
}
