-- Módulo 6 — Compras e Estoque (especificação 05/11/2026 §9). O banco só armazena: explosão de necessidade,
-- consolidação, custo médio, baixas, inventário e CMV moram em apps/backend/src/dominios/compras. Idempotente.
begin;

-- Fornecedores: código de roteamento (PAD_LETICIA…), categorias atendidas, prazo e pedido mínimo.
alter table pieggi.fornecedores add column if not exists codigo text check (codigo ~ '^[A-Z0-9_]{2,40}$');
alter table pieggi.fornecedores add column if not exists categorias text[] not null default '{}';
alter table pieggi.fornecedores add column if not exists prazo_pagamento_dias integer not null default 0 check (prazo_pagamento_dias between 0 and 365);
alter table pieggi.fornecedores add column if not exists pedido_minimo numeric(14,2) not null default 0 check (pedido_minimo >= 0);
create unique index if not exists fornecedores_codigo_uk on pieggi.fornecedores (empresa_id, codigo);

create table if not exists pieggi.insumos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  nome text not null check (length(trim(nome)) between 2 and 200),
  marca text not null default '',
  setor text not null,
  unidade text not null check (unidade in ('UN','KG','G','L','ML')),   -- unidade de uso: estoque e custo nela
  unidade_compra text not null default '',                              -- ex.: "caixa 10 kg"
  fator_compra numeric(18,6) not null default 1 check (fator_compra > 0), -- unidades de uso por unidade de compra
  estoque_minimo numeric(18,6) not null default 0 check (estoque_minimo >= 0),
  perecivel boolean not null default false,
  rendimento_chave text,                                                 -- chave da regra "rendimento" (FRANGO, ARROZ…)
  custo_medio numeric(18,6) not null default 0 check (custo_medio >= 0), -- por unidade de uso
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (empresa_id, nome)
);

create table if not exists pieggi.insumo_fornecedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  insumo_id uuid not null references pieggi.insumos(id) on delete cascade,
  fornecedor_id uuid not null references pieggi.fornecedores(id),
  embalagem text not null default '',
  quantidade_embalagem numeric(18,6) not null check (quantidade_embalagem > 0), -- na unidade de uso do insumo
  preco numeric(14,4) not null check (preco >= 0),                             -- por embalagem
  preferido boolean not null default false,
  atualizado_em timestamptz not null default now(),
  unique (insumo_id, fornecedor_id)
);

create table if not exists pieggi.insumo_precos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  insumo_id uuid not null references pieggi.insumos(id) on delete cascade,
  fornecedor_id uuid not null references pieggi.fornecedores(id),
  preco_unitario numeric(18,6) not null check (preco_unitario >= 0), -- por unidade de uso
  origem text not null check (origem in ('COTACAO','NOTA')),
  usuario_id uuid references pieggi.usuarios(id),
  registrado_em timestamptz not null default now()
);
create index if not exists insumo_precos_idx on pieggi.insumo_precos (insumo_id, registrado_em desc);

-- Ficha técnica: quanto de cada insumo (peso pronto, unidade de uso) vai em 1 unidade_item do item.
-- produto_id guarda as antigas conversões por produto fiscal (compra_regras) até virarem ficha do cardápio.
create table if not exists pieggi.fichas_tecnicas (
  id uuid primary key default gen_random_uuid(),
  cardapio_item_id uuid references pieggi.cardapio_itens(id) on delete cascade,
  produto_id uuid references pieggi.fiscal_produtos(id),
  insumo_id uuid not null references pieggi.insumos(id),
  unidade_item text not null check (unidade_item in ('UN','KG','G','L','ML','GARRAFA','TRAVESSA','PACOTE')),
  quantidade numeric(18,6) not null check (quantidade > 0),
  rendimento numeric(10,4) check (rendimento > 0), -- vazio = regra "rendimento" pela chave do insumo
  atualizado_por uuid references pieggi.usuarios(id),
  atualizado_em timestamptz not null default now(),
  check ((cardapio_item_id is null) <> (produto_id is null))
);
create unique index if not exists fichas_tecnicas_item_uk on pieggi.fichas_tecnicas (cardapio_item_id, insumo_id) where cardapio_item_id is not null;
create unique index if not exists fichas_tecnicas_produto_uk on pieggi.fichas_tecnicas (produto_id, insumo_id, unidade_item) where produto_id is not null;

