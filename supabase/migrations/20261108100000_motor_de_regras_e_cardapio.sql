-- Fase 1 da especificação de 05/11/2026: regras como dado (valor, escopo, vigência, histórico) e cardápio.
-- Aplicar depois de 20261006111000. Reaproveita pieggi.regras_negocio; não altera regras descritivas existentes.
begin;

alter table pieggi.regras_negocio add column if not exists valor jsonb;
alter table pieggi.regras_negocio add column if not exists escopo_tipo text not null default 'GLOBAL';
alter table pieggi.regras_negocio add column if not exists escopo_chave text not null default '';
alter table pieggi.regras_negocio add column if not exists financeiro boolean not null default false;
alter table pieggi.regras_negocio add column if not exists justificativa text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'regras_negocio_escopo_ck') then
    alter table pieggi.regras_negocio add constraint regras_negocio_escopo_ck check (
      escopo_tipo in ('GLOBAL','REGIAO','LINHA','CLIENTE','ITEM')
      and (escopo_tipo = 'GLOBAL') = (escopo_chave = '')
      and escopo_chave ~ '^[A-Z0-9_]{0,60}$');
  end if;
end $$;
create index if not exists regras_negocio_valor_idx on pieggi.regras_negocio (codigo, escopo_tipo, escopo_chave, vigente_desde desc) where valor is not null;

-- Leitura: qualquer usuário ativo; preços, taxas e CMV só para perfis comerciais/financeiros.
grant select on pieggi.regras_negocio to authenticated;
drop policy if exists regras_negocio_ler on pieggi.regras_negocio;
create policy regras_negocio_ler on pieggi.regras_negocio for select to authenticated using (
  exists (select 1 from pieggi.usuarios u where u.id = (select auth.uid()) and u.ativo)
  and (not financeiro or exists (select 1 from pieggi.usuario_papeis p where p.usuario_id = (select auth.uid()) and p.papel in ('ADMIN','COMERCIAL','ATENDIMENTO','FINANCEIRO')))
);

create or replace function pieggi.eh_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from pieggi.usuarios u join pieggi.usuario_papeis p on p.usuario_id = u.id
    where u.id = auth.uid() and u.ativo and p.papel = 'ADMIN')
$$;
revoke all on function pieggi.eh_admin() from public, anon;
grant execute on function pieggi.eh_admin() to authenticated;

