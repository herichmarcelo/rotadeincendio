"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { RelatorioSemana, StatusVisita } from "@/services/relatorio";
import { formatDateBR } from "@/lib/utils";

interface Props {
  relatorio: RelatorioSemana;
}

// ─── Helpers de cor RGB por status ───────────────────────────────────────────
function rowFill(s: StatusVisita): [number, number, number] {
  if (s === "concluida") return [209, 250, 229]; // verde claro
  if (s === "vencida")   return [254, 226, 226]; // vermelho claro
  return [244, 244, 245];                        // cinza claro
}
function rowText(s: StatusVisita): [number, number, number] {
  if (s === "concluida") return [6, 78, 59];   // verde escuro
  if (s === "vencida")   return [127, 29, 29]; // vermelho escuro
  return [82, 82, 91];                         // cinza escuro
}
function dotColor(s: StatusVisita): [number, number, number] {
  if (s === "concluida") return [34, 197, 94];  // verde
  if (s === "vencida")   return [239, 68, 68];  // vermelho
  return [161, 161, 170];                       // cinza
}
function statusText(s: StatusVisita): string {
  if (s === "concluida") return "OK";
  if (s === "vencida")   return "NAO";
  return "-";
}
function barFill(pct: number): [number, number, number] {
  if (pct >= 80) return [34, 197, 94];
  if (pct >= 50) return [245, 158, 11];
  return [239, 68, 68];
}

// ─── Desenha um ícone de status no PDF ───────────────────────────────────────
// Usa círculo preenchido + texto branco (sem emoji = sem encoding bug)
function drawStatusIcon(
  doc: import("jspdf").jsPDF,
  x: number,
  y: number,
  status: StatusVisita
) {
  const [r, g, b] = dotColor(status);
  const radius = 2.8;
  // Círculo
  doc.setFillColor(r, g, b);
  doc.circle(x, y, radius, "F");
  // Texto dentro do círculo
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  const label = statusText(status);
  doc.text(label, x, y + 1, { align: "center" });
}