-- Custo de referência com que o item foi precificado: base do aviso de CMV quando o custo médio sobe.
create table if not exists pieggi.cardapio_custo_referencia (
  item_id uuid primary key references pieggi.cardapio_itens(id) on delete cascade,
  custo numeric(12,4) not null check (custo > 0),
  definido_por uuid references pieggi.usuarios(id),
  definido_em timestamptz not null default now()
);

create table if not exists pieggi.pedidos_compra (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  fornecedor_id uuid not null references pieggi.fornecedores(id),
  semana date not null,
  status text not null default 'ABERTO' check (status in ('ABERTO','ENVIADO','RECEBIDO','CANCELADO')),
  criado_por uuid references pieggi.usuarios(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists pedidos_compra_semana_idx on pieggi.pedidos_compra (empresa_id, semana);
create table if not exists pieggi.pedido_compra_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pieggi.pedidos_compra(id) on delete cascade,
  insumo_id uuid references pieggi.insumos(id),
  descricao text not null,
  quantidade numeric(18,6) not null check (quantidade > 0), -- unidade de uso (ou do item, se comprado pronto)
  unidade text not null,
  embalagens numeric(18,6),
  embalagem text not null default '',
  preco_estimado numeric(14,4),                            -- total estimado da linha
  eventos text[] not null default '{}'
);
create index if not exists pedido_compra_itens_pedido_idx on pieggi.pedido_compra_itens (pedido_id);

-- Demandas: evolui a tabela antiga. Uma linha por item da programação × insumo (ou item comprado pronto).
alter table pieggi.compra_demandas drop constraint if exists compra_demandas_programacao_id_item_indice_regra_id_key;
alter table pieggi.compra_demandas drop constraint if exists compra_demandas_check;
alter table pieggi.compra_demandas add column if not exists insumo_id uuid references pieggi.insumos(id);
alter table pieggi.compra_demandas add column if not exists unidade text;
alter table pieggi.compra_demandas add column if not exists quantidade_bruta numeric(18,6);
alter table pieggi.compra_demandas add column if not exists rendimento numeric(10,4);
alter table pieggi.compra_demandas add column if not exists pronto boolean not null default false;
alter table pieggi.compra_demandas add column if not exists fornecedor_codigo text;
alter table pieggi.compra_demandas add column if not exists pedido_id uuid references pieggi.pedidos_compra(id);
alter table pieggi.compra_demandas add column if not exists cancelada_em timestamptz;
alter table pieggi.compra_demandas add column if not exists consumida_em timestamptz;
alter table pieggi.compra_demandas add column if not exists criado_em timestamptz not null default now();
create index if not exists compra_demandas_evento_idx on pieggi.compra_demandas (evento_id);

create table if not exists pieggi.notas_entrada (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  fornecedor_id uuid not null references pieggi.fornecedores(id),
  numero text not null default '',
  emitida_em date not null,
  foto_path text,
  pedido_id uuid references pieggi.pedidos_compra(id),
  criado_por uuid references pieggi.usuarios(id),
  criado_em timestamptz not null default now()
);
create table if not exists pieggi.nota_entrada_itens (
  id uuid primary key default gen_random_uuid(),
  nota_id uuid not null references pieggi.notas_entrada(id) on delete cascade,
  insumo_id uuid not null references pieggi.insumos(id),
  descricao text not null,                                      -- como aparece na nota
  quantidade numeric(18,6) not null check (quantidade > 0),     -- em unidades de compra
  fator numeric(18,6) not null check (fator > 0),               -- unidades de uso por unidade de compra
  valor_total numeric(14,2) not null check (valor_total >= 0),
  lote text not null default '',
  validade date
);

-- Apelidos aprendidos: "PEITO FGO CONG SADIA" na nota do fornecedor X = insumo Peito de frango.
create table if not exists pieggi.apelidos_fornecedor (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  fornecedor_id uuid not null references pieggi.fornecedores(id),
  apelido text not null,           -- normalizado
  insumo_id uuid not null references pieggi.insumos(id) on delete cascade,
  atualizado_em timestamptz not null default now(),
  unique (fornecedor_id, apelido)
);

create table if not exists pieggi.estoque_lotes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  insumo_id uuid not null references pieggi.insumos(id),
  lote text not null default '',
  validade date,
  saldo numeric(18,6) not null check (saldo >= 0),
  custo_unitario numeric(18,6) not null check (custo_unitario >= 0),
  nota_item_id uuid references pieggi.nota_entrada_itens(id),
  criado_em timestamptz not null default now()
);
create index if not exists estoque_lotes_insumo_idx on pieggi.estoque_lotes (insumo_id) where saldo > 0;

