import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionAccess } from "@/lib/sessionAccess";
import { getLocalDateISO } from "@/lib/utils";

export type StatusVisita = "concluida" | "vencida" | "pendente" | "ausente";

export interface VisitaRow {
  auditoriaId: string | null;
  data: string; // YYYY-MM-DD
  horario: string | null; // HH:mm
  status: StatusVisita;
}

export interface SetorRelatorio {
  setorId: string;
  setorNome: string;
  visitas: VisitaRow[];
  /** Percentual (0-100) de visitas concluídas na semana */
  percentualConcluido: number;
}

export interface RelatorioSemana {
  unidadeId: string;
  unidadeNome: string;
  semanaInicio: string; // YYYY-MM-DD
  semanaFim: string;   // YYYY-MM-DD
  isCustomRange?: boolean;
  setores: SetorRelatorio[];
}

/** Retorna a segunda-feira da semana que contém `date` */
function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Dom
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** YYYY-MM-DD de Date sem fuso */
function toISO(d: Date): string {
  return getLocalDateISO(d);
}

/**
 * Busca o relatório de status operacional para uma unidade em um período.
 * Pode receber um intervalo flexível (dataInicio e dataFim) ou uma semanaRef.
 *
 * @param supabase        cliente autenticado
 * @param unidadeId       UUID da unidade
 * @param semanaRef       data de referência da semana (opcional)
 * @param dataInicioParam data inicial customizada YYYY-MM-DD (opcional)
 * @param dataFimParam    data final customizada YYYY-MM-DD (opcional)
 */
export async function getRelatorioSemana(
  supabase: SupabaseClient,
  unidadeId: string,
  semanaRef?: string,
  dataInicioParam?: string,
  dataFimParam?: string
): Promise<RelatorioSemana | null> {
  const access = await getSessionAccess(supabase);
  if (!access.isSuperAdmin && !access.auditorId) return null;

  let semanaInicio: string;
  let semanaFim: string;
  let isCustomRange = false;

  if (dataInicioParam && dataFimParam) {
    // Range customizado (ex: 04/09 a 09/09)
    isCustomRange = true;
    if (dataInicioParam <= dataFimParam) {
      semanaInicio = dataInicioParam;
      semanaFim = dataFimParam;
    } else {
      semanaInicio = dataFimParam;
      semanaFim = dataInicioParam;
    }
  } else if (dataInicioParam) {
    isCustomRange = true;
    semanaInicio = dataInicioParam;
    semanaFim = dataInicioParam;
  } else {
    // Calcular range padrão da semana (segunda → domingo)
    const ref = semanaRef ? new Date(semanaRef + "T12:00:00") : new Date();
    const monday = getMondayOf(ref);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    semanaInicio = toISO(monday);
    semanaFim = toISO(sunday);
  }

  // Buscar nome da unidade
  const { data: unidade, error: uErr } = await supabase
    .from("unidades")
    .select("id, nome")
    .eq("id", unidadeId)
    .maybeSingle();
  if (uErr) throw uErr;
  if (!unidade) return null;

  // Buscar setores da unidade
  const { data: setores, error: sErr } = await supabase
    .from("setores")
    .select("id, nome")
    .eq("unidade_id", unidadeId)
    .order("nome");
  if (sErr) throw sErr;

  // Buscar auditorias da semana para a unidade
  let audQ = supabase
    .from("auditorias")
    .select("id, setor_id, data_auditoria, horario_abertura, status")
    .eq("unidade_id", unidadeId)
    .gte("data_auditoria", semanaInicio)
    .lte("data_auditoria", semanaFim)
    .order("data_auditoria", { ascending: true })
    .order("horario_abertura", { ascending: true });

  // auditor comum: só suas auditorias
  if (!access.isSuperAdmin && access.auditorId) {
    audQ = audQ.eq("auditor_id", access.auditorId);
  }

  const { data: auditorias, error: aErr } = await audQ;
  if (aErr) throw aErr;

  // Montar estrutura por setor
  const setoresResult: SetorRelatorio[] = (setores ?? []).map((setor) => {
    const visitasDoSetor = (auditorias ?? [])
      .filter((a) => a.setor_id === setor.id)
      .map<VisitaRow>((a) => ({
        auditoriaId: a.id,
        data: a.data_auditoria as string,
        horario: a.horario_abertura
          ? String(a.horario_abertura).slice(0, 5)
          : null,
        status: a.status as StatusVisita,
      }));

    const total = visitasDoSetor.length;
    const concluidas = visitasDoSetor.filter((v) => v.status === "concluida").length;
    const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0;

    return {
      setorId: setor.id as string,
      setorNome: setor.nome as string,
      visitas: visitasDoSetor,
      percentualConcluido: percentual,
    };
  });

  return {
    unidadeId: unidade.id as string,
    unidadeNome: unidade.nome as string,
    semanaInicio,
    semanaFim,
    isCustomRange,
    setores: setoresResult,
  };
}
