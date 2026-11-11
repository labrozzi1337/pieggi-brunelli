begin;
create table if not exists pieggi.fornecedores (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references pieggi.fiscal_empresas(id),
  nome text not null check(length(trim(nome)) between 2 and 200), contato text not null default '',
  ativo boolean not null default true, criado_em timestamptz not null default now()
);
-- Cada linha converte uma quantidade de produção em um insumo de compra.
-- Ingredientes diferentes exigem regras diferentes. Nunca inferir pela descrição.
create table if not exists pieggi.compra_regras (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references pieggi.fiscal_empresas(id),
  produto_id uuid not null references pieggi.fiscal_produtos(id), fornecedor_id uuid not null references pieggi.fornecedores(id),
  insumo text not null check(length(trim(insumo)) between 2 and 200),
  unidade_producao text not null check(unidade_producao in ('UN','KG','G','L','ML')),
  quantidade_producao numeric(18,6) not null check(quantidade_producao>0),
  quantidade_compra numeric(18,6) not null check(quantidade_compra>0),
  embalagem text not null check(length(trim(embalagem)) between 2 and 100),
  ativa boolean not null default true, criado_por uuid not null references pieggi.usuarios(id), criado_em timestamptz not null default now()
);
create index if not exists compra_regras_produto_idx on pieggi.compra_regras(empresa_id,produto_id) where ativa;
create table if not exists pieggi.compra_demandas (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references pieggi.fiscal_empresas(id),
  evento_id uuid not null references pieggi.eventos(id), programacao_id uuid not null references pieggi.programacoes(id),
  item_indice integer not null, item_nome text not null, regra_id uuid references pieggi.compra_regras(id),
  fornecedor_id uuid references pieggi.fornecedores(id), insumo text not null,
  quantidade numeric(18,6), embalagem text, pendencia text,
  comprado_em timestamptz, comprado_por uuid references pieggi.usuarios(id), referencia text,
  unique nulls not distinct(programacao_id,item_indice,regra_id),
  check((regra_id is null and pendencia is not null and quantidade is null) or (regra_id is not null and quantidade>0 and pendencia is null))
);
create index if not exists compra_demandas_programacao_idx on pieggi.compra_demandas(programacao_id);
do $$ declare t text; begin
  foreach t in array array['fornecedores','compra_regras','compra_demandas'] loop
    execute format('alter table pieggi.%I enable row level security',t);
    execute format('revoke all on pieggi.%I from public,anon,authenticated',t);
    execute format('grant select on pieggi.%I to authenticated',t);
    execute format('drop policy if exists compras_ler on pieggi.%I',t);
    execute format('create policy compras_ler on pieggi.%I for select to authenticated using(pieggi.tem_acesso(empresa_id,array[''ADMIN'',''PROGRAMACAO'',''EXPEDICAO_COMPRAS'']))',t);
  end loop;
end $$;

create or replace function pieggi.gerar_demanda_compra()
returns trigger language plpgsql security definer set search_path='' as $$
declare item jsonb; i integer:=0; r pieggi.compra_regras%rowtype; encontrou boolean;
begin
  if new.status='APROVADA' and old.status is distinct from 'APROVADA' then
    for item in select value from jsonb_array_elements(new.itens) loop
      encontrou:=false;
      for r in select cr.* from pieggi.compra_regras cr join pieggi.fornecedores f on f.id=cr.fornecedor_id
        where cr.empresa_id=new.empresa_id and cr.ativa and f.ativo and cr.produto_id=nullif(item->>'produtoId','')::uuid and cr.unidade_producao=item->>'unidade' loop
        encontrou:=true;
        insert into pieggi.compra_demandas(empresa_id,evento_id,programacao_id,item_indice,item_nome,regra_id,fornecedor_id,insumo,quantidade,embalagem)
          values(new.empresa_id,new.evento_id,new.id,i,item->>'nome',r.id,r.fornecedor_id,r.insumo,(item->>'quantidade')::numeric*r.quantidade_compra/r.quantidade_producao,r.embalagem) on conflict do nothing;
      end loop;
      if not encontrou then
        insert into pieggi.compra_demandas(empresa_id,evento_id,programacao_id,item_indice,item_nome,insumo,pendencia)
          values(new.empresa_id,new.evento_id,new.id,i,item->>'nome',item->>'nome',case when nullif(item->>'produtoId','') is null then 'Vincule o item a um produto na programação.' else 'Cadastre as conversões e o fornecedor para esta unidade e aprove uma nova programação.' end) on conflict do nothing;
      end if;
      i:=i+1;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists gerar_demanda_compra on pieggi.programacoes;
