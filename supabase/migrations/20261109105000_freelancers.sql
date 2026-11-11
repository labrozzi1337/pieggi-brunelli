-- Módulo 7 — Freelancers e diárias (especificação 05/11/2026 §10).
-- Banco só armazena (ADR 0001): validação de CNPJ, valor da diária, travas de fechamento, autorização e
-- auditoria ficam em apps/backend/src/dominios/equipe. Nenhuma função, trigger ou policy aqui. Idempotente.
begin;

create table if not exists pieggi.freelancers (
  id uuid primary key,
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  nome text not null check (length(trim(nome)) between 2 and 200),
  -- LGPD: CNPJ, celular e chave PIX chegam aqui já cifrados (AES-256-GCM) pelo backend.
  -- cnpj_hash é um HMAC do CNPJ, só para impedir cadastro duplicado sem guardar o número.
  cnpj_cifrado text,
  cnpj_hash text,
  celular_cifrado text,
  pix_cifrado text,
  funcoes text[] not null default '{}',
  valor_diaria numeric(14,2) check (valor_diaria is null or valor_diaria > 0),
  documentos_path text check (documentos_path is null or length(documentos_path) <= 500),
  ativo boolean not null default true,
  anonimizado_em timestamptz,
  criado_por uuid references pieggi.usuarios(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists freelancers_cnpj_unico on pieggi.freelancers (empresa_id, cnpj_hash) where cnpj_hash is not null;
create index if not exists freelancers_empresa_nome_idx on pieggi.freelancers (empresa_id, nome);

-- Fechamento de um período: marca as diárias como pagas e as trava.
create table if not exists pieggi.freelancer_fechamentos (
  id uuid primary key,
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  inicio date not null,
  fim date not null,
  evento_id uuid references pieggi.eventos(id),
  pago_em date not null,
  observacao text not null default '' check (length(observacao) <= 1000),
  fechado_por uuid not null references pieggi.usuarios(id),
  fechado_em timestamptz not null default now(),
  check (fim >= inicio)
);

-- Um pagamento por freelancer em cada fechamento (o valor é o que foi efetivamente pago).
create table if not exists pieggi.freelancer_pagamentos (
  id uuid primary key,
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  fechamento_id uuid not null references pieggi.freelancer_fechamentos(id),
  freelancer_id uuid not null references pieggi.freelancers(id),
  valor numeric(14,2) not null check (valor > 0),
  pago_em date not null,
  comprovante_path text check (comprovante_path is null or length(comprovante_path) <= 500),
  unique (fechamento_id, freelancer_id)
);

-- Uma diária por pessoa, evento e dia trabalhado. O valor é congelado no lançamento.
create table if not exists pieggi.freelancer_diarias (
  id uuid primary key,
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  freelancer_id uuid not null references pieggi.freelancers(id),
  evento_id uuid not null references pieggi.eventos(id),
  data date not null,
  funcao text not null check (length(funcao) between 2 and 40),
  inicio time not null,
  fim time not null,
  local text not null default '' check (length(local) <= 300),
  valor numeric(14,2) not null check (valor > 0),
  valor_origem text not null check (valor_origem in ('FUNCAO', 'INDIVIDUAL', 'AJUSTE')),
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'PAGO', 'CANCELADA')),
  pagamento_id uuid references pieggi.freelancer_pagamentos(id),
  motivo text check (motivo is null or length(motivo) <= 1000),
  criado_por uuid not null references pieggi.usuarios(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (inicio <> fim),
  check (status <> 'PAGO' or pagamento_id is not null)
);
create unique index if not exists freelancer_diarias_dia_unico on pieggi.freelancer_diarias (freelancer_id, evento_id, data) where status <> 'CANCELADA';
create index if not exists freelancer_diarias_periodo_idx on pieggi.freelancer_diarias (empresa_id, data);
create index if not exists freelancer_diarias_evento_idx on pieggi.freelancer_diarias (evento_id);

-- Sem acesso pela Data API pública: quem decide é o backend.
alter table pieggi.freelancers enable row level security;
alter table pieggi.freelancer_fechamentos enable row level security;
alter table pieggi.freelancer_pagamentos enable row level security;
alter table pieggi.freelancer_diarias enable row level security;
revoke all on table pieggi.freelancers, pieggi.freelancer_fechamentos, pieggi.freelancer_pagamentos, pieggi.freelancer_diarias from public, anon, authenticated;

-- Tabela de diária por função (custo, nunca preço de venda). §16: a tabela ainda não foi fechada →
-- valores PROVISÓRIOS com status PENDENTE; o admin ajusta pela tela de regras (nova versão com vigência).
insert into pieggi.regras_negocio (id, codigo, versao, titulo, descricao, origem, status, escopo, vigente_desde, valor, escopo_tipo, escopo_chave, financeiro) values
  (gen_random_uuid(), 'freelancer.diaria.faixa', 1, 'Faixa da diária de freelancer (R$)', 'Faixa paga pela Pieggi por diária: R$ 180 a R$ 350, conforme função, serviço e tipo de contratado', 'Especificação 05/11/2026 §10 Diárias e valores', 'APROVADA', '{}'::jsonb, timestamptz '2026-11-05T00:00:00-03:00', '{"min":180,"max":350}'::jsonb, 'GLOBAL', '', true),
  (gen_random_uuid(), 'freelancer.diaria', 1, 'Diária padrão — Copeira (PROVISÓRIO)', 'Valor padrão da diária da função; o valor individual do freelancer sobrescreve. Tabela pendente (§16).', 'Especificação 05/11/2026 §10 e §16', 'PENDENTE', '{}'::jsonb, timestamptz '2026-11-05T00:00:00-03:00', '200'::jsonb, 'ITEM', 'COPEIRA', true),
  (gen_random_uuid(), 'freelancer.diaria', 2, 'Diária padrão — Garçom (PROVISÓRIO)', 'Valor padrão da diária da função; o valor individual do freelancer sobrescreve. Tabela pendente (§16).', 'Especificação 05/11/2026 §10 e §16', 'PENDENTE', '{}'::jsonb, timestamptz '2026-11-05T00:00:00-03:00', '220'::jsonb, 'ITEM', 'GARCOM', true),
  (gen_random_uuid(), 'freelancer.diaria', 3, 'Diária padrão — Cozinheiro (PROVISÓRIO)', 'Valor padrão da diária da função; o valor individual do freelancer sobrescreve. Tabela pendente (§16).', 'Especificação 05/11/2026 §10 e §16', 'PENDENTE', '{}'::jsonb, timestamptz '2026-11-05T00:00:00-03:00', '300'::jsonb, 'ITEM', 'COZINHEIRO', true),
  (gen_random_uuid(), 'freelancer.diaria', 4, 'Diária padrão — Auxiliar (PROVISÓRIO)', 'Valor padrão da diária da função; o valor individual do freelancer sobrescreve. Tabela pendente (§16).', 'Especificação 05/11/2026 §10 e §16', 'PENDENTE', '{}'::jsonb, timestamptz '2026-11-05T00:00:00-03:00', '180'::jsonb, 'ITEM', 'AUXILIAR', true),
  (gen_random_uuid(), 'freelancer.diaria', 5, 'Diária padrão — Motorista (PROVISÓRIO)', 'Valor padrão da diária da função; o valor individual do freelancer sobrescreve. Tabela pendente (§16).', 'Especificação 05/11/2026 §10 e §16', 'PENDENTE', '{}'::jsonb, timestamptz '2026-11-05T00:00:00-03:00', '250'::jsonb, 'ITEM', 'MOTORISTA', true)
on conflict (codigo, versao) do nothing;

commit;
