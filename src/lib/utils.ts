import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Valor `time` do Postgres (ex.: "14:30:00") → "14:30" para exibição 24h. */
export function formatTime24(value: string | null | undefined): string {
  if (!value) return "—";
  const m = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return value;
  return `${m[1]!.padStart(2, "0")}:${m[2]}`;
}

/** Data local no formato YYYY-MM-DD (evita o adiantamento de dia de toISOString em fusos como UTC-3). */
export function getLocalDateISO(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Formata data YYYY-MM-DD para DD/MM/YYYY com segurança sem fuso. */
export function formatDateBR(value: string | null | undefined): string {
  if (!value) return "—";
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return `${m[3]}/${m[2]}/${m[1]}`;
  }
  return new Date(value + "T12:00:00").toLocaleDateString("pt-BR");
}

const DIAS_SEMANA_NOMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

export function getDiaSemanaAtual(date: Date = new Date()): string {
  return DIAS_SEMANA_NOMES[date.getDay()] ?? "";
}
