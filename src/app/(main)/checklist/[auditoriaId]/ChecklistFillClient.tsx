"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle, Loader2, RefreshCw, Save, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { AuditoriaStatus, ChecklistItem, ChecklistResposta } from "@/types/database";
import { updateAuditoria } from "@/services/auditorias";
import { listChecklistItens, listRespostasPorAuditoria, upsertResposta } from "@/services/checklist";
import UploadFoto from "@/components/checklist/UploadFoto";
import { Card } from "@/components/ui/Card";
import {
  cacheChecklistItens,
  clearDraft,
  getCachedChecklistItens,
  getOfflineBlob,
  hasPendingForAuditoria,
  isOfflinePhotoRef,
  loadDraft,
  mergeDraftIntoState,
  offlinePhotoId,
  queueConcluir,
  queueUpsert,
  type RespostaPayload,
  saveDraft,
  syncAuditoriaQueue,
} from "@/lib/checklistOffline";

type LineState = {
  conforme: boolean;
  nao_conforme: boolean;
  vezes_ocorridas: number;
  observacao: string;
  fotos: string[];
};

function buildState(
  itens: ChecklistItem[],
  respostas: ChecklistResposta[]
): Record<string, LineState> {
  const map: Record<string, LineState> = {};
  const byItem = new Map(respostas.map((r) => [r.item_id, r]));
  for (const it of itens) {
    const r = byItem.get(it.id);
    map[it.id] = {
      conforme: r?.conforme ?? false,
      nao_conforme: r?.nao_conforme ?? false,
      vezes_ocorridas: r?.vezes_ocorridas ?? 0,
      observacao: r?.observacao ?? "",
      fotos: r?.fotos ?? [],
    };
  }
  return map;
}

function toPayload(line: LineState): RespostaPayload {
  return {
    conforme: line.conforme,
    nao_conforme: line.nao_conforme,
    vezes_ocorridas: line.vezes_ocorridas,
    observacao: line.observacao || null,
    fotos: line.fotos,
  };
}

