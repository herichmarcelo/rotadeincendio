import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-950 to-fire-dark px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(183,28,28,0.22),_transparent_55%)]" />
      <Suspense
        fallback={
          <div className="relative z-10 flex min-h-[320px] w-full max-w-md items-center justify-center text-zinc-500">
            Carregando…
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
