-- Estrutura do módulo de NF-e modelo 55.
-- A regra de negócio permanece no backend; este arquivo contém apenas dados e integridade estrutural.

create schema if not exists pieggi;
grant usage on schema pieggi to service_role;
grant all on all tables in schema pieggi to service_role;
alter default privileges in schema pieggi grant all on tables to service_role;

create table if not exists pieggi.fiscal_empresas (
  id uuid primary key,
  cnpj text not null unique,
  razao_social text not null,
  nome_fantasia text,
  inscricao_estadual text,
  inscricao_municipal text,
  crt text not null,
  logradouro text not null,
  numero_endereco text not null,
  complemento text,
  bairro text not null,
  codigo_municipio_ibge text not null,
  municipio text not null,
  uf text not null,
  cep text not null,
  telefone text,
  email text,
  ambiente_padrao text not null,
  criado_em timestamptz not null,
  atualizado_em timestamptz not null
);

create table if not exists pieggi.fiscal_configuracoes (
  id uuid primary key,
  empresa_id uuid not null unique references pieggi.fiscal_empresas(id),
  ambiente text not null,
  codigo_regime_tributario text not null,
  versao_layout_nfe text not null,
  criado_em timestamptz not null,
  atualizado_em timestamptz not null
);

create table if not exists pieggi.fiscal_certificados (
  id uuid primary key,
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  caminho_armazenamento text not null,
  nome_original text not null,
  mime_type text not null,
  tamanho_bytes bigint not null,
  hash_sha256 char(64) not null,
  senha_criptografada text not null default '',
  titular text,
  cnpj_titular varchar(14),
  emissor text,
  valido_de timestamptz,
  valido_ate timestamptz,
  status varchar(16) not null,
  criado_em timestamptz not null,
  atualizado_em timestamptz not null
);

create table if not exists pieggi.fiscal_series (
  id uuid primary key,
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  modelo text not null,
  serie integer not null,
  ativa boolean not null default true,
  criado_em timestamptz not null,
  atualizado_em timestamptz not null,
  unique (empresa_id, modelo, serie)
);

create table if not exists pieggi.fiscal_documentos (
  id uuid primary key,
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  ambiente text not null,
  modelo text not null,
  serie integer not null,
  numero bigint,
  chave_acesso text,
  status text not null,
  natureza_operacao text not null,
  destino_operacao text not null,
  consumidor_final text not null,
  indicador_presenca text not null,
  totais jsonb not null,
  snapshot_emitente jsonb not null,
  snapshot_destinatario jsonb not null,
  transporte jsonb not null default '{}'::jsonb,
  pagamento jsonb not null default '{}'::jsonb,
  informacoes_adicionais text,
  codigo_status_sefaz text,
  mensagem_sefaz text,
  criado_em timestamptz not null,
  atualizado_em timestamptz not null,
  unique (empresa_id, modelo, serie, numero)
);

create table if not exists pieggi.fiscal_itens_documento (
  id uuid primary key,
  documento_id uuid not null references pieggi.fiscal_documentos(id) on delete cascade,
  numero_item integer not null,
  produto_id uuid,
  descricao text not null,
  ncm text not null,
  cfop text not null,
  unidade text not null,
  quantidade numeric(15,4) not null,
  valor_unitario numeric(15,4) not null,
  desconto numeric(15,2) not null default 0,
  frete numeric(15,2) not null default 0,
  seguro numeric(15,2) not null default 0,
  outras_despesas numeric(15,2) not null default 0,
  origem text not null,
  cst text,
  csosn text,
  gtin text,
  cest text,
  sku text,
  icms jsonb not null default '{}'::jsonb,
  ipi jsonb not null default '{}'::jsonb,
  pis jsonb not null default '{}'::jsonb,
  cofins jsonb not null default '{}'::jsonb,
  ibs jsonb not null default '{}'::jsonb,
  cbs jsonb not null default '{}'::jsonb,
  "cClassTrib" text,
  snapshot_fiscal jsonb not null,
  criado_em timestamptz not null,
  atualizado_em timestamptz not null,
  unique (documento_id, numero_item)
);

create table if not exists pieggi.fiscal_eventos_documento (
  id uuid primary key,
  documento_id uuid not null references pieggi.fiscal_documentos(id) on delete cascade,
  tipo text not null,
  status text not null,
  protocolo text,
  descricao text,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null
);

create table if not exists pieggi.fiscal_arquivos (
  id uuid primary key,
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  documento_id uuid references pieggi.fiscal_documentos(id) on delete cascade,
  tipo text not null,
  caminho_armazenamento text not null,
  nome text not null,
  mime_type text not null,
  tamanho_bytes bigint not null,
  hash_sha256 text not null,
  criado_em timestamptz not null
);

create table if not exists pieggi.fiscal_idempotencias (
  id uuid primary key,
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  chave text not null,
  resposta jsonb not null,
  criado_em timestamptz not null,
  unique (empresa_id, chave)
);

create table if not exists pieggi.fiscal_logs (
  id uuid primary key,
  empresa_id uuid references pieggi.fiscal_empresas(id),
  documento_id uuid references pieggi.fiscal_documentos(id) on delete set null,
  nivel text not null,
  mensagem text not null,
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null
);

create index if not exists fiscal_documentos_empresa_criado_idx on pieggi.fiscal_documentos (empresa_id, criado_em desc);
create index if not exists fiscal_itens_documento_documento_idx on pieggi.fiscal_itens_documento (documento_id);
create index if not exists fiscal_arquivos_documento_idx on pieggi.fiscal_arquivos (documento_id);
