"use client";

import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { countPendingOps, syncAllPendingQueues } from "@/lib/checklistOffline";

/** Sincroniza fila offline quando a conexão volta (qualquer tela). */
export function ChecklistSyncListener() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  useEffect(() => {
    const run = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      const before = countPendingOps();
      if (before === 0) return;
      try {
        const { failures } = await syncAllPendingQueues(supabase);
        const after = countPendingOps();
        if (before > after) {
          toast.success("Dados do checklist enviados ao servidor.");
        }
        if (failures.length > 0) {
          toast.error("Alguns itens não puderam ser sincronizados. Tente de novo.");
        }
      } catch (e) {
        console.error(e);
        toast.error("Erro ao sincronizar checklist pendente.");
      }
    };

    void run();
    const onOnline = () => void run();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [supabase]);

  return null;
}
