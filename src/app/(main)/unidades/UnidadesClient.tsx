"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { Setor, Unidade } from "@/types/database";
import {
  createSetor,
  createUnidade,
  deleteSetor,
  deleteUnidade,
  listSetores,
  listUnidades,
  updateSetor,
  updateUnidade,
} from "@/services/unidades";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export function UnidadesClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nomeUnidade, setNomeUnidade] = useState("");
  const [nomeSetor, setNomeSetor] = useState("");
  const [editUnidade, setEditUnidade] = useState<Unidade | null>(null);
  const [editSetor, setEditSetor] = useState<Setor | null>(null);

  const loadUnidades = useCallback(async () => {
    const u = await listUnidades(supabase);
    setUnidades(u);
    setSelectedId((prev) => prev ?? (u[0]?.id ?? null));
  }, [supabase]);

  const loadSetores = useCallback(async () => {
    if (!selectedId) {
      setSetores([]);
      return;
    }
    const s = await listSetores(supabase, selectedId);
    setSetores(s);
  }, [supabase, selectedId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await loadUnidades();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [loadUnidades]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void loadSetores().catch(() => toast.error("Erro ao carregar setores"));
  }, [loadSetores]);

  async function handleCreateUnidade(e: React.FormEvent) {
    e.preventDefault();
    if (!nomeUnidade.trim()) return;
    try {
      await createUnidade(supabase, nomeUnidade.trim());
      toast.success("Unidade criada");
      setNomeUnidade("");
      await refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  async function handleSaveUnidade(e: React.FormEvent) {
    e.preventDefault();
    if (!editUnidade) return;
    try {
      await updateUnidade(supabase, editUnidade.id, editUnidade.nome.trim());
      toast.success("Unidade atualizada");
      setEditUnidade(null);
      await refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  async function handleDeleteUnidade(id: string) {
    if (!confirm("Excluir unidade e todos os setores vinculados?")) return;
    try {
      await deleteUnidade(supabase, id);
      if (selectedId === id) setSelectedId(null);
      toast.success("Unidade removida");
      await refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  async function handleCreateSetor(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !nomeSetor.trim()) return;
    try {
      await createSetor(supabase, selectedId, nomeSetor.trim());
      toast.success("Setor criado");
      setNomeSetor("");
      await loadSetores();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  async function handleSaveSetor(e: React.FormEvent) {
    e.preventDefault();
    if (!editSetor) return;
    try {
      await updateSetor(supabase, editSetor.id, editSetor.nome.trim());
      toast.success("Setor atualizado");
      setEditSetor(null);
      await loadSetores();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  async function handleDeleteSetor(id: string) {
    if (!confirm("Excluir este setor?")) return;
    try {
      await deleteSetor(supabase, id);
      toast.success("Setor removido");
      await loadSetores();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="mb-4 text-sm font-semibold text-zinc-200">Unidades</h2>
        <form onSubmit={handleCreateUnidade} className="mb-6 flex gap-2">
          <input
            value={nomeUnidade}
            onChange={(e) => setNomeUnidade(e.target.value)}
            placeholder="Nome da unidade"
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-xl bg-fire-red px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Nova
          </button>
        </form>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
          </div>
        ) : (
          <ul className="space-y-2">
            {unidades.map((u) => (
              <li key={u.id}>
                <div
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between",
                    selectedId === u.id ? "border-fire-red/50 bg-fire-red/10" : "border-zinc-800 bg-zinc-950/40"
                  )}
                >
                  {editUnidade?.id === u.id ? (
                    <form onSubmit={handleSaveUnidade} className="flex w-full gap-2">
                      <input
                        value={editUnidade.nome}
                        onChange={(e) => setEditUnidade({ ...editUnidade, nome: e.target.value })}
                        className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                      />
                      <button type="submit" className="rounded-lg bg-emerald-600 px-3 text-sm text-white">
                        OK
                      </button>
                      <button type="button" onClick={() => setEditUnidade(null)} className="text-sm text-zinc-400">
                        Cancelar
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedId(u.id)}
                        className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-white"
                      >
                        <ChevronRight className="h-4 w-4 text-zinc-500" />
                        {u.nome}
                      </button>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditUnidade(u)}
                          className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
                        >
                          Renomear
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteUnidade(u.id)}
                          className="rounded-lg border border-red-900/40 bg-red-950/30 px-2 py-1 text-xs text-red-200"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-zinc-200">
          Setores {selectedId ? `— ${unidades.find((u) => u.id === selectedId)?.nome ?? ""}` : ""}
        </h2>
        {!selectedId ? (
          <p className="text-sm text-zinc-500">Selecione uma unidade à esquerda.</p>
        ) : (
          <>
            <form onSubmit={handleCreateSetor} className="mb-6 flex gap-2">
              <input
                value={nomeSetor}
                onChange={(e) => setNomeSetor(e.target.value)}
                placeholder="Nome do setor"
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded-xl bg-fire-yellow px-3 py-2 text-sm font-semibold text-zinc-950">
                Adicionar
              </button>
            </form>
            <ul className="space-y-2">
              {setores.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  {editSetor?.id === s.id ? (
                    <form onSubmit={handleSaveSetor} className="flex w-full gap-2">
                      <input
                        value={editSetor.nome}
                        onChange={(e) => setEditSetor({ ...editSetor, nome: e.target.value })}
                        className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                      />
                      <button type="submit" className="rounded-lg bg-emerald-600 px-3 text-sm text-white">
                        Salvar
                      </button>
                      <button type="button" onClick={() => setEditSetor(null)} className="text-sm text-zinc-400">
                        Cancelar
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-white">{s.nome}</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditSetor(s)}
                          className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteSetor(s.id)}
                          className="rounded-lg border border-red-900/40 bg-red-950/30 px-2 py-1 text-xs text-red-200"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
              {setores.length === 0 && <p className="text-sm text-zinc-500">Nenhum setor nesta unidade.</p>}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
