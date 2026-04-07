"use client";

import { Toaster } from "sonner";
import { ChecklistSyncListener } from "@/components/checklist/ChecklistSyncListener";
import { NavigationLoader } from "@/components/ui/NavigationLoader";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ChecklistSyncListener />
      <NavigationLoader />
      {children}
      <Toaster
        richColors
        position="top-center"
        toastOptions={{
          classNames: {
            toast: "font-sans border border-zinc-700/80 bg-zinc-900 text-zinc-100 shadow-xl",
          },
        }}
      />
    </>
  );
}
