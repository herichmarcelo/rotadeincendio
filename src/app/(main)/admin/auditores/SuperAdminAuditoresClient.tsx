"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { listSetores, listUnidades } from "@/services/unidades";
import type { Setor, Unidade } from "@/types/database";

type DiaSemana =
  | "Segunda-feira"
  | "Terça-feira"
  | "Quarta-feira"
  | "Quinta-feira"
  | "Sexta-feira"
  | "Sábado"
  | "Domingo";

type AuditorAdmin = {
  id: string;
  nome: string;
  email: string;
  unidade_id: string | null;
  setor_id: string | null;
  unidade_nome: string | null;
  setor_nome: string | null;
  dia: DiaSemana;
  horario: string; // HH:mm
};

type ApiAuditor = {
  id: string;
  nome: string;
  email: string;
  perfil?: "auditor" | "super_admin" | null;
  unidade_id: string | null;
  setor_id: string | null;
  unidade?: { nome: string } | null;
  setor?: { nome: string } | null;
  dia_vistoria: string | null;
  horario_vistoria: string | null;
};

const DIAS: DiaSemana[] = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
];

function rotinaLabel(a: Pick<AuditorAdmin, "dia" | "horario">) {
  return `Toda ${a.dia} às ${a.horario}`;
}

export function SuperAdminAuditoresClient() {
  // TODO (Restrição de acesso): proteger esta rota para apenas Super Admin (ex.: checar claims/role no JWT do Supabase).
  // Nesta etapa estamos focando no layout + estado mockado.

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const initial = useMemo<AuditorAdmin[]>(
    () => [
      {
        id: "mock-1",
        nome: "Herich Marcelo",
        email: "herich.marcel0@example.com",
        unidade_id: null,
        setor_id: null,
        unidade_nome: null,
        setor_nome: null,
        dia: "Sexta-feira",
        horario: "16:00",
      },
      {
        id: "mock-2",
        nome: "Igor Silva",
        email: "igor.silva@example.com",
        unidade_id: null,
        setor_id: null,
        unidade_nome: null,
        setor_nome: null,
        dia: "Sábado",
        horario: "19:00",
      },
    ],
    []
  );

  const [rows, setRows] = useState<AuditorAdmin[]>(initial);
  const [editing, setEditing] = useState<AuditorAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [createSetores, setCreateSetores] = useState<Setor[]>([]);
  const [editSetores, setEditSetores] = useState<Setor[]>([]);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [setorId, setSetorId] = useState("");
  const [dia, setDia] = useState<DiaSemana>("Sexta-feira");
  const [horario, setHorario] = useState("16:00");

  function resetForm() {
    setNome("");
    setEmail("");
    setSenha("");
    setUnidadeId("");
    setSetorId("");
    setCreateSetores([]);
    setDia("Sexta-feira");
    setHorario("16:00");
  }

  async function loadUnidades() {
    try {
      const data = await listUnidades(supabase);
      setUnidades(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar unidades");
    }
  }

  async function loadCreateSetores(nextUnidadeId: string) {
    if (!nextUnidadeId) {
      setCreateSetores([]);
      setSetorId("");
      return;
    }
    try {
      const data = await listSetores(supabase, nextUnidadeId);
      setCreateSetores(data);
      setSetorId((prev) => (data.some((s) => s.id === prev) ? prev : ""));
    } catch (err: unknown) {
      setCreateSetores([]);
      setSetorId("");
      toast.error(err instanceof Error ? err.message : "Erro ao carregar setores");
    }
  }

  async function loadEditSetores(nextUnidadeId: string) {
    if (!nextUnidadeId) {
      setEditSetores([]);
      return;
    }
    try {
      const data = await listSetores(supabase, nextUnidadeId);
      setEditSetores(data);
    } catch (err: unknown) {
      setEditSetores([]);
      toast.error(err instanceof Error ? err.message : "Erro ao carregar setores");
    }
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auditores", { cache: "no-store" });
      const json = (await res.json()) as { data?: ApiAuditor[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Falha ao carregar auditores.");
      const mapped: AuditorAdmin[] = (json.data ?? []).map((r) => ({
        id: r.id,
        nome: r.nome,
        email: r.email,
        unidade_id: r.unidade_id ?? null,
        setor_id: r.setor_id ?? null,
        unidade_nome: r.unidade?.nome ?? null,
        setor_nome: r.setor?.nome ?? null,
        dia: (r.dia_vistoria || "Sexta-feira") as DiaSemana,
        horario: (r.horario_vistoria || "16:00") as string,
      }));
      setRows(mapped);
    } catch (e) {
      console.error(e);
      setRows(initial);
      toast.error("Não foi possível carregar do Supabase. Mostrando mock.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    void loadUnidades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadCreateSetores(unidadeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !email.trim() || !senha.trim() || !unidadeId || !setorId || !dia || !horario) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    setSubmitting(true);
    try {
      // Supabase Auth (admin.createUser) + insert em public.auditores acontece no backend:
      // POST /api/admin/auditores
      const res = await fetch("/api/admin/auditores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nome,
          email,
          senha,
          unidade_id: unidadeId,
          setor_id: setorId,
          dia_vistoria: dia,
          horario_vistoria: horario,
        }),
      });
      const json = (await res.json()) as { data?: ApiAuditor; error?: string };
      if (!res.ok) throw new Error(json.error || "Falha ao cadastrar auditor.");

      const r = json.data;
      if (!r) throw new Error("Resposta inválida do servidor.");
      const next: AuditorAdmin = {
        id: r.id,
        nome: r.nome,
        email: r.email,
        unidade_id: r.unidade_id ?? unidadeId,
        setor_id: r.setor_id ?? setorId,
        unidade_nome: r.unidade?.nome ?? null,
        setor_nome: r.setor?.nome ?? null,
        dia: (r.dia_vistoria || dia) as DiaSemana,
        horario: (r.horario_vistoria || horario) as string,
      };
      setRows((prev) => [next, ...prev.filter((x) => x.id !== next.id)]);
      resetForm();
      toast.success("Auditor cadastrado.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(a: AuditorAdmin) {
    setEditing({ ...a });
    void loadEditSetores(a.unidade_id ?? "");
  }

  function cancelEdit() {
    setEditing(null);
    setEditSetores([]);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (
      !editing.nome.trim() ||
      !editing.email.trim() ||
      !editing.unidade_id ||
      !editing.setor_id ||
      !editing.dia ||
      !editing.horario
    ) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/auditores/${editing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nome: editing.nome,
          email: editing.email,
          unidade_id: editing.unidade_id,
          setor_id: editing.setor_id,
          dia_vistoria: editing.dia,
          horario_vistoria: editing.horario,
        }),
      });
      const json = (await res.json()) as { data?: ApiAuditor; error?: string };
      if (!res.ok) throw new Error(json.error || "Falha ao atualizar auditor.");
      const r = json.data;
      if (!r) throw new Error("Resposta inválida do servidor.");
      const updated: AuditorAdmin = {
        id: r.id,
        nome: r.nome,
        email: r.email,
        unidade_id: r.unidade_id ?? editing.unidade_id,
        setor_id: r.setor_id ?? editing.setor_id,
        unidade_nome: r.unidade?.nome ?? null,
        setor_nome: r.setor?.nome ?? null,
        dia: (r.dia_vistoria || editing.dia) as DiaSemana,
        horario: (r.horario_vistoria || editing.horario) as string,
      };
      setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setEditing(null);
      setEditSetores([]);
      toast.success("Auditor atualizado.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(id: string) {
    const a = rows.find((r) => r.id === id);
    if (!a) return;
    if (!confirm(`Excluir o auditor \"${a.nome}\"?`)) return;

    try {
      const res = await fetch(`/api/admin/auditores/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error || "Falha ao excluir auditor.");
      setRows((prev) => prev.filter((r) => r.id !== id));
      if (editing?.id === id) setEditing(null);
      toast.success("Auditor excluído.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-1 text-sm font-semibold text-zinc-200">Cadastro de auditor</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Crie o usuário de login e defina a rotina fixa (dia e horário).
        </p>

        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-1">
            <span className="text-zinc-500">Nome completo *</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Ex.: Herich Marcelo"
              autoComplete="name"
            />
          </label>

          <label className="text-sm sm:col-span-1">
            <span className="text-zinc-500">E-mail (login) *</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="ex.: herich@empresa.com"
              autoComplete="email"
            />
          </label>

          <label className="text-sm sm:col-span-1">
            <span className="text-zinc-500">Unidade *</span>
            <select
              value={unidadeId}
              onChange={(e) => setUnidadeId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            >
              <option value="">Selecione</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm sm:col-span-1">
            <span className="text-zinc-500">Setor *</span>
            <select
              value={setorId}
              onChange={(e) => setSetorId(e.target.value)}
              disabled={!unidadeId}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm disabled:opacity-60"
            >
              <option value="">Selecione</option>
              {createSetores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm sm:col-span-1">
            <span className="text-zinc-500">Senha (1º acesso) *</span>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Defina uma senha inicial"
              autoComplete="new-password"
            />
          </label>

          <div className="grid grid-cols-2 gap-3 sm:col-span-1">
            <label className="text-sm">
              <span className="text-zinc-500">Dia da vistoria *</span>
              <select
                value={dia}
                onChange={(e) => setDia(e.target.value as DiaSemana)}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              >
                {DIAS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="text-zinc-500">Horário da vistoria *</span>
              <input
                type="time"
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-500">
              Rotina definida: <span className="font-medium text-zinc-300">{`Toda ${dia} às ${horario}`}</span>
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-fire-red px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {submitting ? "Cadastrando..." : "Cadastrar auditor"}
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-zinc-200">Gestão de auditores</h2>

        {loading ? (
          <div className="flex justify-center py-12 text-zinc-500">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">Nenhum auditor cadastrado.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <div className="hidden grid-cols-[1.3fr_1.2fr_1fr_1fr_1.2fr_240px] gap-3 bg-zinc-950/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 md:grid">
              <span>Nome</span>
              <span>E-mail</span>
              <span>Unidade</span>
              <span>Setor</span>
              <span>Rotina</span>
              <span className="text-right">Ações</span>
            </div>

            <ul className="divide-y divide-zinc-800">
              {rows.map((a) => {
                const isEditing = editing?.id === a.id;

                return (
                  <li key={a.id} className="px-4 py-4">
                    {isEditing && editing ? (
                      <form
                        onSubmit={saveEdit}
                        className="grid grid-cols-1 gap-3 md:grid-cols-[1.3fr_1.2fr_1fr_1fr_1.2fr_240px] md:items-end"
                      >
                        <label className="text-sm">
                          <span className="text-zinc-500">Nome</span>
                          <input
                            value={editing.nome}
                            onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                          />
                        </label>

                        <label className="text-sm">
                          <span className="text-zinc-500">E-mail</span>
                          <input
                            type="email"
                            value={editing.email}
                            onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                          />
                        </label>

                        <label className="text-sm">
                          <span className="text-zinc-500">Unidade</span>
                          <select
                            value={editing.unidade_id ?? ""}
                            onChange={(e) => {
                              const next = e.target.value;
                              setEditing({
                                ...editing,
                                unidade_id: next || null,
                                setor_id: null,
                              });
                              void loadEditSetores(next);
                            }}
                            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                          >
                            <option value="">Selecione</option>
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
                            value={editing.setor_id ?? ""}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                setor_id: e.target.value || null,
                              })
                            }
                            disabled={!editing.unidade_id}
                            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm disabled:opacity-60"
                          >
                            <option value="">Selecione</option>
                            {editSetores.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.nome}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-sm">
                            <span className="text-zinc-500">Dia</span>
                            <select
                              value={editing.dia}
                              onChange={(e) => setEditing({ ...editing, dia: e.target.value as DiaSemana })}
                              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                            >
                              {DIAS.map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-sm">
                            <span className="text-zinc-500">Hora</span>
                            <input
                              type="time"
                              value={editing.horario}
                              onChange={(e) => setEditing({ ...editing, horario: e.target.value })}
                              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                            />
                          </label>
                        </div>

                        <div className="flex flex-col gap-2 md:flex-row md:justify-end">
                          <button
                            type="submit"
                            disabled={savingEdit}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                          >
                            {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            {savingEdit ? "Salvando..." : "Salvar"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
                          >
                            <X className="h-4 w-4" />
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.3fr_1.2fr_1fr_1fr_1.2fr_240px] md:items-center">
                        <div>
                          <p className="font-medium text-white">{a.nome}</p>
                          <p className="text-xs text-zinc-500 md:hidden">
                            {a.email} · {a.unidade_nome ?? "—"} · {a.setor_nome ?? "—"}
                          </p>
                        </div>
                        <p className="hidden text-sm text-zinc-400 md:block">{a.email}</p>
                        <p className="hidden text-sm text-zinc-400 md:block">{a.unidade_nome ?? "—"}</p>
                        <p className="hidden text-sm text-zinc-400 md:block">{a.setor_nome ?? "—"}</p>
                        <p className="text-sm text-zinc-300">{rotinaLabel(a)}</p>
                        <div className="flex flex-wrap gap-2 md:justify-end">
                          <button
                            type="button"
                            onClick={() => startEdit(a)}
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
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