create trigger gerar_demanda_compra after update of status on pieggi.programacoes for each row execute function pieggi.gerar_demanda_compra();

-- Não aplicar regras atuais retroativamente a uma aprovação anterior à instalação.
-- A pendência explícita impede que a lista pareça vazia/concluída sem um snapshot.
insert into pieggi.compra_demandas(empresa_id,evento_id,programacao_id,item_indice,item_nome,insumo,pendencia)
select p.empresa_id,p.evento_id,p.id,(i.ordinality-1)::integer,i.value->>'nome',i.value->>'nome',
  'Programação anterior ao módulo de compras. Revise as conversões e aprove uma nova versão.'
from pieggi.programacoes p cross join lateral jsonb_array_elements(p.itens) with ordinality i
where p.status='APROVADA' and not exists(select 1 from pieggi.compra_demandas d where d.programacao_id=p.id)
on conflict do nothing;

create or replace function pieggi.catalogo_compras(p_empresa uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not pieggi.tem_acesso(p_empresa,array['ADMIN','PROGRAMACAO','EXPEDICAO_COMPRAS']) then raise exception 'Acesso negado.' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'codigo',codigo,'descricao',descricao) order by codigo) from pieggi.fiscal_produtos where empresa_id=p_empresa and ativo),'[]'::jsonb);
end $$;
revoke all on function pieggi.catalogo_compras(uuid) from public,anon;
grant execute on function pieggi.catalogo_compras(uuid) to authenticated;

