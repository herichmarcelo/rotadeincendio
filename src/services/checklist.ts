import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChecklistItem, ChecklistResposta } from "@/types/database";

export async function listChecklistItens(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("checklist_itens").select("*").order("ordem");
  if (error) throw error;
  return (data ?? []) as ChecklistItem[];
}

export async function listRespostasPorAuditoria(supabase: SupabaseClient, auditoriaId: string) {
  const { data, error } = await supabase
    .from("checklist_respostas")
    .select("*")
    .eq("auditoria_id", auditoriaId);
  if (error) throw error;
  return (data ?? []) as ChecklistResposta[];
}

export async function upsertResposta(
  supabase: SupabaseClient,
  payload: {
    auditoria_id: string;
    item_id: string;
    conforme: boolean;
    nao_conforme: boolean;
    vezes_ocorridas: number;
    observacao: string | null;
    fotos: string[];
  }
) {
  const { data, error } = await supabase
    .from("checklist_respostas")
    .upsert(
      {
        auditoria_id: payload.auditoria_id,
        item_id: payload.item_id,
        conforme: payload.conforme,
        nao_conforme: payload.nao_conforme,
        vezes_ocorridas: payload.vezes_ocorridas,
        observacao: payload.observacao,
        fotos: payload.fotos,
      },
      { onConflict: "auditoria_id,item_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as ChecklistResposta;
}
