"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ClipboardCheck,
  Flame,
  LayoutDashboard,
  Settings,
  Users,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationCounts } from "@/hooks/useNotificationCounts";
import { useAuth } from "@/hooks/useAuth";

function buildNav(isSuperAdmin: boolean) {
  return [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/auditorias", label: "Auditorias", icon: ClipboardList },
    { href: "/checklist", label: "Checklist", icon: ClipboardCheck },
    // Cadastro e estrutura: só super admin (mesma regra do middleware).
    ...(isSuperAdmin
      ? [
          { href: "/admin/auditores", label: "Auditores", icon: Users },
          { href: "/unidades", label: "Unidades", icon: Building2 },
        ]
      : []),
    { href: "/configuracoes", label: "Configurações", icon: Settings },
  ];
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { badgeTotal } = useNotificationCounts();
  const { user } = useAuth();
  const isSuperAdmin = user?.app_metadata?.role === "super_admin";
  const nav = buildNav(Boolean(isSuperAdmin));

  return (
    <div className="flex min-h-dvh bg-zinc-950 text-zinc-100">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-800/90 bg-zinc-950/95 py-6 pl-4 pr-2 md:flex">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2 px-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fire-red/20 text-fire-yellow ring-1 ring-fire-red/40">
            <Flame className="h-6 w-6" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">Rota de Incêndio</p>
            <p className="text-xs text-zinc-500">Gestão de auditorias</p>
          </div>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-fire-red/25 text-white ring-1 ring-fire-red/50"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-5 w-5 shrink-0" />
                  {label}
                </span>
                {href === "/dashboard" && badgeTotal > 0 && (
                  <span className="rounded-full bg-fire-yellow px-2 py-0.5 text-xs font-bold text-zinc-950">
                    {badgeTotal > 99 ? "99+" : badgeTotal}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col pb-20 md:pb-0">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/90 px-4 py-3 backdrop-blur-md md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-fire-red/20 text-fire-yellow">
              <Flame className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold">Rota de Incêndio</span>
          </Link>
          {badgeTotal > 0 && (
            <span className="rounded-full bg-fire-yellow px-2.5 py-0.5 text-xs font-bold text-zinc-950">
              {badgeTotal} alertas
            </span>
          )}
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800/90 bg-zinc-950/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur-lg md:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-between gap-1">
          {nav.slice(0, 5).map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium",
                  active ? "text-fire-yellow" : "text-zinc-500"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-fire-yellow")} />
                <span className="truncate">{label.split(" ")[0]}</span>
              </Link>
            );
          })}
          <Link
            href="/configuracoes"
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium",
              pathname.startsWith("/configuracoes") ? "text-fire-yellow" : "text-zinc-500"
            )}
          >
            <Settings className="h-5 w-5" />
            <span className="truncate">Config</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
