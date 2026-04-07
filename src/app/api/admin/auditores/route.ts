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

export async function GET() {
  const gate = await assertSuperAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  const admin = createSupabaseServiceRoleClient();
  const { data, error } = await admin
    .from("auditores")
    .select("id, nome, email, user_id, perfil, dia_vistoria, horario_vistoria, created_at")
    .order("nome");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await assertSuperAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  const body = (await req.json().catch(() => null)) as
    | {
        nome?: string;
        email?: string;
        senha?: string;
        dia_vistoria?: string;
        horario_vistoria?: string;
      }
    | null;

  const nome = body?.nome?.trim();
  const email = body?.email?.trim().toLowerCase();
  const senha = body?.senha?.trim();
  const dia_vistoria = body?.dia_vistoria?.trim();
  const horario_vistoria = body?.horario_vistoria?.trim();

  if (!nome || !email || !senha || !dia_vistoria || !horario_vistoria) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
  }

  const admin = createSupabaseServiceRoleClient();

  // 1) Supabase Auth: cria a credencial de login/senha do auditor.
  const { data: created, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (createUserError || !created.user) {
    return NextResponse.json(
      { error: createUserError?.message || "Falha ao criar usuário no Auth." },
      { status: 400 }
    );
  }

  // 2) Tabela pública `auditores`: grava o perfil + rotina associados ao usuário criado.
  const { data: row, error: insertError } = await admin
    .from("auditores")
    .insert({
      nome,
      email,
      user_id: created.user.id,
      perfil: "auditor",
      dia_vistoria,
      horario_vistoria,
    })
    .select("id, nome, email, user_id, perfil, dia_vistoria, horario_vistoria, created_at")
    .single();

  if (insertError) {
    // best-effort cleanup: remove o usuário do Auth se não conseguir inserir o perfil
    try {
      await admin.auth.admin.deleteUser(created.user.id);
    } catch {
      /* noop */
    }
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ data: row }, { status: 201 });
}

