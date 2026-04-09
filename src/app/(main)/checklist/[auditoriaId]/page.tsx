import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatTime24 } from "@/lib/utils";
import { getAuditoria } from "@/services/auditorias";
import { ChecklistFillClient } from "./ChecklistFillClient";

type Props = { params: Promise<{ auditoriaId: string }> };

export default async function ChecklistAuditoriaPage({ params }: Props) {
  const { auditoriaId } = await params;
  const supabase = await createSupabaseServerClient();
  let auditoria;
  try {
    auditoria = await getAuditoria(supabase, auditoriaId);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href="/checklist"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-white">Rota de Incêndio</h1>
        <p className="text-sm text-zinc-400">
          {auditoria.unidade?.nome ?? "—"} · {auditoria.setor?.nome ?? "—"} ·{" "}
          {new Date(auditoria.data_auditoria + "T12:00:00").toLocaleDateString("pt-BR")}
          {auditoria.horario_abertura ? ` · ${formatTime24(auditoria.horario_abertura)}` : ""}
        </p>
      </div>
      <ChecklistFillClient
        auditoriaId={auditoria.id}
        auditoriaStatus={auditoria.status}
        abertaEm={auditoria.aberta_em ?? null}
        parecerAtraso={auditoria.parecer_atraso ?? null}
      />
    </div>
  );
}