create or replace function pieggi.consolidar_compras(p_empresa uuid,p_inicio date,p_fim date)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  if not pieggi.tem_acesso(p_empresa,array['ADMIN','PROGRAMACAO','EXPEDICAO_COMPRAS']) then raise exception 'Acesso negado.' using errcode='42501'; end if;
  if p_inicio is null or p_fim is null or p_fim<p_inicio then raise exception 'Período inválido.'; end if;
  return coalesce((select jsonb_agg(to_jsonb(g)) from (
    select d.fornecedor_id,f.nome as fornecedor,d.insumo,d.embalagem,d.comprado_em is not null as comprado,
      ceil(sum(d.quantidade)) as embalagens,sum(d.quantidade)::text as quantidade_exata,
      array_agg(d.id order by d.id) as ids,array_agg(distinct e.titulo) as eventos
    from pieggi.compra_demandas d join pieggi.programacoes pr on pr.id=d.programacao_id
    join pieggi.eventos e on e.id=d.evento_id join pieggi.fornecedores f on f.id=d.fornecedor_id
    where d.empresa_id=p_empresa and pr.status='APROVADA' and d.regra_id is not null
      and (pr.saida_em at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
    group by d.fornecedor_id,f.nome,d.insumo,d.embalagem,d.comprado_em is not null
    order by f.nome,d.insumo
  ) g),'[]'::jsonb);
end $$;
revoke all on function pieggi.consolidar_compras(uuid,date,date) from public,anon;
grant execute on function pieggi.consolidar_compras(uuid,date,date) to authenticated;

create or replace function pieggi.operar_compras(p_empresa uuid,p_acao text,p_dados jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_regra pieggi.compra_regras%rowtype; v_ids uuid[]; p record; n integer;
begin
  if not pieggi.tem_acesso(p_empresa,array['ADMIN','EXPEDICAO_COMPRAS']) then raise exception 'Acesso negado.' using errcode='42501'; end if;
  if jsonb_typeof(p_dados) is distinct from 'object' then raise exception 'Dados inválidos.'; end if;
  if p_acao='FORNECEDOR_CRIAR' then
    insert into pieggi.fornecedores(empresa_id,nome,contato) values(p_empresa,trim(p_dados->>'nome'),coalesce(p_dados->>'contato','')) returning id into v_id;
  elsif p_acao='REGRA_CRIAR' then
    if not pieggi.tem_acesso(p_empresa,array['ADMIN']) then raise exception 'Somente o administrador cadastra conversões.' using errcode='42501'; end if;
    if not exists(select 1 from pieggi.fiscal_produtos where id=(p_dados->>'produtoId')::uuid and empresa_id=p_empresa and ativo)
      or not exists(select 1 from pieggi.fornecedores where id=(p_dados->>'fornecedorId')::uuid and empresa_id=p_empresa and ativo) then raise exception 'Produto ou fornecedor indisponível.'; end if;
    insert into pieggi.compra_regras(empresa_id,produto_id,fornecedor_id,insumo,unidade_producao,quantidade_producao,quantidade_compra,embalagem,criado_por)
      values(p_empresa,(p_dados->>'produtoId')::uuid,(p_dados->>'fornecedorId')::uuid,trim(p_dados->>'insumo'),p_dados->>'unidadeProducao',(p_dados->>'quantidadeProducao')::numeric,(p_dados->>'quantidadeCompra')::numeric,trim(p_dados->>'embalagem'),auth.uid()) returning id into v_id;
  elsif p_acao='REGRA_REVOGAR' then
    if not pieggi.tem_acesso(p_empresa,array['ADMIN']) then raise exception 'Somente o administrador altera conversões.' using errcode='42501'; end if;
    select * into v_regra from pieggi.compra_regras where id=(p_dados->>'id')::uuid and empresa_id=p_empresa for update;
    if not found or not v_regra.ativa then raise exception 'Regra indisponível.'; end if;
    update pieggi.compra_regras set ativa=false where id=v_regra.id; v_id:=v_regra.id;
  elsif p_acao in ('COMPRADO','REABRIR') then
    if jsonb_typeof(p_dados->'ids') is distinct from 'array' or jsonb_array_length(p_dados->'ids') not between 1 and 500 then raise exception 'Selecione as demandas.'; end if;
    select array_agg(distinct x::uuid) into v_ids from jsonb_array_elements_text(p_dados->'ids') x;
    if nullif(trim(p_dados->>'referencia'),'') is null or length(p_dados->>'referencia')>500 then raise exception 'Informe o comprovante/referência ou o motivo da reabertura.'; end if;
    select count(*) into n from pieggi.compra_demandas where empresa_id=p_empresa and id=any(v_ids);
    if n<>cardinality(v_ids) then raise exception 'Demanda indisponível.' using errcode='42501'; end if;
    for p in select pr.id,pr.status from pieggi.programacoes pr where pr.id in(select programacao_id from pieggi.compra_demandas where id=any(v_ids)) order by pr.id for share loop
      if p.status<>'APROVADA' then raise exception 'Programação alterada. Atualize as compras.' using errcode='40001'; end if;
    end loop;
    perform 1 from pieggi.compra_demandas where id=any(v_ids) order by id for update;
    if exists(select 1 from pieggi.compra_demandas where id=any(v_ids) and (regra_id is null or (p_acao='COMPRADO' and comprado_em is not null) or (p_acao='REABRIR' and comprado_em is null))) then raise exception 'Demanda já alterada ou sem conversão. Atualize a tela.' using errcode='40001'; end if;
    update pieggi.compra_demandas set comprado_em=case when p_acao='COMPRADO' then now() else null end,comprado_por=auth.uid(),referencia=trim(p_dados->>'referencia') where id=any(v_ids);
  else raise exception 'Ação desconhecida.'; end if;
  insert into pieggi.auditoria_eventos(id,empresa_id,usuario_id,acao,entidade,entidade_id,dados)
    values(gen_random_uuid(),p_empresa,auth.uid(),'COMPRAS_'||p_acao,'compras',v_id::text,jsonb_build_object('ids',v_ids,'referencia',p_dados->>'referencia'));
  return jsonb_build_object('id',v_id);
end $$;
revoke all on function pieggi.operar_compras(uuid,text,jsonb) from public,anon;
grant execute on function pieggi.operar_compras(uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
