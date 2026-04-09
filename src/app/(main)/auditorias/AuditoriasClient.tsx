"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Filter, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { AuditoriaStatus } from "@/types/database";
import { deleteAuditoria, listAuditorias, updateAuditoria } from "@/services/auditorias";
import { getAuditorForCurrentUser } from "@/services/auditores";
import { listUnidades, listSetores } from "@/services/unidades";
import type { Unidade, Setor } from "@/types/database";
import { Card } from "@/components/ui/Card";
import { cn, formatTime24 } from "@/lib/utils";

type Row = {
  id: string;
  data_auditoria: string;
  horario_abertura?: string | null;
  aberta_em?: string | null;
  concluida_em?: string | null;
  parecer_atraso?: string | null;
  parecer_atraso_em?: string | null;
  parecer_atraso_auditor_id?: string | null;
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
  const [exporting, setExporting] = useState(false);
  const [meuAuditorId, setMeuAuditorId] = useState<string | null>(null);

  const [parecerOpen, setParecerOpen] = useState(false);
  const [parecerText, setParecerText] = useState("");
  const [parecerRow, setParecerRow] = useState<Row | null>(null);
  const [savingParecer, setSavingParecer] = useState(false);

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
    void (async () => {
      try {
        const auditor = await getAuditorForCurrentUser(supabase);
        setMeuAuditorId(auditor?.id ?? null);
      } catch {
        setMeuAuditorId(null);
      }
    })();
  }, [supabase]);

  useEffect(() => {
    if (!filterU) {
      setSetores([]);
      return;
    }
    void listSetores(supabase, filterU).then(setSetores).catch(() => {});
  }, [supabase, filterU]);

  function isOverdueBy6h(r: Row): boolean {
    if (!r.aberta_em) return false;
    const opened = new Date(r.aberta_em);
    if (Number.isNaN(opened.getTime())) return false;
    return Date.now() > opened.getTime() + 6 * 60 * 60 * 1000;
  }

  function shouldRequireParecer(r: Row): boolean {
    // Se já venceu por tempo OU já está marcada como vencida, exigimos parecer.
    return (r.status === "pendente" && isOverdueBy6h(r)) || r.status === "vencida";
  }

  function openParecerModal(r: Row) {
    setParecerRow(r);
    setParecerText(r.parecer_atraso ?? "");
    setParecerOpen(true);
  }

  async function saveParecer() {
    if (!parecerRow) return;
    const text = parecerText.trim();
    if (!text) {
      toast.error("Informe o parecer sobre o atraso.");
      return;
    }
    setSavingParecer(true);
    try {
      await updateAuditoria(supabase, parecerRow.id, {
        parecer_atraso: text,
        parecer_atraso_em: new Date().toISOString(),
        parecer_atraso_auditor_id: meuAuditorId ?? parecerRow.auditor_id,
      });
      toast.success("Parecer registrado");
      setParecerOpen(false);
      setParecerRow(null);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar parecer");
    } finally {
      setSavingParecer(false);
    }
  }

  async function handleStatus(r: Row, status: AuditoriaStatus) {
    try {
      if (status === "concluida" && shouldRequireParecer(r) && !r.parecer_atraso?.trim()) {
        openParecerModal(r);
        toast.error("Auditoria atrasada: informe o parecer antes de concluir.");
        return;
      }
      await updateAuditoria(supabase, r.id, {
        status,
        concluida_em: status === "concluida" ? new Date().toISOString() : null,
      });
      toast.success("Status atualizado");
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  function formatDoneTime(doneIso?: string | null): string | null {
    if (!doneIso) return null;
    const d = new Date(doneIso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  async function handleExportPdf() {
    if (rows.length === 0) {
      toast.error("Não há auditorias para exportar.");
      return;
    }

    setExporting(true);
    try {
      const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = (autoTableMod as unknown as { default: (doc: unknown, opts: unknown) => void }).default;

      const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const title = "Auditorias";
      const subtitleParts = [
        filterU ? `Unidade: ${unidades.find((u) => u.id === filterU)?.nome ?? filterU}` : "Unidade: Todas",
        filterS ? `Setor: ${setores.find((s) => s.id === filterS)?.nome ?? filterS}` : "Setor: Todos",
        `Exportado em: ${new Date().toLocaleString("pt-BR")}`,
      ];

      doc.setFontSize(16);
      doc.text(title, 14, 16);
      doc.setFontSize(10);
      doc.text(subtitleParts.join("  |  "), 14, 22);

      const head = [["Status", "Data", "Abertura", "Concluída", "Unidade", "Setor", "Auditor"]];
      const body = rows.map((r) => [
        statusLabel[r.status],
        new Date(r.data_auditoria + "T12:00:00").toLocaleDateString("pt-BR"),
        r.horario_abertura ? formatTime24(r.horario_abertura) : "—",
        r.status === "concluida" ? formatDoneTime(r.concluida_em) ?? "—" : "—",
        r.unidade?.nome ?? "—",
        r.setor?.nome ?? "—",
        r.auditor?.nome ?? "—",
      ]);

      autoTable(doc, {
        startY: 26,
        head,
        body,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [180, 30, 30] },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 18 },
          2: { cellWidth: 16 },
          3: { cellWidth: 16 },
        },
        margin: { left: 14, right: 14 },
      });

      const filename = `auditorias-${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);
      toast.success("PDF exportado");
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível exportar o PDF.");
    } finally {
      setExporting(false);
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
        <div className="flex flex-wrap gap-2">
          <Link
            href="/auditorias/nova"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-fire-red px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fire-red/20 hover:bg-red-800"
          >
            <Plus className="h-4 w-4" />
            Nova auditoria
          </Link>
          <button
            type="button"
            onClick={() => void handleExportPdf()}
            disabled={exporting || loading || rows.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-fire-yellow px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-fire-yellow/15 hover:brightness-95 disabled:opacity-60"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar PDF
          </button>
        </div>
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
                      {r.status === "concluida" && formatDoneTime(r.concluida_em)
                        ? ` · concluída ${formatDoneTime(r.concluida_em)}`
                        : ""}
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
                  {shouldRequireParecer(r) && (
                    <button
                      type="button"
                      onClick={() => openParecerModal(r)}
                      className="rounded-xl border border-amber-900/30 bg-amber-950/20 px-3 py-2 text-xs font-medium text-amber-200 hover:bg-amber-950/30"
                    >
                      Parecer sobre atraso
                    </button>
                  )}
                  <select
                    value={r.status}
                    onChange={(e) => void handleStatus(r, e.target.value as AuditoriaStatus)}
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

      {parecerOpen && parecerRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-3">
              <p className="text-sm font-semibold text-white">Parecer sobre atraso</p>
              <p className="mt-1 text-xs text-zinc-400">
                {parecerRow.unidade?.nome ?? "—"} · {parecerRow.setor?.nome ?? "—"} ·{" "}
                {new Date(parecerRow.data_auditoria + "T12:00:00").toLocaleDateString("pt-BR")}
              </p>
            </div>
            <label className="block text-sm">
              <span className="text-zinc-500">Justificativa</span>
              <textarea
                value={parecerText}
                onChange={(e) => setParecerText(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                placeholder="Descreva o motivo do atraso…"
              />
            </label>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setParecerOpen(false);
                  setParecerRow(null);
                }}
                className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveParecer()}
                disabled={savingParecer}
                className="rounded-xl bg-fire-yellow px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
              >
                {savingParecer ? "Salvando…" : "Salvar parecer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
