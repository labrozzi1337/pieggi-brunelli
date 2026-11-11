begin;
create table if not exists pieggi.evento_custos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  evento_id uuid not null references pieggi.eventos(id),
  categoria text not null check(categoria in ('ALIMENTACAO','EQUIPE','LOCACAO','LOGISTICA','OUTROS')),
  descricao text not null check(length(trim(descricao)) between 2 and 200),
  valor numeric(14,2) not null check(valor>0),
  competencia date not null,
  referencia text not null check(length(trim(referencia)) between 2 and 300),
  idempotencia uuid not null unique,
  criado_por uuid not null references pieggi.usuarios(id),
  criado_em timestamptz not null default now(),
  cancelado_em timestamptz,
  cancelado_por uuid references pieggi.usuarios(id),
  motivo_cancelamento text
);
create index if not exists evento_custos_empresa_idx on pieggi.evento_custos(empresa_id,evento_id);
alter table pieggi.evento_custos enable row level security;
revoke all on pieggi.evento_custos from public,anon,authenticated;
grant select on pieggi.evento_custos to authenticated;
drop policy if exists custos_ler on pieggi.evento_custos;
create policy custos_ler on pieggi.evento_custos for select to authenticated using(pieggi.tem_acesso(empresa_id,array['ADMIN','FINANCEIRO','COMERCIAL','ATENDIMENTO']));

create or replace function pieggi.operar_financeiro(p_evento uuid,p_revisao integer,p_acao text,p_dados jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e pieggi.eventos%rowtype; c pieggi.evento_custos%rowtype; v_id uuid; venda numeric; custo numeric;
begin
  select * into e from pieggi.eventos where id=p_evento for update;
  if not found or not pieggi.tem_acesso(e.empresa_id,array['ADMIN','FINANCEIRO']) then raise exception 'Perfil sem acesso ao financeiro.' using errcode='42501'; end if;
  if jsonb_typeof(p_dados) is distinct from 'object' then raise exception 'Dados inválidos.'; end if;
  if p_acao='CUSTO_CRIAR' then
    select * into c from pieggi.evento_custos where idempotencia=(p_dados->>'idempotencia')::uuid;
    if found then
      if c.evento_id<>e.id or c.valor is distinct from (p_dados->>'valor')::numeric or c.descricao is distinct from p_dados->>'descricao' or c.categoria is distinct from p_dados->>'categoria' or c.competencia is distinct from (p_dados->>'competencia')::date or c.referencia is distinct from p_dados->>'referencia' then raise exception 'Chave já utilizada por outro lançamento.'; end if;
      return jsonb_build_object('id',c.id);
    end if;
  end if;
  if p_revisao is distinct from e.revisao then raise exception 'Evento alterado. Atualize antes de lançar.' using errcode='40001'; end if;
  if p_acao='VALORES_SALVAR' then
    if exists(select 1 from jsonb_object_keys(p_dados) k where k not in ('venda','custoEstimado')) then raise exception 'Campos não permitidos.'; end if;
    venda:=(p_dados->>'venda')::numeric;custo:=(p_dados->>'custoEstimado')::numeric;
    if venda is null or custo is null or least(venda,custo)<0 or greatest(venda,custo)>999999999 or venda<>round(venda,2) or custo<>round(custo,2) then raise exception 'Valores inválidos. Use duas casas decimais.'; end if;
    insert into pieggi.evento_valores(evento_id,valor_venda,custo_estimado) values(e.id,venda,custo) on conflict(evento_id) do update set valor_venda=excluded.valor_venda,custo_estimado=excluded.custo_estimado,atualizado_em=now();v_id:=e.id;
  elsif p_acao='CUSTO_CRIAR' then
    if exists(select 1 from jsonb_object_keys(p_dados) k where k not in ('categoria','descricao','valor','competencia','referencia','idempotencia')) or coalesce(p_dados->>'categoria','') not in ('ALIMENTACAO','EQUIPE','LOCACAO','LOGISTICA','OUTROS') or length(trim(coalesce(p_dados->>'descricao',''))) not between 2 and 200 or length(trim(coalesce(p_dados->>'referencia',''))) not between 2 and 300 or (p_dados->>'valor')::numeric is null or (p_dados->>'valor')::numeric<>round((p_dados->>'valor')::numeric,2) or (p_dados->>'valor')::numeric>999999999 then raise exception 'Custo inválido.'; end if;
    insert into pieggi.evento_custos(empresa_id,evento_id,categoria,descricao,valor,competencia,referencia,idempotencia,criado_por) values(e.empresa_id,e.id,p_dados->>'categoria',p_dados->>'descricao',(p_dados->>'valor')::numeric,(p_dados->>'competencia')::date,p_dados->>'referencia',(p_dados->>'idempotencia')::uuid,auth.uid()) returning id into v_id;
  elsif p_acao='CUSTO_CANCELAR' then
    if length(trim(coalesce(p_dados->>'motivo',''))) not between 5 and 500 then raise exception 'Informe o motivo do cancelamento.'; end if;
    update pieggi.evento_custos set cancelado_em=now(),cancelado_por=auth.uid(),motivo_cancelamento=p_dados->>'motivo' where id=(p_dados->>'id')::uuid and evento_id=e.id and cancelado_em is null returning id into v_id;
    if not found then raise exception 'Lançamento já cancelado ou indisponível.'; end if;
  else raise exception 'Ação financeira desconhecida.'; end if;
  update pieggi.eventos set atualizado_em=now() where id=e.id;
  insert into pieggi.auditoria_eventos(id,empresa_id,usuario_id,acao,entidade,entidade_id,dados) values(gen_random_uuid(),e.empresa_id,auth.uid(),p_acao,'evento',e.id::text,jsonb_build_object('lancamentoId',v_id,'dados',p_dados));
  return jsonb_build_object('id',v_id);
end $$;
revoke all on function pieggi.operar_financeiro(uuid,integer,text,jsonb) from public,anon;
grant execute on function pieggi.operar_financeiro(uuid,integer,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
