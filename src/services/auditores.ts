import type { SupabaseClient } from "@supabase/supabase-js";
import type { Auditor } from "@/types/database";

export async function listAuditores(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("auditores").select("*").order("nome");
  if (error) throw error;
  return (data ?? []) as Auditor[];
}

/** Perfil do usuário logado na tabela auditores (por user_id ou e-mail). */
export async function getAuditorForCurrentUser(supabase: SupabaseClient): Promise<Auditor | null> {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return null;

  if (user.id) {
    const { data, error } = await supabase.from("auditores").select("*").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (data) return data as Auditor;
  }

  const email = user.email?.toLowerCase();
  if (email) {
    const { data, error } = await supabase.from("auditores").select("*").eq("email", email).maybeSingle();
    if (error) throw error;
    if (data) return data as Auditor;
  }

  return null;
}

export async function createAuditor(supabase: SupabaseClient, row: Pick<Auditor, "nome" | "email">) {
  const { data, error } = await supabase.from("auditores").insert(row).select().single();
  if (error) throw error;
  return data as Auditor;
}

export async function updateAuditor(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Pick<Auditor, "nome" | "email">>
) {
  const { data, error } = await supabase.from("auditores").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as Auditor;
}

export async function deleteAuditor(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("auditores").delete().eq("id", id);
  if (error) throw error;
}
