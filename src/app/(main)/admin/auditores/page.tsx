import { Shield } from "lucide-react";
import { SuperAdminAuditoresClient } from "./SuperAdminAuditoresClient";

export default function SuperAdminAuditoresPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Central do Super Admin</h1>
          <p className="text-sm text-zinc-400">
            Gestão de usuários (auditores) e rotina fixa de auditoria.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-xl border border-fire-red/40 bg-fire-red/15 px-3 py-2 text-xs font-semibold text-fire-yellow">
          <Shield className="h-4 w-4" />
          Restrito
        </span>
      </div>

      <SuperAdminAuditoresClient />
    </div>
  );
}

