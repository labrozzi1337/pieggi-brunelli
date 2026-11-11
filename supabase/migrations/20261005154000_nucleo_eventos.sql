-- Porta unica de entrada do evento e funil transversal comercial/operacao/financeiro.
-- Valores ficam separados para impedir leitura por perfis operacionais.

create table if not exists pieggi.clientes (
  id uuid primary key,
  empresa_id uuid not null references pieggi.fiscal_empresas(id) on delete cascade,
  tipo text not null default 'PJ' check (tipo in ('PF', 'PJ')),
  nome text not null,
  documento text,
  email text,
  telefone text,
  criado_em timestamptz not null default current_timestamp,
  atualizado_em timestamptz not null default current_timestamp,
  unique (empresa_id, documento)
);

create table if not exists pieggi.eventos (
  id uuid primary key,
  empresa_id uuid not null references pieggi.fiscal_empresas(id) on delete cascade,
  cliente_id uuid not null references pieggi.clientes(id),
  titulo text not null,
  origem_lead text,
  etapa_comercial text not null default 'FRIO' check (etapa_comercial in (
    'FRIO', 'MORNO', 'QUENTE', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO', 'PERDIDO'
  )),
  etapa_operacao text not null default 'BLOQUEADO' check (etapa_operacao in (
    'BLOQUEADO', 'PROGRAMACAO', 'PRODUCAO', 'EXPEDICAO', 'EM_CAMPO', 'ENTREGUE'
  )),
  etapa_financeiro text not null default 'A_FATURAR' check (etapa_financeiro in (
    'A_FATURAR', 'FATURADO', 'RECEBIDO'
  )),
  tabela_preco text,
  pax integer check (pax is null or pax > 0),
  data_evento date,
  horario_inicio time,
  horario_fim time,
  logradouro text,
  numero_endereco text,
  complemento text,
  bairro text,
  cidade text,
  uf char(2),
  cep text,
  contato_local_nome text,
  contato_local_telefone text,
  contrato_assinado_em timestamptz,
  liberacao_excepcional_motivo text,
  observacoes text,
  criado_por uuid references pieggi.usuarios(id) on delete set null,
  criado_em timestamptz not null default current_timestamp,
  atualizado_em timestamptz not null default current_timestamp,
  check (
    etapa_operacao = 'BLOQUEADO'
    or contrato_assinado_em is not null
    or nullif(trim(liberacao_excepcional_motivo), '') is not null
  ),
  check (
    etapa_comercial not in ('CONTRATO_ENVIADO', 'CONTRATO_ASSINADO')
    or (
      tabela_preco is not null and pax is not null and data_evento is not null
      and horario_inicio is not null and horario_fim is not null
      and logradouro is not null and numero_endereco is not null
      and bairro is not null and cidade is not null and uf is not null and cep is not null
      and contato_local_nome is not null and contato_local_telefone is not null
    )
  )
);

create table if not exists pieggi.evento_valores (
  evento_id uuid primary key references pieggi.eventos(id) on delete cascade,
  valor_venda numeric(14,2),
  custo_estimado numeric(14,2),
  atualizado_em timestamptz not null default current_timestamp,
  check (valor_venda is null or valor_venda >= 0),
  check (custo_estimado is null or custo_estimado >= 0)
);

create index if not exists clientes_empresa_nome_idx on pieggi.clientes (empresa_id, nome);
create index if not exists eventos_empresa_data_idx on pieggi.eventos (empresa_id, data_evento, criado_em desc);
create index if not exists eventos_funil_idx on pieggi.eventos (empresa_id, etapa_comercial, etapa_operacao, etapa_financeiro);

alter table pieggi.clientes enable row level security;
alter table pieggi.eventos enable row level security;
alter table pieggi.evento_valores enable row level security;

revoke all on table pieggi.clientes, pieggi.eventos, pieggi.evento_valores from public, anon, authenticated;
grant select, insert, update, delete on table pieggi.clientes, pieggi.eventos, pieggi.evento_valores to service_role;
