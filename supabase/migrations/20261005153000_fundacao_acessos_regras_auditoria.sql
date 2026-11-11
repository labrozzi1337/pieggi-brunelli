-- Fundacao transversal do sistema: acesso por empresa, papeis, regras versionadas e auditoria.
-- Autenticacao permanece no Supabase Auth; a aplicacao acessa estas tabelas somente pelo backend.

create table if not exists pieggi.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default current_timestamp,
  atualizado_em timestamptz not null default current_timestamp
);

create table if not exists pieggi.usuario_empresas (
  usuario_id uuid not null references pieggi.usuarios(id) on delete cascade,
  empresa_id uuid not null references pieggi.fiscal_empresas(id) on delete cascade,
  criado_em timestamptz not null default current_timestamp,
  primary key (usuario_id, empresa_id)
);

create table if not exists pieggi.usuario_papeis (
  usuario_id uuid not null references pieggi.usuarios(id) on delete cascade,
  papel text not null check (papel in (
    'ADMIN', 'COMERCIAL', 'ATENDIMENTO', 'FINANCEIRO', 'PROGRAMACAO',
    'PRODUCAO', 'EXPEDICAO_COMPRAS', 'CAMPO'
  )),
  criado_em timestamptz not null default current_timestamp,
  primary key (usuario_id, papel)
);

create table if not exists pieggi.regras_negocio (
  id uuid primary key,
  codigo text not null,
  versao integer not null check (versao > 0),
  titulo text not null,
  descricao text not null,
  origem text not null,
  status text not null check (status in ('APROVADA', 'PENDENTE', 'CONFLITANTE', 'REVOGADA')),
  escopo jsonb not null default '{}'::jsonb,
  vigente_desde timestamptz not null,
  vigente_ate timestamptz,
  substitui_regra_id uuid references pieggi.regras_negocio(id),
  criado_por uuid references pieggi.usuarios(id),
  criado_em timestamptz not null default current_timestamp,
  atualizado_em timestamptz not null default current_timestamp,
  unique (codigo, versao),
  check (vigente_ate is null or vigente_ate > vigente_desde)
);

create table if not exists pieggi.auditoria_eventos (
  id uuid primary key,
  empresa_id uuid references pieggi.fiscal_empresas(id) on delete set null,
  usuario_id uuid references pieggi.usuarios(id) on delete set null,
  acao text not null,
  entidade text not null,
  entidade_id text,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default current_timestamp
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fiscal_itens_documento_produto_fk'
      and conrelid = 'pieggi.fiscal_itens_documento'::regclass
  ) then
    alter table pieggi.fiscal_itens_documento
      add constraint fiscal_itens_documento_produto_fk
      foreign key (produto_id) references pieggi.fiscal_produtos(id) on delete set null;
  end if;
end
$$;

create index if not exists usuario_empresas_empresa_idx
  on pieggi.usuario_empresas (empresa_id, usuario_id);
create index if not exists regras_negocio_vigencia_idx
  on pieggi.regras_negocio (codigo, status, vigente_desde desc);
create index if not exists auditoria_eventos_entidade_idx
  on pieggi.auditoria_eventos (entidade, entidade_id, criado_em desc);
create index if not exists auditoria_eventos_empresa_idx
  on pieggi.auditoria_eventos (empresa_id, criado_em desc);

alter table pieggi.usuarios enable row level security;
alter table pieggi.usuario_empresas enable row level security;
alter table pieggi.usuario_papeis enable row level security;
alter table pieggi.regras_negocio enable row level security;
alter table pieggi.auditoria_eventos enable row level security;
alter table pieggi.fiscal_empresas enable row level security;
alter table pieggi.fiscal_configuracoes enable row level security;
alter table pieggi.fiscal_certificados enable row level security;
alter table pieggi.fiscal_series enable row level security;
alter table pieggi.fiscal_documentos enable row level security;
alter table pieggi.fiscal_itens_documento enable row level security;
alter table pieggi.fiscal_eventos_documento enable row level security;
alter table pieggi.fiscal_arquivos enable row level security;
alter table pieggi.fiscal_idempotencias enable row level security;
alter table pieggi.fiscal_logs enable row level security;
alter table pieggi.fiscal_produtos enable row level security;

grant usage on schema pieggi to authenticated, service_role;

revoke all on table pieggi.usuarios from public, anon, authenticated;
revoke all on table pieggi.usuario_empresas from public, anon, authenticated;
revoke all on table pieggi.usuario_papeis from public, anon, authenticated;
revoke all on table pieggi.regras_negocio from public, anon, authenticated;
revoke all on table pieggi.auditoria_eventos from public, anon, authenticated;

