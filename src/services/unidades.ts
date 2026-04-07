import type { SupabaseClient } from "@supabase/supabase-js";
import type { Setor, Unidade } from "@/types/database";

export async function listUnidades(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("unidades").select("*").order("nome");
  if (error) throw error;
  return (data ?? []) as Unidade[];
}

export async function createUnidade(supabase: SupabaseClient, nome: string) {
  const { data, error } = await supabase.from("unidades").insert({ nome }).select().single();
  if (error) throw error;
  return data as Unidade;
}

export async function updateUnidade(supabase: SupabaseClient, id: string, nome: string) {
  const { data, error } = await supabase.from("unidades").update({ nome }).eq("id", id).select().single();
  if (error) throw error;
  return data as Unidade;
}

export async function deleteUnidade(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("unidades").delete().eq("id", id);
  if (error) throw error;
}

export async function listSetores(supabase: SupabaseClient, unidadeId?: string) {
  let q = supabase.from("setores").select("*").order("nome");
  if (unidadeId) q = q.eq("unidade_id", unidadeId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Setor[];
}

export async function createSetor(supabase: SupabaseClient, unidade_id: string, nome: string) {
  const { data, error } = await supabase.from("setores").insert({ unidade_id, nome }).select().single();
  if (error) throw error;
  return data as Setor;
}

export async function updateSetor(supabase: SupabaseClient, id: string, nome: string) {
  const { data, error } = await supabase.from("setores").update({ nome }).eq("id", id).select().single();
  if (error) throw error;
  return data as Setor;
}

export async function deleteSetor(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("setores").delete().eq("id", id);
  if (error) throw error;
}
