"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { Auditor } from "@/types/database";
import {
  createAuditor,
  deleteAuditor,
  listAuditores,
  updateAuditor,
} from "@/services/auditores";
import { Card } from "@/components/ui/Card";

export function AuditoresClient() {
  const [rows, setRows] = useState<Auditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [editing, setEditing] = useState<Auditor | null>(null);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAuditores(supabase);
      setRows(data);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar auditores");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !email.trim()) return;
    try {
      await createAuditor(supabase, { nome: nome.trim(), email: email.trim() });
      toast.success("Auditor criado");
      setNome("");
      setEmail("");
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar");
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    try {
      await updateAuditor(supabase, editing.id, {
        nome: editing.nome.trim(),
        email: editing.email.trim(),
      });
      toast.success("Auditor atualizado");
      setEditing(null);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este auditor?")) return;
    try {
      await deleteAuditor(supabase, id);
      toast.success("Removido");
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-4 text-sm font-semibold text-zinc-200">Novo auditor</h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            <span className="text-zinc-500">Nome</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex-1 text-sm">
            <span className="text-zinc-500">E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-fire-red px-4 text-sm font-semibold text-white hover:bg-red-800"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-zinc-200">Lista</h2>
        {loading ? (
          <div className="flex justify-center py-12 text-zinc-500">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">Nenhum auditor cadastrado.</p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {rows.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                {editing?.id === a.id ? (
                  <form onSubmit={handleSaveEdit} className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="flex-1 text-sm">
                      <span className="text-zinc-500">Nome</span>
                      <input
                        value={editing.nome}
                        onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="flex-1 text-sm">
                      <span className="text-zinc-500">E-mail</span>
                      <input
                        type="email"
                        value={editing.email}
                        onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button type="submit" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
                        Salvar
                      </button>
                      <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm">
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div>
                      <p className="font-medium text-white">{a.nome}</p>
                      <p className="text-sm text-zinc-500">{a.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(a)}
                        className="inline-flex items-center gap-1 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
                      >
                        <Pencil className="h-4 w-4" /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(a.id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200 hover:bg-red-950/50"
                      >
                        <Trash2 className="h-4 w-4" /> Excluir
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
