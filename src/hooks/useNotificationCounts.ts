"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { syncAuditoriaStatuses } from "@/services/auditorias";

/** Alertas: auditorias vencidas + rotas (pendentes). */
export function useNotificationCounts() {
  const [vencidas, setVencidas] = useState(0);
  const [pendentes, setPendentes] = useState(0);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    async function load() {
      try {
        await syncAuditoriaStatuses(supabase);
        const [v, p] = await Promise.all([
          supabase.from("auditorias").select("id", { count: "exact", head: true }).eq("status", "vencida"),
          supabase.from("auditorias").select("id", { count: "exact", head: true }).eq("status", "pendente"),
        ]);
        if (!cancelled) {
          setVencidas(v.count ?? 0);
          setPendentes(p.count ?? 0);
        }
      } catch {
        if (!cancelled) {
          setVencidas(0);
          setPendentes(0);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const badgeTotal = vencidas + pendentes;
  return { vencidas, pendentes, badgeTotal };
}
