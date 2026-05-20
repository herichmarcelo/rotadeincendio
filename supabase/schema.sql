-- Rota de Incêndio — execute no SQL Editor do Supabase
-- Habilita extensão para UUID
create extension if not exists "uuid-ossp";

-- Auditores
create table if not exists public.auditores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null unique,
  user_id uuid,
  perfil text not null default 'auditor' check (perfil in ('auditor', 'super_admin')),
  unidade_id uuid,
  setor_id uuid,
  dia_vistoria text,
  horario_vistoria text,
  created_at timestamptz not null default now()
);

-- Compatibilidade: caso a tabela já exista em projetos antigos
alter table public.auditores add column if not exists user_id uuid;
alter table public.auditores add column if not exists perfil text;
alter table public.auditores add column if not exists unidade_id uuid;
alter table public.auditores add column if not exists setor_id uuid;
alter table public.auditores add column if not exists dia_vistoria text;
alter table public.auditores add column if not exists horario_vistoria text;
create index if not exists idx_auditores_user_id on public.auditores (user_id);
create index if not exists idx_auditores_unidade_id on public.auditores (unidade_id);
create index if not exists idx_auditores_setor_id on public.auditores (setor_id);

-- Unidades e setores
create table if not exists public.unidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.setores (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades (id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_setores_unidade on public.setores (unidade_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'auditores_unidade_id_fkey') then
    alter table public.auditores
      add constraint auditores_unidade_id_fkey foreign key (unidade_id)
      references public.unidades (id) on delete restrict;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'auditores_setor_id_fkey') then
    alter table public.auditores
      add constraint auditores_setor_id_fkey foreign key (setor_id)
      references public.setores (id) on delete restrict;
  end if;
end $$;

-- Auditorias
create table if not exists public.auditorias (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades (id) on delete restrict,
  setor_id uuid not null references public.setores (id) on delete restrict,
  auditor_id uuid not null references public.auditores (id) on delete restrict,
  data_auditoria date not null,
  horario_abertura time,
  aberta_em timestamptz,
  concluida_em timestamptz,
  parecer_atraso text,
  parecer_atraso_em timestamptz,
  parecer_atraso_auditor_id uuid references public.auditores (id) on delete set null,
  status text not null check (status in ('pendente', 'concluida', 'vencida')),
  created_at timestamptz not null default now()
);

alter table public.auditorias add column if not exists horario_abertura time;
alter table public.auditorias add column if not exists concluida_em timestamptz;
alter table public.auditorias add column if not exists aberta_em timestamptz;
alter table public.auditorias add column if not exists parecer_atraso text;
alter table public.auditorias add column if not exists parecer_atraso_em timestamptz;
alter table public.auditorias add column if not exists parecer_atraso_auditor_id uuid;

create index if not exists idx_auditorias_unidade on public.auditorias (unidade_id);
create index if not exists idx_auditorias_setor on public.auditorias (setor_id);
create index if not exists idx_auditorias_data on public.auditorias (data_auditoria);
create index if not exists idx_auditorias_status on public.auditorias (status);

-- Checklist
create table if not exists public.checklist_itens (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

-- Saída do Galpão (registro de itens que saem)
create table if not exists public.saidas_galpao (
  id uuid primary key default gen_random_uuid(),
  auditor_id uuid references public.auditores (id) on delete set null,
  auditoria_id uuid references public.auditorias (id) on delete set null,
  unidade_id uuid references public.unidades (id) on delete set null,
  setor_id uuid references public.setores (id) on delete set null,
  comprador_nome text not null,
  comprador_documento text,
  veiculo_placa text,
  observacao text,
  created_at timestamptz not null default now()
);

create table if not exists public.saidas_galpao_itens (
  id uuid primary key default gen_random_uuid(),
  saida_id uuid not null references public.saidas_galpao (id) on delete cascade,
  item_id uuid references public.checklist_itens (id) on delete set null,
  item_titulo_snapshot text not null,
  quantidade int not null default 1 check (quantidade > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_saidas_galpao_created_at on public.saidas_galpao (created_at desc);
create index if not exists idx_saidas_galpao_auditoria on public.saidas_galpao (auditoria_id);
create index if not exists idx_saidas_galpao_itens_saida on public.saidas_galpao_itens (saida_id);

create table if not exists public.checklist_respostas (
  id uuid primary key default gen_random_uuid(),
  auditoria_id uuid not null references public.auditorias (id) on delete cascade,
  item_id uuid not null references public.checklist_itens (id) on delete cascade,
  conforme boolean not null default false,
  nao_conforme boolean not null default false,
  vezes_ocorridas int not null default 0,
  observacao text,
  fotos text[] not null default '{}',
  unique (auditoria_id, item_id)
);

create index if not exists idx_respostas_auditoria on public.checklist_respostas (auditoria_id);

-- Itens iniciais (idempotente por título)
insert into public.checklist_itens (titulo, ordem)
select v.titulo, v.ordem
from (
  values
    ('Luzes acesas sem necessidade', 1),
    ('Vazamento de água', 2),
    ('Mangueira de ar aberta', 3),
    ('Uso de EPIs', 4),
    ('Cheiros estranhos', 5),
    ('Ruídos anormais', 6),
    ('Vibrações', 7)
) as v(titulo, ordem)
where not exists (
  select 1 from public.checklist_itens c where c.titulo = v.titulo
);

-- Storage: bucket público para previews (ajuste RLS do Storage no painel se necessário)
insert into storage.buckets (id, name, public)
values ('checklist-fotos', 'checklist-fotos', true)
on conflict (id) do nothing;

-- RLS
alter table public.auditores enable row level security;
alter table public.unidades enable row level security;
alter table public.setores enable row level security;
alter table public.auditorias enable row level security;
alter table public.checklist_itens enable row level security;
alter table public.checklist_respostas enable row level security;
alter table public.saidas_galpao enable row level security;
alter table public.saidas_galpao_itens enable row level security;

-- Políticas: usuários autenticados (Supabase Auth) com acesso total
-- Ajuste conforme seu modelo de permissões.

-- Idempotência: ao re-executar o script, remova policies antigas com o mesmo nome.
drop policy if exists "auth_all_auditores" on public.auditores;
drop policy if exists "auth_all_unidades" on public.unidades;
drop policy if exists "auth_all_setores" on public.setores;
drop policy if exists "auth_all_auditorias" on public.auditorias;
drop policy if exists "auditorias_select_scoped" on public.auditorias;
drop policy if exists "auditorias_insert_scoped" on public.auditorias;
drop policy if exists "auditorias_update_scoped" on public.auditorias;
drop policy if exists "auditorias_delete_scoped" on public.auditorias;
drop policy if exists "respostas_select_scoped" on public.checklist_respostas;
drop policy if exists "respostas_insert_scoped" on public.checklist_respostas;
drop policy if exists "respostas_update_scoped" on public.checklist_respostas;
drop policy if exists "respostas_delete_scoped" on public.checklist_respostas;
drop policy if exists "auth_read_checklist_itens" on public.checklist_itens;
drop policy if exists "auth_all_checklist_respostas" on public.checklist_respostas;
drop policy if exists "auth_all_saidas_galpao" on public.saidas_galpao;
drop policy if exists "auth_all_saidas_galpao_itens" on public.saidas_galpao_itens;
drop policy if exists "storage_checklist_fotos_insert" on storage.objects;
drop policy if exists "storage_checklist_fotos_select" on storage.objects;
drop policy if exists "storage_checklist_fotos_update" on storage.objects;
drop policy if exists "storage_checklist_fotos_delete" on storage.objects;
drop policy if exists "storage_checklist_fotos_public_read" on storage.objects;

create policy "auth_all_auditores" on public.auditores
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth_all_unidades" on public.unidades
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth_all_setores" on public.setores
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Funções auxiliares para RLS (super admin vs auditor comum)
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin', false)
    or exists (
      select 1
      from public.auditores a
      where (
        a.user_id = auth.uid()
        or lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
      and a.perfil = 'super_admin'
    );
$$;

create or replace function public.my_auditor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.id
  from public.auditores a
  where a.user_id = auth.uid()
     or lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

create policy "auditorias_select_scoped" on public.auditorias
  for select using (
    auth.role() = 'authenticated'
    and (public.is_super_admin() or auditor_id = public.my_auditor_id())
  );

create policy "auditorias_insert_scoped" on public.auditorias
  for insert with check (
    auth.role() = 'authenticated'
    and (public.is_super_admin() or auditor_id = public.my_auditor_id())
  );

create policy "auditorias_update_scoped" on public.auditorias
  for update using (
    auth.role() = 'authenticated'
    and (public.is_super_admin() or auditor_id = public.my_auditor_id())
  );

create policy "auditorias_delete_scoped" on public.auditorias
  for delete using (
    auth.role() = 'authenticated'
    and (public.is_super_admin() or auditor_id = public.my_auditor_id())
  );

create policy "auth_read_checklist_itens" on public.checklist_itens
  for select using (auth.role() = 'authenticated');

create policy "respostas_select_scoped" on public.checklist_respostas
  for select using (
    auth.role() = 'authenticated'
    and (
      public.is_super_admin()
      or exists (
        select 1
        from public.auditorias au
        where au.id = checklist_respostas.auditoria_id
          and au.auditor_id = public.my_auditor_id()
      )
    )
  );

create policy "respostas_insert_scoped" on public.checklist_respostas
  for insert with check (
    auth.role() = 'authenticated'
    and (
      public.is_super_admin()
      or exists (
        select 1
        from public.auditorias au
        where au.id = checklist_respostas.auditoria_id
          and au.auditor_id = public.my_auditor_id()
      )
    )
  );

create policy "respostas_update_scoped" on public.checklist_respostas
  for update using (
    auth.role() = 'authenticated'
    and (
      public.is_super_admin()
      or exists (
        select 1
        from public.auditorias au
        where au.id = checklist_respostas.auditoria_id
          and au.auditor_id = public.my_auditor_id()
      )
    )
  );

create policy "respostas_delete_scoped" on public.checklist_respostas
  for delete using (
    auth.role() = 'authenticated'
    and (
      public.is_super_admin()
      or exists (
        select 1
        from public.auditorias au
        where au.id = checklist_respostas.auditoria_id
          and au.auditor_id = public.my_auditor_id()
      )
    )
  );

create policy "auth_all_saidas_galpao" on public.saidas_galpao
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth_all_saidas_galpao_itens" on public.saidas_galpao_itens
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Storage: upload/leitura para usuários autenticados
create policy "storage_checklist_fotos_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'checklist-fotos');

create policy "storage_checklist_fotos_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'checklist-fotos');

create policy "storage_checklist_fotos_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'checklist-fotos');

create policy "storage_checklist_fotos_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'checklist-fotos');

-- Bucket público: leitura anônima dos objetos (para preview com URL pública)
create policy "storage_checklist_fotos_public_read"
  on storage.objects for select to anon
  using (bucket_id = 'checklist-fotos');
