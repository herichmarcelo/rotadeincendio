"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { Unidade } from "@/types/database";

interface Props {
  unidades: Unidade[];
  currentUnidadeId: string | null;
}

export function DashboardUnidadeFilter({ unidades, currentUnidadeId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = useCallback(
    (unidadeId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (unidadeId) {
        params.set("unidadeId", unidadeId);
      } else {
        params.delete("unidadeId");
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  if (unidades.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-zinc-400 shrink-0">
        Unidade:
      </span>
      <div className="flex flex-wrap gap-1.5">
        {unidades.map((u) => {
          const active = u.id === currentUnidadeId;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => handleChange(u.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                active
                  ? "bg-fire-red text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
              }`}
            >
              {u.nome}
            </button>
          );
        })}
      </div>
    </div>
  );
}
