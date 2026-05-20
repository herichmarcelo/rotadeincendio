import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuditorForCurrentUser } from "@/services/auditores";

export type SessionAccess = {
  /** Super admin (Auth `app_metadata.role` ou `auditores.perfil`). */
  isSuperAdmin: boolean;
  /** ID em `public.auditores` do usuário logado. */
  auditorId: string | null;
};

export async function getSessionAccess(supabase: SupabaseClient): Promise<SessionAccess> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { isSuperAdmin: false, auditorId: null };
  }

  const auditor = await getAuditorForCurrentUser(supabase);
  const isSuperAdmin =
    user.app_metadata?.role === "super_admin" || auditor?.perfil === "super_admin";

  return {
    isSuperAdmin,
    auditorId: auditor?.id ?? null,
  };
}

/** Auditor pode ver/editar esta auditoria? */
export function canAccessAuditoria(
  access: SessionAccess,
  auditoria: { auditor_id: string }
): boolean {
  if (access.isSuperAdmin) return true;
  if (!access.auditorId) return false;
  return auditoria.auditor_id === access.auditorId;
}

export class AuditoriaAccessError extends Error {
  constructor(message = "Você não tem permissão para acessar esta auditoria.") {
    super(message);
    this.name = "AuditoriaAccessError";
  }
}

export async function assertCanAccessAuditoria(
  supabase: SupabaseClient,
  auditoriaId: string
): Promise<SessionAccess> {
  const access = await getSessionAccess(supabase);
  if (access.isSuperAdmin) return access;

  const { data, error } = await supabase
    .from("auditorias")
    .select("auditor_id")
    .eq("id", auditoriaId)
    .maybeSingle();

  if (error) throw error;
  if (!data || !canAccessAuditoria(access, data)) {
    throw new AuditoriaAccessError();
  }
  return access;
}