export function ExportarRelatorioBtn({ relatorio }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      toast.info("Gerando PDF do relatório operacional…");

      const { jsPDF } = await import("jspdf");
      const autoTableMod = await import("jspdf-autotable");
      const autoTable = (
        autoTableMod as unknown as {
          default: (doc: unknown, opts: unknown) => void;
        }
      ).default;

      // ── Documento: landscape A4 ──────────────────────────────────────────
      const doc = new jsPDF({ orientation: "l", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();  // 297mm
      const pageH = doc.internal.pageSize.getHeight(); // 210mm
      const mx = 10;

      // ── CABEÇALHO (barra vermelha) ───────────────────────────────────────
      const RED: [number, number, number] = [180, 30, 30];
      doc.setFillColor(...RED);
      doc.rect(0, 0, pageW, 20, "F");

      // Título
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("RELATORIO DE STATUS OPERACIONAL", mx, 9);

      // Subtítulo (nome da unidade)
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(255, 200, 200);
      doc.text(relatorio.unidadeNome.toUpperCase(), mx, 15);

      // Semana + geração (direita)
      doc.setFontSize(8);
      doc.setTextColor(255, 220, 220);
      const rangeLabel = `Semana: ${formatDateBR(relatorio.semanaInicio)} - ${formatDateBR(relatorio.semanaFim)}`;
      const geradoLabel = `Gerado em: ${new Date().toLocaleString("pt-BR")}`;
      doc.text(`${rangeLabel}   |   ${geradoLabel}`, pageW - mx, 9, { align: "right" });

      // ── CARDS DE SETOR ────────────────────────────────────────────────────
      const setores = relatorio.setores;
      const count = Math.max(setores.length, 1);
      const gapCard = 5;
      const cardW = (pageW - mx * 2 - gapCard * (count - 1)) / count;
      const cardTop = 25;

      const ROW_H = 8;
      const HEADER_H = 14;
      const FOOTER_H = 16;
      const maxRows = Math.max(...setores.map((s) => s.visitas.length), 1);
      const bodyH = maxRows * ROW_H;
      const cardH = HEADER_H + bodyH + FOOTER_H;

      for (let i = 0; i < setores.length; i++) {
        const setor = setores[i]!;
        const cx = mx + i * (cardW + gapCard);

        // Fundo branco do card
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(210, 210, 220);
        doc.roundedRect(cx, cardTop, cardW, cardH, 3, 3, "FD");

        // ── Cabeçalho do card (vermelho) ──────────────────────────────────
        doc.setFillColor(...RED);
        doc.roundedRect(cx, cardTop, cardW, HEADER_H, 3, 3, "F");
        doc.rect(cx, cardTop + 7, cardW, HEADER_H - 7, "F"); // apaga arredondamento inferior

        // Nome do setor
        doc.setFontSize(9.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(setor.setorNome.toUpperCase(), cx + 4, cardTop + 7);

        // Sub-labels: DATA e STATUS no canto direito do header
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(255, 200, 200);
        const semIni = relatorio.semanaInicio.match(/\d{4}-(\d{2})-(\d{2})/);
        const semFim = relatorio.semanaFim.match(/\d{4}-(\d{2})-(\d{2})/);
        const semLabel =
          semIni && semFim
            ? `Semana: ${semIni[2]}/${semIni[1]}-${semFim[2]}/${semFim[1]}`
            : "";
        doc.text(semLabel, cx + 4, cardTop + 12);

        // Rótulos de coluna alinhados à direita
        doc.setTextColor(255, 220, 220);
        doc.text("DATA", cx + cardW - 22, cardTop + 7);
        doc.text("STATUS", cx + cardW - 4, cardTop + 7, { align: "right" });

        // ── Linhas de visita ──────────────────────────────────────────────
        let rowY = cardTop + HEADER_H;

        if (setor.visitas.length === 0) {
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(160, 160, 170);
          doc.text(
            "Sem auditorias na semana",
            cx + cardW / 2,
            rowY + (bodyH / 2) + 3,
            { align: "center" }
          );
        } else {
          for (const v of setor.visitas) {
            const [fr, fg, fb] = rowFill(v.status);
            const [tr, tg, tb] = rowText(v.status);

            // Fundo da linha
            doc.setFillColor(fr, fg, fb);
            doc.rect(cx, rowY, cardW, ROW_H, "F");

            // Separador
            doc.setDrawColor(220, 220, 230);
            doc.setLineWidth(0.2);
            doc.line(cx, rowY, cx + cardW, rowY);
            doc.setLineWidth(0.2);

            // Barra colorida de status na esquerda (3px)
            const [br, bg, bb] = dotColor(v.status);
            doc.setFillColor(br, bg, bb);
            doc.rect(cx, rowY, 3, ROW_H, "F");

            // Horário
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(tr, tg, tb);
            doc.text(v.horario ?? "--", cx + 6, rowY + 5.5);

            // Data
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.text(formatDateBR(v.data), cx + cardW - 22, rowY + 5.5);

            // Ícone de status (círculo + texto, sem emoji)
            drawStatusIcon(doc, cx + cardW - 5, rowY + 4, v.status);

            rowY += ROW_H;
          }
        }

        // ── Rodapé: % Frigorífico ─────────────────────────────────────────
        const footerY = cardTop + HEADER_H + bodyH;

        // Fundo cinza claro do rodapé
        doc.setFillColor(248, 248, 252);
        doc.rect(cx, footerY, cardW, FOOTER_H, "F");

        // Linha separadora
        doc.setDrawColor(200, 200, 210);
        doc.line(cx, footerY, cx + cardW, footerY);

        // Label
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(130, 130, 140);
        doc.text("FRIGORIFICO EM FUNCIONAMENTO", cx + 4, footerY + 5.5);

        // Percentual
        const pct = setor.percentualConcluido;
        const [pfr, pfg, pfb] = barFill(pct);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(pfr, pfg, pfb);
        doc.text(`${pct}%`, cx + cardW - 4, footerY + 5.5, { align: "right" });

        // Barra de progresso
        const barY = footerY + 9;
        const barW = cardW - 8;
        doc.setFillColor(220, 220, 230);
        doc.roundedRect(cx + 4, barY, barW, 3.5, 1.5, 1.5, "F");
        if (pct > 0) {
          doc.setFillColor(pfr, pfg, pfb);
          doc.roundedRect(cx + 4, barY, (barW * pct) / 100, 3.5, 1.5, 1.5, "F");
        }

        // Borda do card (por cima)
        doc.setDrawColor(210, 210, 220);
        doc.setFillColor(0, 0, 0, 0);
        doc.roundedRect(cx, cardTop, cardW, cardH, 3, 3, "D");
      }

      // ── TABELA RESUMO (autoTable) ─────────────────────────────────────────
      const tableY = cardTop + cardH + 6;
      if (tableY < pageH - 22) {
        autoTable(doc, {
          startY: tableY,
          head: [["Setor", "Total de visitas", "Concluidas", "Vencidas / Pendentes", "% Funcionamento"]],
          body: setores.map((s) => {
            const ok = s.visitas.filter((v) => v.status === "concluida").length;
            const nao = s.visitas.length - ok;
            return [s.setorNome, s.visitas.length, ok, nao, `${s.percentualConcluido}%`];
          }),
          styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 30, 40] },
          headStyles: { fillColor: RED, textColor: [255, 255, 255], fontStyle: "bold" },
          alternateRowStyles: { fillColor: [248, 248, 252] },
          margin: { left: mx, right: mx },
        });
      }

      // ── RODAPÉ DA PÁGINA ──────────────────────────────────────────────────
      doc.setDrawColor(...RED);
      doc.setLineWidth(0.8);
      doc.line(mx, pageH - 8, pageW - mx, pageH - 8);
      doc.setLineWidth(0.2);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(160, 160, 170);
      doc.text(
        "Sistema Rota de Incendio - Documento Confidencial",
        pageW / 2,
        pageH - 4,
        { align: "center" }
      );

      // ── Salvar ────────────────────────────────────────────────────────────
      const slug = relatorio.unidadeNome
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-");
      doc.save(`relatorio-${slug}-${relatorio.semanaInicio}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch (e) {
      console.error(e);
      toast.error("Nao foi possivel gerar o PDF.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleExport()}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl bg-fire-red px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-60 transition-colors"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      Exportar PDF
    </button>
  );
}
