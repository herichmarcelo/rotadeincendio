/**
 * Exemplos de uso do Supabase JS (CRUD) — copie e adapte nas páginas ou services.
 * Execute o SQL em `supabase/schema.sql` antes de usar.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function exemploSelectAuditores(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("auditores").select("*").order("nome");
  return { data, error };
}

export async function exemploInsertAuditor(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("auditores")
    .insert({ nome: "Nome", email: "email@exemplo.com" })
    .select()
    .single();
  return { data, error };
}

export async function exemploUpdateAuditoria(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("auditorias")
    .update({ status: "concluida" })
    .eq("id", id)
    .select()
    .single();
  return { data, error };
}

export async function exemploDeleteSetor(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("setores").delete().eq("id", id);
  return { error };
}

export async function exemploJoinAuditorias(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("auditorias").select(`
      *,
      unidade:unidades(nome),
      setor:setores(nome),
      auditor:auditores(nome)
    `);
  return { data, error };
}

export async function exemploFiltroStatus(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("auditorias")
    .select("id, status, data_auditoria")
    .eq("status", "vencida");
  return { data, error };
}
