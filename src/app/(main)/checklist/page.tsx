import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listAuditorias } from "@/services/auditorias";
import { Card } from "@/components/ui/Card";
import { formatTime24 } from "@/lib/utils";
import type { AuditoriaStatus } from "@/types/database";

type Row = {
  id: string;
  data_auditoria: string;
  horario_abertura?: string | null;
  status: AuditoriaStatus;
  unidade: { nome: string } | null;
  setor: { nome: string } | null;
};

const statusLabel: Record<AuditoriaStatus, string> = {
  pendente: "Pendente",
  concluida: "Concluída",
  vencida: "Vencida",
};

export default async function ChecklistIndexPage() {
  const supabase = await createSupabaseServerClient();
  const data = (await listAuditorias(supabase)) as Row[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Checklist</h1>
        <p className="text-sm text-zinc-400">
          Escolha uma auditoria para preencher a Rota de Incêndio e anexar fotos.
        </p>
      </div>
      <Card>
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">Nenhuma auditoria cadastrada.</p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {data.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-white">
                    {r.unidade?.nome ?? "—"} · {r.setor?.nome ?? "—"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {new Date(r.data_auditoria + "T12:00:00").toLocaleDateString("pt-BR")}
                    {r.horario_abertura ? ` · ${formatTime24(r.horario_abertura)}` : ""} ·{" "}
                    {statusLabel[r.status]}
                  </p>
                </div>
                <Link
                  href={`/checklist/${r.id}`}
                  className="inline-flex rounded-xl bg-fire-yellow px-4 py-2 text-center text-sm font-semibold text-zinc-950 hover:bg-amber-400"
                >
                  Abrir checklist
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
