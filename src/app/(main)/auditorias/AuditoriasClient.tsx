"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { AuditoriaStatus } from "@/types/database";
import { deleteAuditoria, listAuditorias, updateAuditoria } from "@/services/auditorias";
import { listUnidades, listSetores } from "@/services/unidades";
import type { Unidade, Setor } from "@/types/database";
import { Card } from "@/components/ui/Card";
import { cn, formatTime24 } from "@/lib/utils";

type Row = {
  id: string;
  data_auditoria: string;
  horario_abertura?: string | null;
  status: AuditoriaStatus;
  unidade_id: string;
  setor_id: string;
  auditor_id: string;
  unidade: { nome: string } | null;
  setor: { nome: string } | null;
  auditor: { nome: string; email: string } | null;
};

const statusLabel: Record<AuditoriaStatus, string> = {
  pendente: "Pendente",
  concluida: "Concluída",
  vencida: "Vencida",
};

export function AuditoriasClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [filterU, setFilterU] = useState<string>("");
  const [filterS, setFilterS] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, u] = await Promise.all([
        listAuditorias(supabase, {
          unidadeId: filterU || undefined,
          setorId: filterS || undefined,
        }),
        listUnidades(supabase),
      ]);
      setRows(data as Row[]);
      setUnidades(u);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar auditorias");
    } finally {
      setLoading(false);
    }
  }, [supabase, filterU, filterS]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!filterU) {
      setSetores([]);
      return;
    }
    void listSetores(supabase, filterU).then(setSetores).catch(() => {});
  }, [supabase, filterU]);

  async function handleStatus(id: string, status: AuditoriaStatus) {
    try {
      await updateAuditoria(supabase, id, { status });
      toast.success("Status atualizado");
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta auditoria?")) return;
    try {
      await deleteAuditoria(supabase, id);
      toast.success("Auditoria removida");
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/auditorias/nova"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-fire-red px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fire-red/20 hover:bg-red-800"
        >
          <Plus className="h-4 w-4" />
          Nova auditoria
        </Link>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
          <Filter className="h-4 w-4" />
          <span>Filtros</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-zinc-500">Unidade</span>
            <select
              value={filterU}
              onChange={(e) => {
                setFilterU(e.target.value);
                setFilterS("");
              }}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              <option value="">Todas</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-zinc-500">Setor</span>
            <select
              value={filterS}
              onChange={(e) => setFilterS(e.target.value)}
              disabled={!filterU}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              <option value="">Todos</option>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">Nenhuma auditoria encontrada.</p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase",
                        r.status === "vencida" && "bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40",
                        r.status === "pendente" && "bg-fire-yellow/15 text-fire-yellow ring-1 ring-fire-yellow/30",
                        r.status === "concluida" && "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30"
                      )}
                    >
                      {statusLabel[r.status]}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {new Date(r.data_auditoria + "T12:00:00").toLocaleDateString("pt-BR")}
                      {r.horario_abertura ? ` · ${formatTime24(r.horario_abertura)}` : ""}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white">
                    {r.unidade?.nome ?? "—"} · {r.setor?.nome ?? "—"}
                  </p>
                  <p className="text-xs text-zinc-500">Auditor: {r.auditor?.nome ?? "—"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/checklist/${r.id}`}
                    className="rounded-xl border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-900"
                  >
                    Checklist
                  </Link>
                  <select
                    value={r.status}
                    onChange={(e) => void handleStatus(r.id, e.target.value as AuditoriaStatus)}
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-white"
                  >
                    {(Object.keys(statusLabel) as AuditoriaStatus[]).map((k) => (
                      <option key={k} value={k}>
                        {statusLabel[k]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleDelete(r.id)}
                    className="inline-flex items-center gap-1 rounded-xl border border-red-900/40 bg-red-950/30 px-3 py-2 text-xs text-red-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
