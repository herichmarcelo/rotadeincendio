"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { createAuditoria, initialStatusForDate } from "@/services/auditorias";
import { getAuditorForCurrentUser } from "@/services/auditores";
import { listUnidades, listSetores } from "@/services/unidades";
import type { Auditor, Unidade, Setor } from "@/types/database";
import { Card } from "@/components/ui/Card";

export default function NovaAuditoriaPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [meuAuditor, setMeuAuditor] = useState<Auditor | null>(null);
  const [unidadeId, setUnidadeId] = useState("");
  const [setorId, setSetorId] = useState("");
  const [dataAuditoria, setDataAuditoria] = useState(() => new Date().toISOString().slice(0, 10));
  /** Formato 24h (valor do input type="time": HH:mm). */
  const [horarioAbertura, setHorarioAbertura] = useState("08:00");
  const [loading, setLoading] = useState(false);
  const [boot, setBoot] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [u, auditor] = await Promise.all([listUnidades(supabase), getAuditorForCurrentUser(supabase)]);
        setUnidades(u);
        setMeuAuditor(auditor);
        if (u[0]) setUnidadeId(u[0].id);
        if (!auditor) {
          toast.error("Seu usuário não está vinculado a um auditor. Peça ao super admin para cadastrar seu acesso.");
        }
      } catch (e) {
        console.error(e);
        toast.error("Erro ao carregar dados");
      } finally {
        setBoot(false);
      }
    })();
  }, [supabase]);

  useEffect(() => {
    if (!unidadeId) {
      setSetores([]);
      setSetorId("");
      return;
    }
    void listSetores(supabase, unidadeId)
      .then((s) => {
        setSetores(s);
        setSetorId(s[0]?.id ?? "");
      })
      .catch(() => {});
  }, [supabase, unidadeId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!meuAuditor) {
      toast.error("Não é possível criar auditoria sem perfil de auditor vinculado.");
      return;
    }
    if (!unidadeId || !setorId) {
      toast.error("Preencha unidade e setor.");
      return;
    }
    setLoading(true);
    try {
      const status = initialStatusForDate(dataAuditoria);
      await createAuditoria(supabase, {
        unidade_id: unidadeId,
        setor_id: setorId,
        auditor_id: meuAuditor.id,
        data_auditoria: dataAuditoria,
        horario_abertura: horarioAbertura.length === 5 ? `${horarioAbertura}:00` : horarioAbertura,
        status,
      });
      toast.success("Auditoria criada");
      router.push("/auditorias");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar");
    } finally {
      setLoading(false);
    }
  }

  if (boot) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        href="/auditorias"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-white">Nova auditoria</h1>
        <p className="text-sm text-zinc-400">
          Defina local, data e horário de abertura (24h). O auditor é sempre você.
        </p>
      </div>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="text-zinc-500">Unidade</span>
            <select
              required
              value={unidadeId}
              onChange={(e) => setUnidadeId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm"
            >
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-500">Setor</span>
            <select
              required
              value={setorId}
              onChange={(e) => setSetorId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm"
            >
              {setores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="block text-sm">
            <span className="text-zinc-500">Auditor</span>
            <div className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900/40 px-3 py-2.5 text-sm text-zinc-200">
              {meuAuditor ? meuAuditor.nome : "— (vincule seu usuário a um cadastro de auditor)"}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-zinc-500">Data da auditoria</span>
              <input
                type="date"
                required
                value={dataAuditoria}
                onChange={(e) => setDataAuditoria(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">Horário de abertura (24h)</span>
              <input
                type="time"
                required
                step={60}
                value={horarioAbertura}
                onChange={(e) => setHorarioAbertura(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm [color-scheme:dark]"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={loading || !meuAuditor}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-fire-red py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar auditoria
          </button>
        </form>
      </Card>
    </div>
  );
}
