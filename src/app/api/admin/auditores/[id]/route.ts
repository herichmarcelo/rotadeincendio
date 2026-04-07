import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";

function parseAllowedEmails() {
  // Bootstrap opcional (fallback). Preferimos role no Auth (`app_metadata.role`).
  const raw = process.env.SUPER_ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isSuperAdmin(user: { app_metadata?: Record<string, unknown>; email?: string | null }) {
  return user.app_metadata?.role === "super_admin";
}

async function assertSuperAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    return { ok: false as const, status: 401, message: "Não autenticado." };
  }

  if (isSuperAdmin(user)) return { ok: true as const };

  const allow = parseAllowedEmails();
  if (allow.length > 0 && allow.includes(user.email.toLowerCase())) return { ok: true as const };

  return { ok: false as const, status: 403, message: "Acesso negado." };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await assertSuperAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as
    | {
        nome?: string;
        email?: string;
        dia_vistoria?: string;
        horario_vistoria?: string;
      }
    | null;

  const patch: Record<string, unknown> = {};
  if (typeof body?.nome === "string") patch.nome = body.nome.trim();
  if (typeof body?.email === "string") patch.email = body.email.trim().toLowerCase();
  if (typeof body?.dia_vistoria === "string") patch.dia_vistoria = body.dia_vistoria.trim();
  if (typeof body?.horario_vistoria === "string") patch.horario_vistoria = body.horario_vistoria.trim();

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const admin = createSupabaseServiceRoleClient();
  const { data, error } = await admin
    .from("auditores")
    .update(patch)
    .eq("id", id)
    .select("id, nome, email, user_id, perfil, dia_vistoria, horario_vistoria, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await assertSuperAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  const { id } = await ctx.params;
  const admin = createSupabaseServiceRoleClient();

  const { data: existing, error: getErr } = await admin
    .from("auditores")
    .select("id, user_id")
    .eq("id", id)
    .single();
  if (getErr) return NextResponse.json({ error: getErr.message }, { status: 400 });

  const { error: delErr } = await admin.from("auditores").delete().eq("id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  if (existing?.user_id) {
    try {
      await admin.auth.admin.deleteUser(existing.user_id);
    } catch {
      /* noop */
    }
  }

  return NextResponse.json({ ok: true });
}