function FotoThumbOffline({
  url,
  onRemove,
  readOnly,
}: {
  url: string;
  onRemove: () => void;
  readOnly: boolean;
}) {
  const [blobSrc, setBlobSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      const blob = await getOfflineBlob(offlinePhotoId(url));
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setBlobSrc(objectUrl);
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (!blobSrc) {
    return (
      <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-950 px-1 text-center text-[10px] text-zinc-500">
        Carregando…
      </div>
    );
  }
  return (
    <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={blobSrc} alt="" className="h-full w-full object-cover" />
      {!readOnly && (
        <button
          type="button"
          className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-[10px] text-white"
          onClick={onRemove}
        >
          ✕
        </button>
      )}
    </div>
  );
}

function FotoThumb({
  url,
  onRemove,
  readOnly,
}: {
  url: string;
  onRemove: () => void;
  readOnly: boolean;
}) {
  if (isOfflinePhotoRef(url)) {
    return <FotoThumbOffline url={url} onRemove={onRemove} readOnly={readOnly} />;
  }

  return (
    <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
      <Image src={url} alt="" fill className="object-cover" sizes="96px" />
      {!readOnly && (
        <button
          type="button"
          className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-[10px] text-white"
          onClick={onRemove}
        >
          ✕
        </button>
      )}
    </div>
  );
}

export function ChecklistFillClient({
  auditoriaId,
  auditoriaStatus,
}: {
  auditoriaId: string;
  auditoriaStatus: AuditoriaStatus;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [itens, setItens] = useState<ChecklistItem[]>([]);
  const [state, setState] = useState<Record<string, LineState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(true);
  const [pendingLocal, setPendingLocal] = useState(false);

  const readOnly = auditoriaStatus === "concluida";

  useEffect(() => {
    const sync = () => {
      setOnline(typeof navigator !== "undefined" && navigator.onLine);
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, respostas] = await Promise.all([
        listChecklistItens(supabase),
        listRespostasPorAuditoria(supabase, auditoriaId),
      ]);
      cacheChecklistItens(list);
      setItens(list);
      let next = buildState(list, respostas);
      const draft = loadDraft(auditoriaId) as Record<string, LineState> | null;
      if (draft) next = mergeDraftIntoState(next, draft);
      setState(next);
    } catch (e) {
      console.error(e);
      const cached = getCachedChecklistItens();
      if (!cached?.length) {
        toast.error("Sem conexão. Abra o checklist com internet uma vez para carregar os itens.");
        return;
      }
      const draft = loadDraft(auditoriaId) as Record<string, LineState> | null;
      setItens(cached);
      const empty = buildState(cached, []);
      setState(draft ? mergeDraftIntoState(empty, draft) : empty);
      toast.info("Modo offline: dados em cache e rascunho local.");
    } finally {
      setLoading(false);
      setPendingLocal(hasPendingForAuditoria(auditoriaId));
    }
  }, [supabase, auditoriaId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onSynced = (e: Event) => {
      const ce = e as CustomEvent<{ auditoriaId: string }>;
      if (ce.detail?.auditoriaId !== auditoriaId) return;
      setPendingLocal(hasPendingForAuditoria(auditoriaId));
      router.refresh();
      void load();
    };
    window.addEventListener("checklist-synced", onSynced as EventListener);
    return () => window.removeEventListener("checklist-synced", onSynced as EventListener);
  }, [auditoriaId, load, router]);

  useEffect(() => {
    if (loading || itens.length === 0 || readOnly) return;
    const t = setTimeout(() => {
      saveDraft(auditoriaId, state);
    }, 500);
    return () => clearTimeout(t);
  }, [state, auditoriaId, loading, itens.length, readOnly]);

  function updateLine(itemId: string, patch: Partial<LineState>) {
    setState((prev) => {
      const cur = prev[itemId];
      if (!cur) return prev;
      return { ...prev, [itemId]: { ...cur, ...patch } };
    });
  }

  async function saveLine(itemId: string) {
    if (readOnly) return;
    const cur = state[itemId];
    if (!cur) return;
    setSaving(itemId);
    try {
      const payload = toPayload(cur);
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        queueUpsert(auditoriaId, itemId, payload);
        saveDraft(auditoriaId, state);
        setPendingLocal(true);
        toast.success("Item guardado no aparelho (pendente de envio)");
        return;
      }
      await upsertResposta(supabase, {
        auditoria_id: auditoriaId,
        item_id: itemId,
        conforme: cur.conforme,
        nao_conforme: cur.nao_conforme,
        vezes_ocorridas: cur.vezes_ocorridas,
        observacao: cur.observacao || null,
        fotos: cur.fotos,
      });
      toast.success("Item salvo");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(null);
    }
  }

  async function handleSyncNow() {
    if (!online) {
      toast.error("Conecte-se à internet para sincronizar.");
      return;
    }
    setSyncing(true);
    try {
      await syncAuditoriaQueue(supabase, auditoriaId);
      clearDraft(auditoriaId);
      setPendingLocal(false);
      router.refresh();
      await load();
      toast.success("Sincronizado com o servidor.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  async function concluirAuditoria() {
    if (readOnly) return;
    setClosing(true);
    try {
      const respostas: Record<string, RespostaPayload> = {};
      for (const it of itens) {
        respostas[it.id] = toPayload(state[it.id]);
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        queueConcluir(auditoriaId, respostas);
        saveDraft(auditoriaId, state);
        setPendingLocal(true);
        toast.success("Auditoria concluída no aparelho. Envio automático quando houver internet.");
        return;
      }

      for (const it of itens) {
        const cur = state[it.id];
        await upsertResposta(supabase, {
          auditoria_id: auditoriaId,
          item_id: it.id,
          conforme: cur.conforme,
          nao_conforme: cur.nao_conforme,
          vezes_ocorridas: cur.vezes_ocorridas,
          observacao: cur.observacao || null,
          fotos: cur.fotos,
        });
      }
      await updateAuditoria(supabase, auditoriaId, { status: "concluida" });
      clearDraft(auditoriaId);
      toast.success("Auditoria concluída e enviada.");
      router.push("/auditorias");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao concluir");
    } finally {
      setClosing(false);
    }
  }

  function adicionarFoto(itemId: string, url: string) {
    if (readOnly) return;
    const cur = state[itemId];
    if (!cur) return;
    updateLine(itemId, { fotos: [...cur.fotos, url] });
    toast.success(isOfflinePhotoRef(url) ? "Foto guardada localmente" : "Foto enviada");
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-10 w-10 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {online ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-400">
              <Wifi className="h-4 w-4" />
              Online
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-amber-400">
              <WifiOff className="h-4 w-4" />
              Sem internet — respostas ficam no aparelho
            </span>
          )}
          {pendingLocal && (
            <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200">
              Pendente de envio
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {pendingLocal && online && (
            <button
              type="button"
              onClick={() => void handleSyncNow()}
              disabled={syncing}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-600 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
            >
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sincronizar agora
            </button>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={() => void concluirAuditoria()}
              disabled={closing || itens.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              {closing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              Concluir auditoria
            </button>
          )}
        </div>
      </div>

      {readOnly && (
        <p className="rounded-xl border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-400">
          Esta auditoria está concluída. Os itens são somente leitura.
        </p>
      )}

      {itens.map((it) => {
        const line = state[it.id];
        if (!line) return null;
        return (
          <Card key={it.id} className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <h3 className="text-sm font-semibold text-white">{it.titulo}</h3>
              <button
                type="button"
                onClick={() => void saveLine(it.id)}
                disabled={readOnly || saving === it.id}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-fire-red px-3 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-60"
              >
                {saving === it.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar item
              </button>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={line.conforme}
                  disabled={readOnly}
                  onChange={() => {
                    const next = !line.conforme;
                    updateLine(it.id, {
                      conforme: next,
                      nao_conforme: next ? false : line.nao_conforme,
                    });
                  }}
                  className="rounded border-zinc-600"
                />
                <span className="text-zinc-300">Conforme</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={line.nao_conforme}
                  disabled={readOnly}
                  onChange={() => {
                    const next = !line.nao_conforme;
                    updateLine(it.id, {
                      nao_conforme: next,
                      conforme: next ? false : line.conforme,
                    });
                  }}
                  className="rounded border-zinc-600"
                />
                <span className="text-zinc-300">Não conforme</span>
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-zinc-500">Vezes ocorridas</span>
              <input
                type="number"
                min={0}
                disabled={readOnly}
                value={line.vezes_ocorridas}
                onChange={(e) => updateLine(it.id, { vezes_ocorridas: Number(e.target.value) || 0 })}
                className="mt-1 w-full max-w-[120px] rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">Observação</span>
              <textarea
                value={line.observacao}
                disabled={readOnly}
                onChange={(e) => updateLine(it.id, { observacao: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </label>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Fotos</p>
              <div className="flex flex-wrap gap-3">
                {line.fotos.map((url, idx) => (
                  <FotoThumb
                    key={`${url}-${idx}`}
                    url={url}
                    readOnly={readOnly}
                    onRemove={() =>
                      updateLine(it.id, {
                        fotos: line.fotos.filter((_, i) => i !== idx),
                      })
                    }
                  />
                ))}
                <UploadFoto disabled={readOnly} onUpload={(url) => adicionarFoto(it.id, url)} />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
