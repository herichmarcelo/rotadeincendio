"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Calendar as CalendarIcon,
  Check,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { getLocalDateISO } from "@/lib/utils";

interface Props {
  semanaInicio: string; // YYYY-MM-DD
  semanaFim: string;    // YYYY-MM-DD
  isCurrentWeek?: boolean;
  isCustomRange?: boolean;
}

/** Formata data YYYY-MM-DD para DD/MM */
function formatShortDate(iso: string): string {
  const m = iso.match(/\d{4}-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[2]}/${m[1]}`;
}

/** Formata intervalo como "04/09 a 09/09" */
function formatRangeLabel(inicio: string, fim: string): string {
  return `${formatShortDate(inicio)} a ${formatShortDate(fim)}`;
}

/** Retorna a data no formato YYYY-MM-DD somando ou subtraindo dias */
function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Retorna a diferença em dias entre duas datas */
function getDaysDiff(inicio: string, fim: string): number {
  const d1 = new Date(inicio + "T12:00:00").getTime();
  const d2 = new Date(fim + "T12:00:00").getTime();
  return Math.max(1, Math.round(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
}

/** Retorna a segunda-feira da semana de uma data */
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

export function DashboardSemanaNav({
  semanaInicio,
  semanaFim,
  isCurrentWeek,
  isCustomRange,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isOpen, setIsOpen] = useState(false);
  const [tempInicio, setTempInicio] = useState(semanaInicio);
  const [tempFim, setTempFim] = useState(semanaFim);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sincronizar inputs quando as props mudarem
  useEffect(() => {
    setTempInicio(semanaInicio);
    setTempFim(semanaFim);
  }, [semanaInicio, semanaFim]);

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const applyRange = useCallback(
    (inicio: string, fim: string) => {
      const params = new URLSearchParams(searchParams.toString());
      // Limpa parâmetro legado de semana única para evitar conflito
      params.delete("semana");
      params.set("dataInicio", inicio);
      params.set("dataFim", fim);
      router.push(`${pathname}?${params.toString()}`);
      setIsOpen(false);
    },
    [router, pathname, searchParams]
  );

  const applySemana = useCallback(
    (semanaRef: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("dataInicio");
      params.delete("dataFim");
      params.set("semana", semanaRef);
      router.push(`${pathname}?${params.toString()}`);
      setIsOpen(false);
    },
    [router, pathname, searchParams]
  );

  // Navegação anterior / próximo pelo mesmo tamanho de intervalo
  const daysSpan = getDaysDiff(semanaInicio, semanaFim);

  const goPrev = () => {
    const novoFim = addDays(semanaInicio, -1);
    const novoInicio = addDays(novoFim, -(daysSpan - 1));
    applyRange(novoInicio, novoFim);
  };

  const goNext = () => {
    const novoInicio = addDays(semanaFim, 1);
    const novoFim = addDays(novoInicio, daysSpan - 1);
    applyRange(novoInicio, novoFim);
  };

  // ── Atalhos Rápidos ──
  const setEstaSemana = () => {
    const hoje = new Date();
    applySemana(getLocalDateISO(hoje));
  };

  const setSemanaPassada = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    applySemana(getLocalDateISO(d));
  };

  const setUltimos7Dias = () => {
    const hoje = new Date();
    const fim = getLocalDateISO(hoje);
    const ini = addDays(fim, -6);
    applyRange(ini, fim);
  };

  const setUltimos15Dias = () => {
    const hoje = new Date();
    const fim = getLocalDateISO(hoje);
    const ini = addDays(fim, -14);
    applyRange(ini, fim);
  };

  const setEsteMes = () => {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = agora.getMonth();
    const primeiroDia = `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
    const ultimoDiaDate = new Date(ano, mes + 1, 0);
    const ultimoDia = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(ultimoDiaDate.getDate()).padStart(2, "0")}`;
    applyRange(primeiroDia, ultimoDia);
  };

  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempInicio || !tempFim) return;
    if (tempInicio > tempFim) {
      applyRange(tempFim, tempInicio);
    } else {
      applyRange(tempInicio, tempFim);
    }
  };

  return (
    <div className="relative flex items-center gap-1.5" ref={popoverRef}>
      {/* Botão anterior */}
      <button
        type="button"
        onClick={goPrev}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700 hover:text-white transition-colors"
        title="Período anterior"
        aria-label="Período anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Botão do seletor de data (abre dropdown/popover) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 rounded-lg border px-3 h-8 transition-colors ${
          isOpen
            ? "border-fire-red bg-zinc-800 text-white shadow-sm ring-1 ring-fire-red/50"
            : "border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-700/80"
        }`}
        title="Clique para escolher o período (ex: de 04/09 a 09/09)"
      >
        <CalendarDays className="h-3.5 w-3.5 text-fire-red shrink-0" />
        <span className="text-xs font-semibold tabular-nums whitespace-nowrap">
          {formatRangeLabel(semanaInicio, semanaFim)}
        </span>

        {isCurrentWeek && !isCustomRange ? (
          <span className="rounded-full bg-fire-red/20 px-1.5 py-0.5 text-[9px] font-bold text-fire-red uppercase tracking-wide">
            Atual
          </span>
        ) : isCustomRange ? (
          <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-400 uppercase tracking-wide">
            {daysSpan}d
          </span>
        ) : null}
      </button>

      {/* Botão próximo */}
      <button
        type="button"
        onClick={goNext}
        disabled={Boolean(isCurrentWeek && !isCustomRange)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title="Próximo período"
        aria-label="Próximo período"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {/* ── Popover de seleção de data ── */}
      {isOpen && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4 text-fire-red" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                Filtrar por Período
              </span>
            </div>
            <span className="text-[10px] text-zinc-400">
              {daysSpan} {daysSpan === 1 ? "dia" : "dias"} selecionados
            </span>
          </div>

          {/* Formulário personalizado De / Até */}
          <form onSubmit={handleSubmitCustom} className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold uppercase text-zinc-400 mb-1">
                  De (Início)
                </label>
                <input
                  type="date"
                  value={tempInicio}
                  onChange={(e) => setTempInicio(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-white focus:border-fire-red focus:outline-none focus:ring-1 focus:ring-fire-red"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-zinc-400 mb-1">
                  Até (Fim)
                </label>
                <input
                  type="date"
                  value={tempFim}
                  onChange={(e) => setTempFim(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-white focus:border-fire-red focus:outline-none focus:ring-1 focus:ring-fire-red"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-fire-red py-2 text-xs font-bold text-white hover:bg-fire-red/90 transition-colors shadow-sm"
            >
              <Check className="h-3.5 w-3.5" />
              Aplicar Período
            </button>
          </form>

          {/* Atalhos rápidos */}
          <div className="mt-3 pt-3 border-t border-zinc-800">
            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase text-zinc-400 mb-2">
              <Sparkles className="h-3 w-3 text-amber-400" />
              <span>Atalhos Rápidos</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={setEstaSemana}
                className="flex items-center justify-center rounded-md border border-zinc-750 bg-zinc-800/80 px-2 py-1.5 text-[11px] font-medium text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700 hover:text-white transition-colors"
              >
                Esta Semana
              </button>
              <button
                type="button"
                onClick={setSemanaPassada}
                className="flex items-center justify-center rounded-md border border-zinc-750 bg-zinc-800/80 px-2 py-1.5 text-[11px] font-medium text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700 hover:text-white transition-colors"
              >
                Semana Anterior
              </button>
              <button
                type="button"
                onClick={setUltimos7Dias}
                className="flex items-center justify-center rounded-md border border-zinc-750 bg-zinc-800/80 px-2 py-1.5 text-[11px] font-medium text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700 hover:text-white transition-colors"
              >
                Últimos 7 dias
              </button>
              <button
                type="button"
                onClick={setUltimos15Dias}
                className="flex items-center justify-center rounded-md border border-zinc-750 bg-zinc-800/80 px-2 py-1.5 text-[11px] font-medium text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700 hover:text-white transition-colors"
              >
                Últimos 15 dias
              </button>
              <button
                type="button"
                onClick={setEsteMes}
                className="col-span-2 flex items-center justify-center rounded-md border border-zinc-750 bg-zinc-800/80 px-2 py-1.5 text-[11px] font-medium text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700 hover:text-white transition-colors"
              >
                Este Mês Completo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
