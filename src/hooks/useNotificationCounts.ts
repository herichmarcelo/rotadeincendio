"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getSessionAccess } from "@/lib/sessionAccess";
import { syncAuditoriaStatuses } from "@/services/auditorias";

/** Alertas: auditorias vencidas + pendentes (escopo do usuário logado). */
export function useNotificationCounts() {
  const [vencidas, setVencidas] = useState(0);
  const [pendentes, setPendentes] = useState(0);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    async function load() {
      try {
        await syncAuditoriaStatuses(supabase);
        const access = await getSessionAccess(supabase);

        if (!access.isSuperAdmin && !access.auditorId) {
          if (!cancelled) {
            setVencidas(0);
            setPendentes(0);
          }
          return;
        }

        let vQuery = supabase
          .from("auditorias")
          .select("id", { count: "exact", head: true })
          .eq("status", "vencida");
        let pQuery = supabase
          .from("auditorias")
          .select("id", { count: "exact", head: true })
          .eq("status", "pendente");

        if (!access.isSuperAdmin && access.auditorId) {
          vQuery = vQuery.eq("auditor_id", access.auditorId);
          pQuery = pQuery.eq("auditor_id", access.auditorId);
        }

        const [v, p] = await Promise.all([vQuery, pQuery]);
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
