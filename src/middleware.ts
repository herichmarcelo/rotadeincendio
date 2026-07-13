import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/", "/login", "/auth"];
const STATIC = ["/_next", "/favicon.ico", "/manifest.json", "/icons"];
const ADMIN_PREFIX = "/admin";
const AUDITORES_PAGE = "/auditores";
const UNIDADES_PAGE = "/unidades";

function parseAllowedEmails() {
  // Bootstrap opcional (fallback). Preferimos role no Auth (`app_metadata.role`).
  const raw = process.env.SUPER_ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function isSuperAdmin(
  user: { app_metadata?: Record<string, unknown>; email?: string | null; id?: string },
  supabase: ReturnType<typeof createServerClient>
) {
  if (user.app_metadata?.role === "super_admin") return true;

  // Check auditores table for perfil='super_admin'
  const { data } = await supabase
    .from("auditores")
    .select("perfil")
    .or(`user_id.eq.${user.id},email.ilike.${user.email}`)
    .maybeSingle();

  return data?.perfil === "super_admin";
}

/** Super admin via Auth ou fallback SUPER_ADMIN_EMAILS (bootstrap). */
async function canAccessSuperAdminFeatures(
  user: { app_metadata?: Record<string, unknown>; email?: string | null; id?: string },
  supabase: ReturnType<typeof createServerClient>
) {
  if (await isSuperAdmin(user, supabase)) return true;
  const allow = parseAllowedEmails();
  const email = user.email?.toLowerCase();
  return allow.length > 0 && !!email && allow.includes(email);
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    PUBLIC.some((p) => path === p || path.startsWith(`${p}/`)) ||
    STATIC.some((p) => path.startsWith(p));

  if (isPublic) {
    if (path === "/login" && user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return supabaseResponse;
  }

  // Bootstrap: protegido por SUPABASE_BOOTSTRAP_SECRET no handler (sem sessão).
  if (
    (path === "/api/admin/bootstrap-super-admins" || path === "/api/admin/provision-super-admin") &&
    request.method === "POST"
  ) {
    return supabaseResponse;
  }

  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  if (path === ADMIN_PREFIX || path.startsWith(`${ADMIN_PREFIX}/`)) {
    if (await canAccessSuperAdminFeatures(user, supabase)) return supabaseResponse;
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Tela legada /auditores: só super admin (cadastro fica em /admin/auditores).
  if (path === AUDITORES_PAGE || path.startsWith(`${AUDITORES_PAGE}/`)) {
    if (await canAccessSuperAdminFeatures(user, supabase)) {
      return NextResponse.redirect(new URL("/admin/auditores", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Unidades e setores: só super admin.
  if (path === UNIDADES_PAGE || path.startsWith(`${UNIDADES_PAGE}/`)) {
    if (await canAccessSuperAdminFeatures(user, supabase)) return supabaseResponse;
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
