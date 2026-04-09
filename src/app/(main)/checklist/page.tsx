import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listAuditorias } from "@/services/auditorias";
import { Card } from "@/components/ui/Card";
import { ChecklistIndexClient, type ChecklistIndexRow } from "./ChecklistIndexClient";

export default async function ChecklistIndexPage() {
  const supabase = await createSupabaseServerClient();
  const data = (await listAuditorias(supabase)) as ChecklistIndexRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Checklist</h1>
        <p className="text-sm text-zinc-400">
          Escolha uma auditoria para preencher a Rota de Incêndio e anexar fotos.
        </p>
      </div>
      <Card>
        <ChecklistIndexClient data={data} />
      </Card>
    </div>
  );
}
