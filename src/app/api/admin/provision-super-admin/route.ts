import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";

/**
 * Recria (ou atualiza) o Super Admin no Supabase Auth e grava/atualiza a linha em public.auditores.
 *
 * POST /api/admin/provision-super-admin
 * Headers: Authorization: Bearer <SUPABASE_BOOTSTRAP_SECRET>
 *
 * .env:
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_BOOTSTRAP_SECRET
 *   SUPER_ADMIN_EMAILS              → usa o PRIMEIRO e-mail da lista
 *   SUPER_ADMIN_INITIAL_PASSWORD    → senha inicial (mín. 8 caracteres)
 *   SUPER_ADMIN_NOME                → (opcional) nome exibido em public.auditores
 *   SUPER_ADMIN_RESET_PASSWORD=true → se o usuário já existir, redefine a senha também
 */

function parseEmails() {
  const raw = process.env.SUPER_ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function superAdminDisplayName(email: string): string {
  const fromEnv = process.env.SUPER_ADMIN_NOME?.trim();
  if (fromEnv) return fromEnv;
  const local = email.split("@")[0] || "Super Admin";
  return local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
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

async function findUserIdByEmail(
  admin: SupabaseClient,
  email: string
): Promise<{ id: string; app_metadata?: Record<string, unknown> } | null> {
  const target = email.toLowerCase();
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const users = data.users ?? [];
    for (const u of users) {
      if (u.email?.toLowerCase() === target) {
        return { id: u.id, app_metadata: u.app_metadata as Record<string, unknown> | undefined };
      }
    }
    if (users.length < perPage) break;
    page += 1;
    if (page > 50) break;
  }
  return null;
}

/** Grava o super admin em public.auditores (perfil + user_id), para consulta no Supabase. */
async function syncSuperAdminAuditorRow(
  db: SupabaseClient,
  params: { userId: string; email: string; nome: string }
): Promise<{ auditorId: string; tableAction: "inserted" | "updated" }> {
  const { data: byEmail, error: e1 } = await db
    .from("auditores")
    .select("id")
    .eq("email", params.email)
    .maybeSingle();
  if (e1) throw new Error(e1.message);

  if (byEmail?.id) {
    const { error: up } = await db
      .from("auditores")
      .update({
        nome: params.nome,
        user_id: params.userId,
        perfil: "super_admin",
      })
      .eq("id", byEmail.id);
    if (up) throw new Error(up.message);
    return { auditorId: byEmail.id, tableAction: "updated" };
  }

  const { data: byUser, error: e2 } = await db
    .from("auditores")
    .select("id")
    .eq("user_id", params.userId)
    .maybeSingle();
  if (e2) throw new Error(e2.message);

  if (byUser?.id) {
    const { error: up } = await db
      .from("auditores")
      .update({
        nome: params.nome,
        email: params.email,
        perfil: "super_admin",
      })
      .eq("id", byUser.id);
    if (up) throw new Error(up.message);
    return { auditorId: byUser.id, tableAction: "updated" };
  }

  const { data: inserted, error: ins } = await db
    .from("auditores")
    .insert({
      nome: params.nome,
      email: params.email,
      user_id: params.userId,
      perfil: "super_admin",
      dia_vistoria: null,
      horario_vistoria: null,
    })
    .select("id")
    .single();
  if (ins) throw new Error(ins.message);
  return { auditorId: inserted.id as string, tableAction: "inserted" };
}

export async function POST(req: Request) {
  const gate = assertBootstrapAuth(req);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

  const emails = parseEmails();
  const email = emails[0];
  if (!email) {
    return NextResponse.json(
      { error: "SUPER_ADMIN_EMAILS vazio. Defina o e-mail do super admin." },
      { status: 400 }
    );
  }

  const password = process.env.SUPER_ADMIN_INITIAL_PASSWORD?.trim();
  if (!password || password.length < 8) {
    return NextResponse.json(
      {
        error:
          "Defina SUPER_ADMIN_INITIAL_PASSWORD no .env.local (mínimo 8 caracteres) para criar o usuário.",
      },
      { status: 400 }
    );
  }

  const resetPassword = process.env.SUPER_ADMIN_RESET_PASSWORD === "true";
  const nome = superAdminDisplayName(email);

  let db: SupabaseClient;
  try {
    db = createSupabaseServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Service role indisponível.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  try {
    const existing = await findUserIdByEmail(db, email);

    let userId: string;
    let action: string;

    if (existing) {
      const nextMeta = { ...(existing.app_metadata ?? {}), role: "super_admin" as const };
      const patch: { app_metadata: typeof nextMeta; password?: string } = { app_metadata: nextMeta };
      if (resetPassword) patch.password = password;

      const { data, error } = await db.auth.admin.updateUserById(existing.id, patch);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      userId = data.user.id;
      action = resetPassword ? "updated_role_and_password" : "updated_role";
    } else {
      const { data, error } = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { role: "super_admin" },
      });

      if (error) {
        const msg = error.message || "";
        if (
          msg.toLowerCase().includes("already been registered") ||
          msg.toLowerCase().includes("already registered")
        ) {
          const again = await findUserIdByEmail(db, email);
          if (!again) {
            return NextResponse.json({ error: msg }, { status: 400 });
          }
          const nextMeta = { ...(again.app_metadata ?? {}), role: "super_admin" as const };
          const { data: upd, error: upErr } = await db.auth.admin.updateUserById(again.id, {
            app_metadata: nextMeta,
            ...(resetPassword ? { password } : {}),
          });
          if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
          userId = upd.user.id;
          action = "linked_existing";
        } else {
          return NextResponse.json({ error: msg }, { status: 400 });
        }
      } else {
        userId = data.user.id;
        action = "created";
      }
    }

    const { auditorId, tableAction } = await syncSuperAdminAuditorRow(db, {
      userId,
      email,
      nome,
    });

    return NextResponse.json({
      action,
      user: { id: userId, email },
      auditor: { id: auditorId, nome, email, perfil: "super_admin", tableAction },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao provisionar usuário.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
