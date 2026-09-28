"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

interface Props {
  semanaInicio: string; // YYYY-MM-DD (segunda-feira atual)
  semanaFim: string;    // YYYY-MM-DD (domingo atual)
  isCurrentWeek: boolean;
}

function formatRange(inicio: string, fim: string): string {
  const [, im, id] = inicio.match(/\d{4}-(\d{2})-(\d{2})/) ?? [];
  const [, fm, fd] = fim.match(/\d{4}-(\d{2})-(\d{2})/) ?? [];
  if (id && im && fd && fm) return `${id}/${im} – ${fd}/${fm}`;
  return `${inicio} – ${fim}`;
}

/** Soma `days` dias a uma data YYYY-MM-DD sem fuso */
function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DashboardSemanaNav({ semanaInicio, semanaFim, isCurrentWeek }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigate = useCallback(
    (newSemana: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("semana", newSemana);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const goPrev = () => navigate(addDays(semanaInicio, -7));
  const goNext = () => navigate(addDays(semanaInicio, 7));

  return (
    <div className="flex items-center gap-2">
      {/* Botão semana anterior */}
      <button
        type="button"
        onClick={goPrev}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700 hover:text-white transition-colors"
        aria-label="Semana anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Rótulo da semana */}
      <div className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 h-8">
        <CalendarDays className="h-3.5 w-3.5 text-fire-red shrink-0" />
        <span className="text-xs font-semibold text-zinc-200 tabular-nums whitespace-nowrap">
          {formatRange(semanaInicio, semanaFim)}
        </span>
        {isCurrentWeek && (
          <span className="ml-1 rounded-full bg-fire-red/20 px-1.5 py-0.5 text-[9px] font-bold text-fire-red uppercase tracking-wide">
            Atual
          </span>
        )}
      </div>

      {/* Botão próxima semana (desabilitado se for a semana atual) */}
      <button
        type="button"
        onClick={goNext}
        disabled={isCurrentWeek}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Próxima semana"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
