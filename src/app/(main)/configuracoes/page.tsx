"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Loader2, LogOut, User } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";

export default function ConfiguracoesPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      toast.success("Sessão encerrada");
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Não foi possível sair");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Configurações</h1>
        <p className="text-sm text-zinc-400">Conta e sessão.</p>
      </div>
      <Card>
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 text-fire-yellow">
            <User className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-medium text-white">Usuário autenticado</p>
            {loading ? (
              <p className="text-sm text-zinc-500">Carregando…</p>
            ) : (
              <p className="text-sm text-zinc-400">{user?.email ?? "—"}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-900 disabled:opacity-60"
        >
          {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Sair
        </button>
      </Card>
    </div>
  );
}