-- Nova versão de regra. Vigência nunca retroativa: evento já calculado não muda (Caso 7).
create or replace function pieggi.alterar_regra(p_codigo text, p_escopo_tipo text, p_escopo_chave text, p_valor jsonb,
  p_vigente_desde date, p_justificativa text, p_titulo text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare anterior pieggi.regras_negocio%rowtype; v_id uuid := gen_random_uuid(); v_versao integer; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not pieggi.eh_admin() then raise exception 'Somente a diretoria altera regras.' using errcode = '42501'; end if;
  if p_codigo !~ '^[a-z0-9_]+(\.[A-Za-z0-9_]+)*$' or p_valor is null or jsonb_typeof(p_valor) = 'null' then raise exception 'Regra inválida.'; end if;
  if p_vigente_desde is null or p_vigente_desde < hoje then raise exception 'A vigência não pode ser retroativa: eventos já calculados não podem mudar.'; end if;
  if length(trim(coalesce(p_justificativa, ''))) not between 5 and 1000 then raise exception 'Informe a justificativa da alteração.'; end if;
  perform pg_advisory_xact_lock(hashtext('pieggi.regra:' || p_codigo));
  select * into anterior from pieggi.regras_negocio
    where codigo = p_codigo and escopo_tipo = p_escopo_tipo and escopo_chave = coalesce(p_escopo_chave, '') and valor is not null and status <> 'REVOGADA'
    order by vigente_desde desc, versao desc limit 1;
  if not found and length(trim(coalesce(p_titulo, ''))) < 3 then raise exception 'Informe o título da nova regra.'; end if;
  if found and jsonb_typeof(anterior.valor) <> jsonb_typeof(p_valor) then raise exception 'O novo valor precisa ter o mesmo formato do anterior.'; end if;
  select coalesce(max(versao), 0) + 1 into v_versao from pieggi.regras_negocio where codigo = p_codigo;
  insert into pieggi.regras_negocio (id, codigo, versao, titulo, descricao, origem, status, escopo, vigente_desde,
    substitui_regra_id, criado_por, valor, escopo_tipo, escopo_chave, financeiro, justificativa)
  values (v_id, p_codigo, v_versao, coalesce(nullif(trim(p_titulo), ''), anterior.titulo), coalesce(anterior.descricao, trim(p_titulo)), 'Admin', 'APROVADA', '{}'::jsonb,
    (p_vigente_desde::timestamp at time zone 'America/Sao_Paulo'), anterior.id, auth.uid(), p_valor, p_escopo_tipo, coalesce(p_escopo_chave, ''),
    coalesce(anterior.financeiro, (select bool_or(financeiro) from pieggi.regras_negocio where codigo = p_codigo), true), trim(p_justificativa));
  insert into pieggi.auditoria_eventos (id, usuario_id, acao, entidade, entidade_id, dados)
  values (gen_random_uuid(), auth.uid(), 'REGRA_ALTERADA', 'regra_negocio', v_id::text,
    jsonb_build_object('codigo', p_codigo, 'escopo', p_escopo_tipo || ':' || coalesce(p_escopo_chave, ''), 'antes', anterior.valor, 'depois', p_valor, 'vigenteDesde', p_vigente_desde, 'justificativa', trim(p_justificativa)));
  return jsonb_build_object('id', v_id, 'versao', v_versao);
end $$;
revoke all on function pieggi.alterar_regra(text, text, text, jsonb, date, text, text) from public, anon;
grant execute on function pieggi.alterar_regra(text, text, text, jsonb, date, text, text) to authenticated;

-- Chave de regras do cliente (STARTSE, INTELI, WTC, IPT…). A regra segue o cliente, não o endereço.
alter table pieggi.clientes add column if not exists chave_regras text check (chave_regras ~ '^[A-Z0-9_]{2,40}$');
update pieggi.clientes set chave_regras = case
    when nome ~* 'startse' then 'STARTSE' when nome ~* '\minteli\M' then 'INTELI'
    when nome ~* '\mwtc\M' then 'WTC' when nome ~* '\mipt\M' then 'IPT' end
  where chave_regras is null and nome ~* 'startse|\minteli\M|\mwtc\M|\mipt\M';

create or replace function pieggi.definir_chave_regras_cliente(p_cliente uuid, p_chave text)
returns void language plpgsql security definer set search_path = '' as $$
declare c pieggi.clientes%rowtype;
begin
  select * into c from pieggi.clientes where id = p_cliente for update;
  if not found or not pieggi.eh_admin() or not pieggi.tem_acesso(c.empresa_id) then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  update pieggi.clientes set chave_regras = nullif(upper(trim(p_chave)), ''), atualizado_em = now() where id = c.id;
  insert into pieggi.auditoria_eventos (id, empresa_id, usuario_id, acao, entidade, entidade_id, dados)
  values (gen_random_uuid(), c.empresa_id, auth.uid(), 'CLIENTE_CHAVE_REGRAS', 'cliente', c.id::text, jsonb_build_object('antes', c.chave_regras, 'depois', nullif(upper(trim(p_chave)), '')));
end $$;
revoke all on function pieggi.definir_chave_regras_cliente(uuid, text) from public, anon;
grant execute on function pieggi.definir_chave_regras_cliente(uuid, text) to authenticated;

-- Cardápio. Custo em tabela separada: perfis operacionais não leem custo.
create table if not exists pieggi.cardapio_itens (
  id uuid primary key default gen_random_uuid(),
  familia text not null, grupo text not null, categoria text not null, tier text not null,
  nome text not null, ingredientes text not null default '', unidade text not null,
  nome_en text, nome_es text,
  selo text check (selo in ('VEGANO','VEGETARIANO')),
  estacao text check (estacao in ('COZINHA_QUENTE','COZINHA_FRIA','CONFEITARIA','BEBIDAS','ESTRUTURA','FORNECEDOR')),
  fornecedor text, ativo boolean not null default true,
  atualizado_por uuid references pieggi.usuarios(id), atualizado_em timestamptz not null default now(),
  unique (grupo, nome)
);
create table if not exists pieggi.cardapio_custos (
  item_id uuid primary key references pieggi.cardapio_itens(id) on delete cascade,
  custo numeric(12,4) not null check (custo >= 0),
  atualizado_em timestamptz not null default now()
);
alter table pieggi.cardapio_itens enable row level security;
alter table pieggi.cardapio_custos enable row level security;
revoke all on pieggi.cardapio_itens, pieggi.cardapio_custos from public, anon, authenticated;
grant select on pieggi.cardapio_itens, pieggi.cardapio_custos to authenticated;
drop policy if exists cardapio_itens_ler on pieggi.cardapio_itens;
create policy cardapio_itens_ler on pieggi.cardapio_itens for select to authenticated using (
  exists (select 1 from pieggi.usuarios u where u.id = (select auth.uid()) and u.ativo));
drop policy if exists cardapio_custos_ler on pieggi.cardapio_custos;
create policy cardapio_custos_ler on pieggi.cardapio_custos for select to authenticated using (
  exists (select 1 from pieggi.usuario_papeis p join pieggi.usuarios u on u.id = p.usuario_id
    where p.usuario_id = (select auth.uid()) and u.ativo and p.papel in ('ADMIN','COMERCIAL','ATENDIMENTO','FINANCEIRO')));

create or replace function pieggi.salvar_item_cardapio(p_id uuid, p_dados jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare antes jsonb; custo_antes numeric;
begin
  if not pieggi.eh_admin() then raise exception 'Somente a diretoria altera o cardápio.' using errcode = '42501'; end if;
  if jsonb_typeof(p_dados) is distinct from 'object' or exists (select 1 from jsonb_object_keys(p_dados) k where k not in ('nomeEn','nomeEs','selo','estacao','fornecedor','ativo','custo')) then raise exception 'Campos não permitidos.'; end if;
  select to_jsonb(i) into antes from pieggi.cardapio_itens i where id = p_id for update;
  if antes is null then raise exception 'Item não encontrado.'; end if;
  update pieggi.cardapio_itens set
    nome_en = case when p_dados ? 'nomeEn' then nullif(trim(p_dados->>'nomeEn'), '') else nome_en end,
    nome_es = case when p_dados ? 'nomeEs' then nullif(trim(p_dados->>'nomeEs'), '') else nome_es end,
    selo = case when p_dados ? 'selo' then nullif(p_dados->>'selo', '') else selo end,
    estacao = case when p_dados ? 'estacao' then nullif(p_dados->>'estacao', '') else estacao end,
    fornecedor = case when p_dados ? 'fornecedor' then nullif(trim(p_dados->>'fornecedor'), '') else fornecedor end,
    ativo = case when p_dados ? 'ativo' then (p_dados->>'ativo')::boolean else ativo end,
    atualizado_por = auth.uid(), atualizado_em = now()
  where id = p_id;
  if p_dados ? 'custo' then
    if jsonb_typeof(p_dados->'custo') <> 'number' or (p_dados->>'custo')::numeric < 0 then raise exception 'Custo inválido.'; end if;
    select custo into custo_antes from pieggi.cardapio_custos where item_id = p_id;
    insert into pieggi.cardapio_custos (item_id, custo) values (p_id, (p_dados->>'custo')::numeric)
      on conflict (item_id) do update set custo = excluded.custo, atualizado_em = now();
  end if;
  insert into pieggi.auditoria_eventos (id, usuario_id, acao, entidade, entidade_id, dados)
  values (gen_random_uuid(), auth.uid(), 'CARDAPIO_ITEM_ALTERADO', 'cardapio_item', p_id::text,
    jsonb_build_object('antes', antes || jsonb_build_object('custo', custo_antes), 'alteracoes', p_dados));
end $$;
revoke all on function pieggi.salvar_item_cardapio(uuid, jsonb) from public, anon;
grant execute on function pieggi.salvar_item_cardapio(uuid, jsonb) to authenticated;

commit;
