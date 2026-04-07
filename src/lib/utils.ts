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
