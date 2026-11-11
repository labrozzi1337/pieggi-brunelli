-- Catálogo de itens materiais para pré-preenchimento da NF-e.
-- A aprovação tributária continua uma responsabilidade explícita do backend e da contabilidade.

create table if not exists pieggi.fiscal_produtos (
  id uuid primary key,
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  codigo text not null,
  descricao text not null,
  grupo text,
  unidade text not null default 'UN',
  ncm text not null,
  descricao_ncm text,
  categoria_fiscal text,
  cfop_padrao text not null,
  origem text not null,
  cst_icms text,
  aliquota_icms numeric(7,4),
  cst_pis text,
  aliquota_pis numeric(7,4),
  cst_cofins text,
  aliquota_cofins numeric(7,4),
  cest text,
  observacao_fiscal text,
  custo_padrao numeric(15,4),
  preco_venda numeric(15,4),
  origem_catalogo text not null,
  referencia_origem text not null,
  revisao_fiscal_pendente boolean not null default true,
  ativo boolean not null default true,
  criado_em timestamptz not null,
  atualizado_em timestamptz not null,
  unique (empresa_id, codigo)
);

create index if not exists fiscal_produtos_empresa_descricao_idx on pieggi.fiscal_produtos (empresa_id, descricao);
