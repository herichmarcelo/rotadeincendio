"use client";

import Link from "next/link";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { formatTime24 } from "@/lib/utils";
import { getOfflineBlob, isOfflinePhotoRef, offlinePhotoId } from "@/lib/checklistOffline";
import { listChecklistItens, listRespostasPorAuditoria } from "@/services/checklist";
import type { AuditoriaStatus } from "@/types/database";

export type ChecklistIndexRow = {
  id: string;
  data_auditoria: string;
  horario_abertura?: string | null;
  concluida_em?: string | null;
  status: AuditoriaStatus;
  unidade: { nome: string } | null;
  setor: { nome: string } | null;
  auditor?: { nome: string; email: string } | null;
};

const statusLabel: Record<AuditoriaStatus, string> = {
  pendente: "Pendente",
  concluida: "Concluída",
  vencida: "Vencida",
};

function formatDoneTime(doneIso?: string | null): string | null {
  if (!doneIso) return null;
  const d = new Date(doneIso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function safeFilename(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 80);
}

async function blobToDataUrl(blob: Blob): Promise<{ dataUrl: string; mime: string }> {
  const mime = blob.type || "image/jpeg";
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
  return { dataUrl, mime };
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

async function resolvePhotoDataUrl(url: string): Promise<{ dataUrl: string; mime: string } | null> {
  try {
    if (isOfflinePhotoRef(url)) {
      const blob = await getOfflineBlob(offlinePhotoId(url));
      if (!blob) return null;
      return await blobToDataUrl(blob);
    }
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

export function ChecklistIndexClient({ data }: { data: ChecklistIndexRow[] }) {
  const [exportingId, setExportingId] = useState<string | null>(null);

  async function handleExportOne(r: ChecklistIndexRow) {
    setExportingId(r.id);
    try {
      toast.info("Gerando PDF… (pode demorar se houver muitas fotos)");
      const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = (autoTableMod as unknown as { default: (doc: unknown, opts: unknown) => void }).default;

      const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

      doc.setFontSize(16);
      doc.text("Auditoria — Rota de Incêndio", 14, 16);
      doc.setFontSize(10);

      const datePt = new Date(r.data_auditoria + "T12:00:00").toLocaleDateString("pt-BR");
      const abertura = r.horario_abertura ? formatTime24(r.horario_abertura) : "—";
      const concluida = r.status === "concluida" ? formatDoneTime(r.concluida_em) ?? "—" : "—";
      const unidade = r.unidade?.nome ?? "—";
      const setor = r.setor?.nome ?? "—";
      const auditor = r.auditor?.nome ?? "—";

      // Cabeçalho/Resumo (tabela)
      autoTable(doc, {
        startY: 22,
        head: [["Campo", "Valor"]],
        body: [
          ["Status", statusLabel[r.status]],
          ["Data", datePt],
          ["Horário de abertura", abertura],
          ["Horário de conclusão", concluida],
          ["Unidade", unidade],
          ["Setor", setor],
          ["Auditor", auditor],
          ["Exportado em", new Date().toLocaleString("pt-BR")],
        ],
        styles: { fontSize: 10, cellPadding: 2 },
        headStyles: { fillColor: [180, 30, 30] },
        margin: { left: 14, right: 14 },
        columnStyles: { 0: { cellWidth: 45 } },
      });

      // Checklist completo (itens + respostas + fotos)
      const supabase = createSupabaseBrowserClient();
      const [itens, respostas] = await Promise.all([
        listChecklistItens(supabase),
        listRespostasPorAuditoria(supabase, r.id),
      ]);
      const byItem = new Map(respostas.map((x) => [x.item_id, x]));

      const pageW = doc.internal.pageSize.getWidth();
      const marginX = 14;
      const maxW = pageW - marginX * 2;
      let y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 0;
      y = Math.max(y + 8, 60);

      const ensureSpace = (needMm: number) => {
        const pageH = doc.internal.pageSize.getHeight();
        if (y + needMm <= pageH - 14) return;
        doc.addPage();
        y = 14;
      };

      const drawKeyValue = (label: string, value: string) => {
        doc.setFontSize(10);
        doc.setTextColor(160);
        doc.text(label, marginX, y);
        doc.setTextColor(30);
        const lines = doc.splitTextToSize(value || "—", maxW - 35);
        doc.text(lines, marginX + 35, y);
        y += 6 + (lines.length - 1) * 4;
      };

      const checkbox = (checked: boolean) => (checked ? "[x]" : "[ ]");

      for (const it of itens) {
        const r0 = byItem.get(it.id);
        const conforme = r0?.conforme ?? false;
        const naoConforme = r0?.nao_conforme ?? false;
        const vezes = String(r0?.vezes_ocorridas ?? 0);
        const obs = r0?.observacao ?? "";
        const fotos = (r0?.fotos ?? []).filter(Boolean);

        // bloco do item
        ensureSpace(24);
        doc.setDrawColor(60);
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(marginX, y, maxW, 10, 2, 2, "F");
        doc.setFontSize(11);
        doc.setTextColor(20);
        doc.text(it.titulo, marginX + 2, y + 6.5, { maxWidth: maxW - 4 });
        y += 14;

        doc.setFontSize(10);
        doc.setTextColor(30);
        doc.text(`${checkbox(conforme)} Conforme     ${checkbox(naoConforme)} Não conforme`, marginX, y);
        y += 6;

        drawKeyValue("Vezes", vezes);
        drawKeyValue("Observação", obs || "—");

        // Fotos (miniaturas)
        if (fotos.length > 0) {
          ensureSpace(10);
          doc.setFontSize(10);
          doc.setTextColor(90);
          doc.text("Fotos", marginX, y);
          y += 4;

          const thumb = 34; // mm
          const gap = 4;
          const cols = Math.max(1, Math.floor((maxW + gap) / (thumb + gap)));
          let col = 0;
          let x = marginX;

          // Proteção: evita travar em listas enormes de fotos
          const fotosToRender = fotos.slice(0, 24);
          for (let i = 0; i < fotosToRender.length; i++) {
            const u = fotosToRender[i]!;
            ensureSpace(thumb + 6);
            if (col >= cols) {
              col = 0;
              x = marginX;
              y += thumb + gap;
              ensureSpace(thumb + 6);
            }

            doc.setDrawColor(160);
            doc.roundedRect(x, y, thumb, thumb, 2, 2);

            const resolved = await resolvePhotoDataUrl(u);
            if (resolved) {
              // cobre o quadrado mantendo "crop" simples (jsPDF não faz object-fit; aqui só encaixa)
              try {
                doc.addImage(resolved.dataUrl, resolved.mime.includes("png") ? "PNG" : "JPEG", x + 1, y + 1, thumb - 2, thumb - 2);
              } catch {
                doc.setFontSize(8);
                doc.setTextColor(120);
                doc.text("Imagem indisponível", x + 2, y + 8, { maxWidth: thumb - 4 });
              }
            } else {
              doc.setFontSize(8);
              doc.setTextColor(120);
              doc.text("Imagem indisponível", x + 2, y + 8, { maxWidth: thumb - 4 });
            }

            x += thumb + gap;
            col += 1;
          }
          y += thumb + 8;
        } else {
          ensureSpace(6);
          doc.setFontSize(10);
          doc.setTextColor(90);
          doc.text("Fotos: —", marginX, y);
          y += 8;
        }

        // separador
        doc.setDrawColor(220);
        doc.line(marginX, y, marginX + maxW, y);
        y += 8;
      }

      const filename = `auditoria-${safeFilename(unidade)}-${safeFilename(setor)}-${r.data_auditoria}.pdf`;
      doc.save(filename);
      toast.success("PDF exportado");
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível exportar o PDF.");
    } finally {
      setExportingId(null);
    }
  }

  return data.length === 0 ? (
    <p className="py-8 text-center text-sm text-zinc-500">Nenhuma auditoria cadastrada.</p>
  ) : (
    <ul className="divide-y divide-zinc-800">
      {data.map((r) => (
        <li
          key={r.id}
          className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-medium text-white">
              {r.unidade?.nome ?? "—"} · {r.setor?.nome ?? "—"}
            </p>
            <p className="text-xs text-zinc-500">
              {new Date(r.data_auditoria + "T12:00:00").toLocaleDateString("pt-BR")}
              {r.horario_abertura ? ` · ${formatTime24(r.horario_abertura)}` : ""} · {statusLabel[r.status]}
              {r.status === "concluida" && formatDoneTime(r.concluida_em)
                ? ` · concluída ${formatDoneTime(r.concluida_em)}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/checklist/${r.id}`}
              className="inline-flex rounded-xl bg-fire-yellow px-4 py-2 text-center text-sm font-semibold text-zinc-950 hover:bg-amber-400"
            >
              Abrir checklist
            </Link>
            <button
              type="button"
              onClick={() => void handleExportOne(r)}
              disabled={exportingId === r.id}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-fire-red px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
            >
              {exportingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Exportar PDF
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

