import { AuditoresClient } from "./AuditoresClient";

export default function AuditoresPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Auditores</h1>
        <p className="text-sm text-zinc-400">Cadastro e gestão da equipe de auditoria.</p>
      </div>
      <AuditoresClient />
    </div>
  );
}
