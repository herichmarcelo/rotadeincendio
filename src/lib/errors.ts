export function getErrorMessage(err: unknown, fallback = "Erro"): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;

  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = typeof e.message === "string" ? e.message : undefined;
    const details = typeof e.details === "string" ? e.details : undefined;
    const hint = typeof e.hint === "string" ? e.hint : undefined;
    const code = typeof e.code === "string" ? e.code : undefined;
    const errorDescription =
      typeof e.error_description === "string" ? e.error_description : undefined;

    const parts = [msg ?? errorDescription, details, hint, code ? `(${code})` : undefined].filter(
      Boolean
    ) as string[];
    if (parts.length) return parts.join(" ");
  }

  return fallback;
}

