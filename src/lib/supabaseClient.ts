import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para uso em Client Components.
 * Mantém sessão via cookies (configurado pelo middleware).
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórias.");
  }
  return createBrowserClient(url, key);
}