-- Saldo do insumo = soma dos movimentos (fonte da verdade). Lotes só controlam validade (FEFO).
create table if not exists pieggi.estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  insumo_id uuid not null references pieggi.insumos(id),
  lote_id uuid references pieggi.estoque_lotes(id),
  tipo text not null check (tipo in ('ENTRADA','BAIXA_EXPEDICAO','DEVOLUCAO','AJUSTE_INVENTARIO')),
  quantidade numeric(18,6) not null check (quantidade <> 0), -- com sinal
  custo_unitario numeric(18,6) not null default 0,
  evento_id uuid references pieggi.eventos(id),
  nota_id uuid references pieggi.notas_entrada(id),
  inventario_id uuid,
  justificativa text,
  usuario_id uuid references pieggi.usuarios(id),
  criado_em timestamptz not null default now()
);
create index if not exists estoque_movimentos_insumo_idx on pieggi.estoque_movimentos (insumo_id, criado_em desc);

create table if not exists pieggi.inventarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  setor text not null,
  criado_por uuid references pieggi.usuarios(id),
  criado_em timestamptz not null default now()
);
create table if not exists pieggi.inventario_contagens (
  inventario_id uuid not null references pieggi.inventarios(id) on delete cascade,
  insumo_id uuid not null references pieggi.insumos(id),
  saldo_sistema numeric(18,6) not null,
  contado numeric(18,6) not null check (contado >= 0),
  custo_unitario numeric(18,6) not null default 0,
  justificativa text,
  primary key (inventario_id, insumo_id)
);

-- Fornecedores atuais (§9 Cotação comparativa e roteamento do §4). Primeiro adota cadastros já existentes pelo nome.
with semente(codigo, nome, padrao, categorias) as (values
  ('VALERIA_BUFFET', 'Valéria Buffet', 'val[eé]ria', array['MERCEARIA']),
  ('CENTRAL_FRIOS', 'Central Frios', 'central\s*frios', array['FRIOS_QUEIJOS']),
  ('REV2', 'REV2', '^rev\s*2', array['FRIOS_QUEIJOS']),
  ('PAD_LETICIA', 'Pad. Letícia', 'let[ií]cia', array['PRODUCAO_TERCEIRIZADA']),
  ('SALGADERIA_LEAL', 'Salgaderia Leal', 'salgaderia\s*leal', array['PRODUCAO_TERCEIRIZADA']),
  ('PADARIA_CPL', 'Padaria CPL', '\mcpl\M', array['PRODUCAO_TERCEIRIZADA']),
  ('POP_VEGAN', 'POP VEGAN', 'pop\s*vegan', array['PRODUCAO_TERCEIRIZADA']),
  ('MERCADO', 'Mercado', '^mercado$', array['HORTIFRUTI','MERCEARIA','BEBIDAS','DESCARTAVEIS','EMBALAGEM'])
), adotados as (
  update pieggi.fornecedores f set codigo = s.codigo, categorias = s.categorias
  from semente s
  where f.codigo is null and f.nome ~* s.padrao
    and not exists (select 1 from pieggi.fornecedores o where o.empresa_id = f.empresa_id and o.codigo = s.codigo)
  returning f.id
)
select count(*) from adotados;

insert into pieggi.fornecedores (empresa_id, nome, codigo, categorias)
select e.id, s.nome, s.codigo, s.categorias
from pieggi.fiscal_empresas e cross join (values
  ('VALERIA_BUFFET', 'Valéria Buffet', array['MERCEARIA']),
  ('CENTRAL_FRIOS', 'Central Frios', array['FRIOS_QUEIJOS']),
  ('REV2', 'REV2', array['FRIOS_QUEIJOS']),
  ('PAD_LETICIA', 'Pad. Letícia', array['PRODUCAO_TERCEIRIZADA']),
  ('SALGADERIA_LEAL', 'Salgaderia Leal', array['PRODUCAO_TERCEIRIZADA']),
  ('PADARIA_CPL', 'Padaria CPL', array['PRODUCAO_TERCEIRIZADA']),
  ('POP_VEGAN', 'POP VEGAN', array['PRODUCAO_TERCEIRIZADA']),
  ('MERCADO', 'Mercado', array['HORTIFRUTI','MERCEARIA','BEBIDAS','DESCARTAVEIS','EMBALAGEM'])
) as s(codigo, nome, categorias)
on conflict (empresa_id, codigo) do nothing;

