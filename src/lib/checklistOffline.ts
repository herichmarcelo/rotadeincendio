import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChecklistItem } from "@/types/database";
import { upsertResposta } from "@/services/checklist";
import { updateAuditoria } from "@/services/auditorias";
import { uploadImage } from "@/services/cloudinary";

const QUEUE_KEY = "checklist-offline-queue-v1";
const ITENS_CACHE_KEY = "checklist-itens-cache-v1";
const DRAFT_PREFIX = "checklist-draft-v1-";

export type RespostaPayload = {
  conforme: boolean;
  nao_conforme: boolean;
  vezes_ocorridas: number;
  observacao: string | null;
  fotos: string[];
};

export type OfflineQueue = Record<
  string,
  {
    respostas: Record<string, RespostaPayload>;
    concluir?: boolean;
  }
>;

const OFFLINE_PREFIX = "offline:";

export function isOfflinePhotoRef(url: string): boolean {
  return url.startsWith(OFFLINE_PREFIX);
}

export function offlinePhotoId(url: string): string {
  return url.slice(OFFLINE_PREFIX.length);
}

const DB_NAME = "rota-incendio-checklist";
const DB_VERSION = 1;
const STORE = "blobs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

export async function putOfflineBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getOfflineBlob(id: string): Promise<Blob | undefined> {
  const db = await openDb();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return blob;
}

export async function deleteOfflineBlob(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function loadQueue(): OfflineQueue {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as OfflineQueue;
  } catch {
    return {};
  }
}

function saveQueue(q: OfflineQueue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function queueUpsert(auditoriaId: string, itemId: string, payload: RespostaPayload) {
  const q = loadQueue();
  if (!q[auditoriaId]) q[auditoriaId] = { respostas: {} };
  q[auditoriaId].respostas[itemId] = payload;
  saveQueue(q);
}

export function queueConcluir(auditoriaId: string, respostas: Record<string, RespostaPayload>) {
  const q = loadQueue();
  if (!q[auditoriaId]) q[auditoriaId] = { respostas: {} };
  q[auditoriaId].respostas = { ...q[auditoriaId].respostas, ...respostas };
  q[auditoriaId].concluir = true;
  saveQueue(q);
}

export function clearAuditoriaFromQueue(auditoriaId: string) {
  const q = loadQueue();
  delete q[auditoriaId];
  saveQueue(q);
}

export function hasPendingForAuditoria(auditoriaId: string): boolean {
  const q = loadQueue();
  return Boolean(q[auditoriaId] && Object.keys(q[auditoriaId].respostas).length > 0);
}

export function countPendingOps(): number {
  const q = loadQueue();
  return Object.keys(q).length;
}

async function resolveFotosForUpload(fotos: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const ref of fotos) {
    if (!isOfflinePhotoRef(ref)) {
      out.push(ref);
      continue;
    }
    const id = offlinePhotoId(ref);
    const blob = await getOfflineBlob(id);
    if (!blob) {
      throw new Error(`Foto offline não encontrada (${id}).`);
    }
    const ext = blob.type.split("/")[1] || "jpg";
    const file = new File([blob], `foto.${ext}`, { type: blob.type || "image/jpeg" });
    const url = await uploadImage(file);
    await deleteOfflineBlob(id);
    out.push(url);
  }
  return out;
}

/** Envia fila pendente desta auditoria (e opcionalmente conclui). */
export async function syncAuditoriaQueue(supabase: SupabaseClient, auditoriaId: string): Promise<void> {
  const q = loadQueue();
  const block = q[auditoriaId];
  if (!block || Object.keys(block.respostas).length === 0) return;

  for (const [itemId, payload] of Object.entries(block.respostas)) {
    const fotos = await resolveFotosForUpload(payload.fotos);
    await upsertResposta(supabase, {
      auditoria_id: auditoriaId,
      item_id: itemId,
      conforme: payload.conforme,
      nao_conforme: payload.nao_conforme,
      vezes_ocorridas: payload.vezes_ocorridas,
      observacao: payload.observacao,
      fotos,
    });
  }

  if (block.concluir) {
    await updateAuditoria(supabase, auditoriaId, { status: "concluida" });
  }

  clearAuditoriaFromQueue(auditoriaId);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("checklist-synced", { detail: { auditoriaId } }));
  }
}

/** Sincroniza todas as auditorias na fila (ex.: ao voltar a internet). */
export async function syncAllPendingQueues(supabase: SupabaseClient): Promise<{ failures: string[] }> {
  const q = loadQueue();
  const ids = Object.keys(q);
  const failures: string[] = [];
  for (const auditoriaId of ids) {
    try {
      await syncAuditoriaQueue(supabase, auditoriaId);
    } catch (e) {
      console.error(e);
      failures.push(auditoriaId);
    }
  }
  return { failures };
}

export function cacheChecklistItens(itens: ChecklistItem[]) {
  try {
    localStorage.setItem(ITENS_CACHE_KEY, JSON.stringify(itens));
  } catch {
    /* quota */
  }
}

export function getCachedChecklistItens(): ChecklistItem[] | null {
  try {
    const raw = localStorage.getItem(ITENS_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ChecklistItem[];
  } catch {
    return null;
  }
}

export function draftKey(auditoriaId: string) {
  return `${DRAFT_PREFIX}${auditoriaId}`;
}

export function loadDraft(auditoriaId: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(draftKey(auditoriaId));
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function saveDraft(auditoriaId: string, data: unknown) {
  try {
    localStorage.setItem(draftKey(auditoriaId), JSON.stringify(data));
  } catch {
    /* quota */
  }
}

export function clearDraft(auditoriaId: string) {
  localStorage.removeItem(draftKey(auditoriaId));
}

export type LineStateLike = {
  conforme: boolean;
  nao_conforme: boolean;
  vezes_ocorridas: number;
  observacao: string;
  fotos: string[];
};

/** Mescla rascunho local sobre o estado vindo do servidor (mesmas chaves de item). */
export function mergeDraftIntoState<T extends LineStateLike>(
  base: Record<string, T>,
  draft: Record<string, T> | null
): Record<string, T> {
  if (!draft) return base;
  const out: Record<string, T> = { ...base };
  for (const [k, v] of Object.entries(draft)) {
    if (!out[k]) continue;
    out[k] = {
      ...out[k],
      conforme: v.conforme ?? out[k].conforme,
      nao_conforme: v.nao_conforme ?? out[k].nao_conforme,
      vezes_ocorridas: v.vezes_ocorridas ?? out[k].vezes_ocorridas,
      observacao: v.observacao ?? out[k].observacao,
      fotos: Array.isArray(v.fotos) ? v.fotos : out[k].fotos,
    };
  }
  return out;
}
