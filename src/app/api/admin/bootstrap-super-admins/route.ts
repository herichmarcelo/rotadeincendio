import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";

/**
 * Promove usuários do Supabase Auth a Super Admin via app_metadata.role,
 * sem precisar abrir o painel do Supabase.
 *
 * Uso (uma vez, após deploy / local com .env):
 *   curl -X POST https://seu-dominio/api/admin/bootstrap-super-admins \
 *     -H "Authorization: Bearer SEU_SUPABASE_BOOTSTRAP_SECRET"
 *
 * Requer no .env:
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_BOOTSTRAP_SECRET  (gere uma string longa aleatória)
 *   SUPER_ADMIN_EMAILS        (e-mails separados por vírgula)
 */

function parseEmails() {
  const raw = process.env.SUPER_ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function assertBootstrapAuth(req: Request): { ok: true } | { ok: false; status: number; message: string } {
  const secret = process.env.SUPABASE_BOOTSTRAP_SECRET?.trim();
  if (!secret) {
    return { ok: false, status: 500, message: "SUPABASE_BOOTSTRAP_SECRET não configurado." };
  }

  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const header = req.headers.get("x-supabase-bootstrap-secret")?.trim();
  const provided = bearer || header || "";

  if (!provided || provided !== secret) {
    return { ok: false, status: 401, message: "Segredo inválido ou ausente." };
  }

  return { ok: true };
}

export async function POST(req: Request) {
  const gate = assertBootstrapAuth(req);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

  const emails = parseEmails();
  if (emails.length === 0) {
    return NextResponse.json(
      { error: "SUPER_ADMIN_EMAILS vazio. Defina ao menos um e-mail." },
      { status: 400 }
    );
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Service role indisponível.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const promoted: { email: string; id: string }[] = [];
  const notFound: string[] = [];
  const errors: { email: string; message: string }[] = [];

  const targetSet = new Set(emails);

  let page = 1;
  const perPage = 1000;
  const byEmail = new Map<string, { id: string; app_metadata?: Record<string, unknown> }>();

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const users = data.users ?? [];
    for (const u of users) {
      const em = u.email?.toLowerCase();
      if (em && targetSet.has(em)) {
        byEmail.set(em, { id: u.id, app_metadata: u.app_metadata as Record<string, unknown> | undefined });
      }
    }
    if (users.length < perPage) break;
    page += 1;
    if (page > 50) break;
  }

  for (const email of emails) {
    const found = byEmail.get(email);
    if (!found) {
      notFound.push(email);
      continue;
    }
    const nextMeta = { ...(found.app_metadata ?? {}), role: "super_admin" as const };
    const { error } = await admin.auth.admin.updateUserById(found.id, {
      app_metadata: nextMeta,
    });
    if (error) {
      errors.push({ email, message: error.message });
      continue;
    }
    promoted.push({ email, id: found.id });
  }

  return NextResponse.json({
    ok: errors.length === 0,
    promoted,
    notFound,
    errors,
    hint:
      notFound.length > 0
        ? "Usuários não encontrados: confira se o e-mail existe em Authentication → Users."
        : undefined,
  });
}