-- Porta as conversões antigas (compra_regras): cada insumo vira cadastro (unidade = embalagem de compra),
-- o fornecedor vira preço a cotar e a conversão vira ficha técnica pelo produto fiscal.
insert into pieggi.insumos (empresa_id, nome, setor, unidade, unidade_compra)
select distinct on (r.empresa_id, trim(r.insumo)) r.empresa_id, trim(r.insumo), 'MERCEARIA', 'UN', trim(r.embalagem)
from pieggi.compra_regras r where r.ativa
on conflict (empresa_id, nome) do nothing;

insert into pieggi.insumo_fornecedores (empresa_id, insumo_id, fornecedor_id, embalagem, quantidade_embalagem, preco)
select distinct on (i.id, r.fornecedor_id) r.empresa_id, i.id, r.fornecedor_id, trim(r.embalagem), 1, 0
from pieggi.compra_regras r join pieggi.insumos i on i.empresa_id = r.empresa_id and i.nome = trim(r.insumo)
where r.ativa
on conflict (insumo_id, fornecedor_id) do nothing;

insert into pieggi.fichas_tecnicas (produto_id, insumo_id, unidade_item, quantidade, rendimento, atualizado_por)
select distinct on (r.produto_id, i.id, r.unidade_producao) r.produto_id, i.id, r.unidade_producao, r.quantidade_compra / r.quantidade_producao, 1, r.criado_por
from pieggi.compra_regras r join pieggi.insumos i on i.empresa_id = r.empresa_id and i.nome = trim(r.insumo)
where r.ativa
order by r.produto_id, i.id, r.unidade_producao, r.criado_em desc
on conflict (produto_id, insumo_id, unidade_item) where produto_id is not null do nothing;

update pieggi.compra_demandas d set insumo_id = i.id, unidade = 'UN'
from pieggi.compra_regras r join pieggi.insumos i on i.empresa_id = r.empresa_id and i.nome = trim(r.insumo)
where d.regra_id = r.id and d.insumo_id is null;

-- Regras configuráveis do módulo (editáveis pelo admin em Regras).
insert into pieggi.regras_negocio (id, codigo, versao, titulo, descricao, origem, status, escopo, vigente_desde, valor, escopo_tipo, escopo_chave, financeiro) values
  (gen_random_uuid(), 'compras.variacao_preco_alerta', 1, 'Compras: alerta quando o preço varia mais que (fração) em relação à última compra', 'Alerta de variação de preço de compra', 'Especificação 05/11/2026 §9 Alertas obrigatórios', 'PENDENTE', '{}'::jsonb, timestamptz '2026-11-05T00:00:00-03:00', '0.1'::jsonb, 'GLOBAL', '', false),
  (gen_random_uuid(), 'estoque.validade_alerta_dias', 1, 'Estoque: avisar validade vencendo com quantos dias de antecedência', 'Alerta de validade', 'Especificação 05/11/2026 §9 Alertas obrigatórios', 'PENDENTE', '{}'::jsonb, timestamptz '2026-11-05T00:00:00-03:00', '3'::jsonb, 'GLOBAL', '', false),
  (gen_random_uuid(), 'compras.custo_financeiro_mensal', 1, 'Cotação: custo financeiro mensal para comparar prazos de pagamento (preço equivalente à vista)', 'Custo financeiro da cotação', 'Especificação 05/11/2026 §9 Cotação comparativa', 'PENDENTE', '{}'::jsonb, timestamptz '2026-11-05T00:00:00-03:00', '0.02'::jsonb, 'GLOBAL', '', false),
  (gen_random_uuid(), 'compras.cmv_alerta', 1, 'CMV: avisar o comercial quando o custo médio leva o item a este CMV estimado (teto 33,3%)', 'Aviso de CMV por custo de insumo', 'Especificação 05/11/2026 §9 O elo com o CMV', 'PENDENTE', '{}'::jsonb, timestamptz '2026-11-05T00:00:00-03:00', '0.32'::jsonb, 'GLOBAL', '', true)
on conflict (codigo, versao) do nothing;

do $$
declare t text;
begin
  foreach t in array array['insumos','insumo_fornecedores','insumo_precos','fichas_tecnicas','cardapio_custo_referencia','pedidos_compra',
    'pedido_compra_itens','notas_entrada','nota_entrada_itens','apelidos_fornecedor','estoque_lotes','estoque_movimentos','inventarios','inventario_contagens'] loop
    execute format('alter table pieggi.%I enable row level security', t);
    execute format('revoke all on table pieggi.%I from public, anon, authenticated', t);
  end loop;
end $$;

commit;
