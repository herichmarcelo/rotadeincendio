"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Loader2, LogOut, User, Key } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";

export default function ConfiguracoesPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [signingOut, setSigningOut] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword.trim() || !confirmPassword.trim()) {
      toast.error("Preencha os campos de senha");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Não foi possível alterar a senha");
    } finally {
      setChangingPassword(false);
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
      <Card>
        <div className="flex items-start gap-3 mb-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 text-fire-yellow">
            <Key className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-medium text-white">Alterar senha</p>
            <p className="text-xs text-zinc-500">Atualize sua senha de acesso</p>
          </div>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <label className="text-sm">
            <span className="text-zinc-500">Nova senha</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Digite a nova senha"
              autoComplete="new-password"
            />
          </label>
          <label className="text-sm">
            <span className="text-zinc-500">Confirmar nova senha</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Confirme a nova senha"
              autoComplete="new-password"
            />
          </label>
          <button
            type="submit"
            disabled={changingPassword}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-fire-red px-4 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
          >
            {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
            {changingPassword ? "Alterando..." : "Alterar senha"}
          </button>
        </form>
      </Card>
    </div>
  );
}
