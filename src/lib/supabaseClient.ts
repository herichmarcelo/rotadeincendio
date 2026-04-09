import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

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

  // Evita corrida de locks do GoTrue em dev/StrictMode e durante HMR,
  // garantindo uma única instância do client no browser.
  const g = globalThis as unknown as { __ri_supabase_browser__?: SupabaseClient };
  if (!g.__ri_supabase_browser__) {
    g.__ri_supabase_browser__ = createBrowserClient(url, key);
  }
  return g.__ri_supabase_browser__;
}
