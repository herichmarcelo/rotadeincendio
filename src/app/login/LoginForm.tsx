"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Flame, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/Card";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Login realizado");
      router.replace(next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch {
      toast.error("Não foi possível entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-ri-enter relative z-10 w-full max-w-md">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-fire-red/25 text-fire-yellow ring-2 ring-fire-red/50">
          <Flame className="h-9 w-9" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-white">Rota de Incêndio</h1>
        <p className="mt-2 max-w-sm text-sm text-zinc-400">
          Acesse com seu e-mail e senha para gerenciar auditorias e checklists.
        </p>
      </div>

      <Card className="animate-ri-enter animate-ri-delay-1 border-fire-red/25 bg-zinc-900/70 shadow-2xl shadow-black/40 backdrop-blur-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="block text-sm">
            <span className="mb-1.5 flex items-center gap-2 text-zinc-400">
              <Mail className="h-4 w-4" /> E-mail
            </span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-white outline-none ring-0 transition focus:border-fire-red focus:ring-2 focus:ring-fire-red/40"
              placeholder="voce@empresa.com"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 flex items-center gap-2 text-zinc-400">
              <Lock className="h-4 w-4" /> Senha
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-white outline-none transition focus:border-fire-red focus:ring-2 focus:ring-fire-red/40"
              placeholder="••••••••"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex h-12 items-center justify-center gap-2 rounded-xl bg-fire-red text-sm font-semibold text-white shadow-lg shadow-fire-red/25 transition hover:bg-red-800 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            Entrar
          </button>
        </form>
      </Card>

      <p className="animate-ri-enter animate-ri-delay-2 mt-8 text-center text-xs text-zinc-500">
        Ao continuar, você concorda com o uso seguro dos dados da sua organização.{" "}
        <Link href="/" className="text-fire-yellow underline-offset-4 hover:underline">
          Voltar
        </Link>
      </p>
    </div>
  );
}
