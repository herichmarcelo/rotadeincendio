import { AuditoriasClient } from "./AuditoriasClient";

export default function AuditoriasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Auditorias</h1>
        <p className="text-sm text-zinc-400">Planeje rotas, acompanhe status e filtros por local.</p>
      </div>
      <AuditoriasClient />
    </div>
  );
}