grant select, insert, update, delete on table pieggi.usuarios to service_role;
grant select, insert, update, delete on table pieggi.usuario_empresas to service_role;
grant select, insert, update, delete on table pieggi.usuario_papeis to service_role;
grant select, insert, update, delete on table pieggi.regras_negocio to service_role;
grant select, insert, update, delete on table pieggi.auditoria_eventos to service_role;

grant select on table pieggi.usuarios, pieggi.usuario_empresas, pieggi.usuario_papeis to authenticated;

drop policy if exists usuarios_ler_proprio_perfil on pieggi.usuarios;
create policy usuarios_ler_proprio_perfil on pieggi.usuarios
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists usuario_empresas_ler_proprias on pieggi.usuario_empresas;
create policy usuario_empresas_ler_proprias on pieggi.usuario_empresas
  for select to authenticated using (usuario_id = (select auth.uid()));

drop policy if exists usuario_papeis_ler_proprios on pieggi.usuario_papeis;
create policy usuario_papeis_ler_proprios on pieggi.usuario_papeis
  for select to authenticated using (usuario_id = (select auth.uid()));

-- Bootstrap seguro: somente um projeto Auth com exatamente um usuario recebe o primeiro ADMIN.
insert into pieggi.usuarios (id, nome)
select id, coalesce(nullif(raw_user_meta_data ->> 'name', ''), split_part(email, '@', 1), 'Administrador')
from auth.users
where (select count(*) from auth.users) = 1
on conflict (id) do nothing;

insert into pieggi.usuario_empresas (usuario_id, empresa_id)
select usuario.id, empresa.id
from pieggi.usuarios usuario
cross join pieggi.fiscal_empresas empresa
where (select count(*) from auth.users) = 1
on conflict (usuario_id, empresa_id) do nothing;

insert into pieggi.usuario_papeis (usuario_id, papel)
select usuario.id, 'ADMIN'
from pieggi.usuarios usuario
where (select count(*) from auth.users) = 1
on conflict (usuario_id, papel) do nothing;

insert into pieggi.regras_negocio
  (id, codigo, versao, titulo, descricao, origem, status, escopo, vigente_desde)
values
  ('61b52dda-16ba-4fba-8ee2-cd30dd1e2280', 'CONTRATO_PORTAO_OPERACAO', 1,
   'Contrato antes da operacao',
   'A programacao operacional nao pode iniciar antes da formalizacao contratual.',
   'Reuniao Bruno #02 e #03', 'APROVADA', '{"modulos":["fechamento","programacao"]}', '2026-10-05T00:00:00-03:00'),
  ('e698e626-cb97-4665-a379-fdf5adcae525', 'ALTERACAO_PROGRAMACAO_COM_APROVACAO', 1,
   'Alteracao da programacao exige aprovacao',
   'Mudancas na programacao operacional devem permanecer editaveis e registrar aprovacao.',
   'Reuniao Bruno #03', 'APROVADA', '{"modulos":["programacao","rua"]}', '2026-10-05T00:00:00-03:00'),
  ('1551d59c-1a2d-4ab2-ace6-d5fa39114b09', 'CHECKLIST_COM_EVIDENCIAS', 1,
   'Checklist operacional com evidencias',
   'Itens criticos do checklist devem aceitar evidencia, incluindo higienizacao e fotografia da mesa.',
   'Reuniao Bruno #03', 'APROVADA', '{"modulos":["programacao","evento"]}', '2026-10-05T00:00:00-03:00'),
  ('4216d193-6936-48f0-a6d8-4280ee75caa4', 'COMANDA_TRES_CONFERENCIAS', 1,
   'Comanda conferida em tres momentos',
   'A comanda de producao deve registrar tres conferencias independentes antes da expedicao.',
   'Reuniao Bruno #03', 'APROVADA', '{"modulos":["comanda","fabricacao","expedicao"]}', '2026-10-05T00:00:00-03:00'),
  ('77173809-8350-4bb7-a8e7-f133fcf83057', 'TERMO_REMANESCENTES', 1,
   'Termo de entrega de remanescentes',
   'A entrega de itens remanescentes ao cliente deve gerar termo para assinatura.',
   'Reuniao Bruno #03', 'APROVADA', '{"modulos":["evento","pos_evento"]}', '2026-10-05T00:00:00-03:00')
on conflict (codigo, versao) do nothing;
