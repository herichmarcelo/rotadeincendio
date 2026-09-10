"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getErrorMessage } from "@/lib/errors";
import { getSessionAccess } from "@/lib/sessionAccess";
import { createAuditoria, initialStatusForDate } from "@/services/auditorias";
import { getAuditorForCurrentUser } from "@/services/auditores";
import { listUnidades, listSetores } from "@/services/unidades";
import { getLocalDateISO } from "@/lib/utils";
import type { Auditor, Unidade, Setor } from "@/types/database";
import { Card } from "@/components/ui/Card";

export default function NovaAuditoriaPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [meuAuditor, setMeuAuditor] = useState<Auditor | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [unidadeNome, setUnidadeNome] = useState<string | null>(null);
  const [setorNome, setSetorNome] = useState<string | null>(null);
  const [unidadeId, setUnidadeId] = useState("");
  const [setorId, setSetorId] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [boot, setBoot] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [access, auditor] = await Promise.all([
          getSessionAccess(supabase),
          getAuditorForCurrentUser(supabase),
        ]);

        setIsSuperAdmin(access.isSuperAdmin);
        setMeuAuditor(auditor);

        if (!auditor) {
          toast.error("Seu usuário não está vinculado a um auditor. Peça ao super admin para cadastrar seu acesso.");
          return;
        }

        if (!access.isSuperAdmin) {
          if (!auditor.unidade_id || !auditor.setor_id) {
            toast.error("Seu auditor não tem Unidade/Setor definidos. Peça ao super admin para atualizar seu cadastro.");
            return;
          }

          setUnidadeId(auditor.unidade_id);
          setSetorId(auditor.setor_id);

          const [{ data: unidade }, { data: setor }] = await Promise.all([
            supabase.from("unidades").select("nome").eq("id", auditor.unidade_id).maybeSingle(),
            supabase.from("setores").select("nome").eq("id", auditor.setor_id).maybeSingle(),
          ]);

          setUnidadeNome(unidade?.nome ?? null);
          setSetorNome(setor?.nome ?? null);
          return;
        }

        const u = await listUnidades(supabase);
        setUnidades(u);
        if (u[0]) setUnidadeId(u[0].id);
      } catch (e) {
        console.error(e);
        toast.error("Erro ao carregar dados");
      } finally {
        setBoot(false);
      }
    })();
  }, [supabase]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    if (!unidadeId) {
      setSetores([]);
      setSetorId("");
      return;
    }
    void listSetores(supabase, unidadeId)
      .then((s) => {
        setSetores(s);
        setSetorId(s[0]?.id ?? "");
      })
      .catch(() => {});
  }, [supabase, unidadeId, isSuperAdmin]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!meuAuditor) {
      toast.error("Não é possível criar auditoria sem perfil de auditor vinculado.");
      return;
    }
    if (!unidadeId || !setorId) {
      toast.error("Preencha unidade e setor.");
      return;
    }
    
    setLoading(true);
    
    try {
      // Captura o momento EXATO em que o usuário clica em salvar (usando a data local segura)
      const agora = new Date();
      
      const dataAuditoria = getLocalDateISO(agora);
      
      const hh = String(agora.getHours()).padStart(2, "0");
      const mm = String(agora.getMinutes()).padStart(2, "0");
      const ss = String(agora.getSeconds()).padStart(2, "0");
      const horarioAbertura = `${hh}:${mm}:${ss}`;
      
      const abertaEm = agora.toISOString();
      const status = initialStatusForDate(dataAuditoria);

      await createAuditoria(supabase, {
        unidade_id: unidadeId,
        setor_id: setorId,
        auditor_id: meuAuditor.id,
        data_auditoria: dataAuditoria,
        horario_abertura: horarioAbertura,
        aberta_em: abertaEm,
        status,
      });
      
      toast.success("Auditoria criada");
      router.push("/auditorias");
      router.refresh();
    } catch (err: unknown) {
      console.error("createAuditoria failed", err);
      toast.error(getErrorMessage(err, "Erro ao criar"));
    } finally {
      setLoading(false);
    }
  }

  if (boot) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        href="/auditorias"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-white">Nova auditoria</h1>
        <p className="text-sm text-zinc-400">
          Defina local da auditoria. A data e hora serão registradas automaticamente no momento da criação para segurança do checklist.
        </p>
      </div>

      {meuAuditor?.dia_vistoria && (
        <div className="flex items-center gap-3 rounded-2xl border border-fire-red/30 bg-fire-red/10 p-3.5 text-xs text-zinc-300">
          <CalendarClock className="h-5 w-5 shrink-0 text-fire-yellow" />
          <div>
            <p className="font-semibold text-white">Rotina Semanal Programada</p>
            <p className="text-zinc-400">
              Sua escala fixa é: <span className="text-zinc-200">{`Toda ${meuAuditor.dia_vistoria} às ${meuAuditor.horario_vistoria || "16:00"}`}</span>
            </p>
          </div>
        </div>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSuperAdmin ? (
            <>
              <label className="block text-sm">
                <span className="text-zinc-500">Unidade</span>
                <select
                  required
                  value={unidadeId}
                  onChange={(e) => setUnidadeId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm"
                >
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-zinc-500">Setor</span>
                <select
                  required
                  value={setorId}
                  onChange={(e) => setSetorId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm"
                >
                  {setores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <div className="block text-sm">
                <span className="text-zinc-500">Unidade</span>
                <div className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900/40 px-3 py-2.5 text-sm text-zinc-200">
                  {unidadeNome ?? "—"}
                </div>
              </div>
              <div className="block text-sm">
                <span className="text-zinc-500">Setor</span>
                <div className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900/40 px-3 py-2.5 text-sm text-zinc-200">
                  {setorNome ?? "—"}
                </div>
              </div>
            </>
          )}
          <div className="block text-sm">
            <span className="text-zinc-500">Auditor</span>
            <div className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900/40 px-3 py-2.5 text-sm text-zinc-200">
              {meuAuditor ? meuAuditor.nome : "— (vincule seu usuário a um cadastro de auditor)"}
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading || !meuAuditor}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-fire-red py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60 mt-4"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar e Iniciar Auditoria
          </button>
          
          <p className="text-xs text-center text-zinc-500 mt-2">
            A data e o horário atual serão gravados automaticamente ao confirmar.
          </p>
        </form>
      </Card>
    </div>
  );
}