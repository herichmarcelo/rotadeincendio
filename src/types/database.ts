export type AuditoriaStatus = "pendente" | "concluida" | "vencida";

export interface Auditor {
  id: string;
  nome: string;
  email: string;
  /** Link opcional ao usuário do Supabase Auth (auth.users.id) */
  user_id?: string | null;
  /** Perfil (auditor ou super_admin) persistido no banco */
  perfil?: "auditor" | "super_admin" | null;
  unidade_id?: string | null;
  setor_id?: string | null;
  /** Rotina fixa (opcional para compatibilidade com dados antigos) */
  dia_vistoria?: string | null;
  horario_vistoria?: string | null; // HH:mm
  created_at: string;
}

export interface Unidade {
  id: string;
  nome: string;
  created_at: string;
}

export interface Setor {
  id: string;
  unidade_id: string;
  nome: string;
  created_at: string;
}

export interface Auditoria {
  id: string;
  unidade_id: string;
  setor_id: string;
  auditor_id: string;
  data_auditoria: string;
  /** Horário de abertura da auditoria (24h), ex.: "14:30:00" vindo do Postgres */
  horario_abertura?: string | null;
  /** Timestamp (timestamptz) real de abertura da auditoria. */
  aberta_em?: string | null;
  /** Timestamp (timestamptz) de quando foi concluída. */
  concluida_em?: string | null;
  /** Parecer/justificativa caso passe do prazo (6h) e atrase. */
  parecer_atraso?: string | null;
  /** Timestamp (timestamptz) de quando o parecer foi registrado. */
  parecer_atraso_em?: string | null;
  /** Auditor que registrou o parecer. */
  parecer_atraso_auditor_id?: string | null;
  status: AuditoriaStatus;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  titulo: string;
  ordem: number;
  created_at: string;
}

export interface ChecklistResposta {
  id: string;
  auditoria_id: string;
  item_id: string;
  conforme: boolean;
  nao_conforme: boolean;
  vezes_ocorridas: number;
  observacao: string | null;
  fotos: string[] | null;
}

export interface DashboardStats {
  totalRealizadas: number;
  vencidas: number;
  locaisAvaliados: number;
  naoConformidades: number;
  pendentes: number;
}
