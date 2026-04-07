"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export function NavigationLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 380);
    return () => window.clearTimeout(t);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center pt-3"
      aria-hidden
    >
      <div className="flex items-center gap-2 rounded-full border border-fire-red/40 bg-zinc-950/90 px-4 py-2 text-sm text-zinc-100 shadow-lg backdrop-blur-md">
        <Loader2 className="h-4 w-4 animate-spin text-fire-yellow" />
        <span>Carregando…</span>
      </div>
    </div>
  );
}
