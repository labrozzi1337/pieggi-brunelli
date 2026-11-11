begin;
create table if not exists pieggi.evento_equipe (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references pieggi.fiscal_empresas(id),
  evento_id uuid not null references pieggi.eventos(id), programacao_id uuid not null references pieggi.programacoes(id),
  fornecedor_id uuid not null references pieggi.fornecedores(id), categoria text not null check(categoria in ('EQUIPE','LOCACAO','INSUMO')),
  funcao text not null check(length(trim(funcao)) between 2 and 200), inicio timestamptz not null, fim timestamptz not null,
  orientacoes text not null default '', estado text not null default 'SOLICITADA' check(estado in ('SOLICITADA','APROVADA','CONFIRMADA','A_REVISAR','EXECUTADA','CANCELADA')),
  referencia text, motivo text, criado_por uuid not null references pieggi.usuarios(id), atualizado_em timestamptz not null default now(),
  check(fim>inicio), check(length(orientacoes)<=5000)
);
create index if not exists equipe_evento_idx on pieggi.evento_equipe(empresa_id,evento_id,inicio);
create index if not exists equipe_fornecedor_idx on pieggi.evento_equipe(fornecedor_id,inicio,fim) where categoria='EQUIPE' and estado in ('APROVADA','CONFIRMADA');
create table if not exists pieggi.evento_verbas (
  evento_id uuid primary key references pieggi.eventos(id), empresa_id uuid not null references pieggi.fiscal_empresas(id),
  limite numeric(14,2) not null check(limite>=0), atualizado_em timestamptz not null default now()
);
create table if not exists pieggi.equipe_valores (
  equipe_id uuid primary key references pieggi.evento_equipe(id), empresa_id uuid not null references pieggi.fiscal_empresas(id),
  valor numeric(14,2) not null check(valor>0), aprovado_por uuid not null references pieggi.usuarios(id), aprovado_em timestamptz not null default now(),
  referencia text not null check(length(trim(referencia)) between 2 and 300)
);
do $$ declare t text; begin
  foreach t in array array['evento_equipe','evento_verbas','equipe_valores'] loop
    execute format('alter table pieggi.%I enable row level security',t);
    execute format('revoke all on pieggi.%I from public,anon,authenticated',t);
    execute format('grant select on pieggi.%I to authenticated',t);
    execute format('drop policy if exists equipe_ler on pieggi.%I',t);
    execute format('create policy equipe_ler on pieggi.%I for select to authenticated using(pieggi.tem_acesso(empresa_id,%L::text[]))',t,
      case when t='evento_equipe' then '{ADMIN,PROGRAMACAO,EXPEDICAO_COMPRAS,FINANCEIRO,ATENDIMENTO,COMERCIAL}' else '{ADMIN,FINANCEIRO,ATENDIMENTO,COMERCIAL}' end);
  end loop;
end $$;
drop policy if exists fornecedor_financeiro_ler on pieggi.fornecedores;
create policy fornecedor_financeiro_ler on pieggi.fornecedores for select to authenticated using(pieggi.tem_acesso(empresa_id,array['ADMIN','FINANCEIRO','ATENDIMENTO','COMERCIAL']));

create or replace function pieggi.equipe_revisar_programacao()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='INVALIDADA' and old.status='APROVADA' then
    update pieggi.evento_equipe set estado='A_REVISAR',motivo='Programação invalidada. Revise escala e contratação antes de confirmar novamente.',atualizado_em=now()
    where programacao_id=new.id and estado not in ('CANCELADA','EXECUTADA');
  end if;
  return new;
end $$;
drop trigger if exists equipe_revisar_programacao on pieggi.programacoes;
create trigger equipe_revisar_programacao after update of status on pieggi.programacoes for each row execute function pieggi.equipe_revisar_programacao();

create or replace function pieggi.operar_equipe(p_evento uuid,p_revisao integer,p_acao text,p_dados jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e pieggi.eventos%rowtype; r pieggi.evento_equipe%rowtype; pr uuid; v_id uuid; limite numeric; valor numeric; total numeric; anterior jsonb;
begin
  select * into e from pieggi.eventos where id=p_evento for update;
  if not found or not pieggi.tem_acesso(e.empresa_id,array['ADMIN','PROGRAMACAO','EXPEDICAO_COMPRAS','FINANCEIRO']) then raise exception 'Acesso negado.' using errcode='42501';end if;
  if p_acao='SOLICITAR' then
    select * into r from pieggi.evento_equipe where id=(p_dados->>'id')::uuid;
    if found then
      if r.evento_id is distinct from e.id or r.fornecedor_id is distinct from (p_dados->>'fornecedorId')::uuid or r.categoria is distinct from p_dados->>'categoria' or r.funcao is distinct from p_dados->>'funcao' or r.inicio is distinct from (p_dados->>'inicio')::timestamptz or r.fim is distinct from (p_dados->>'fim')::timestamptz or r.orientacoes is distinct from coalesce(p_dados->>'orientacoes','') then raise exception 'Chave já utilizada por outra solicitação.';end if;
      if not pieggi.tem_acesso(e.empresa_id,array['ADMIN','PROGRAMACAO','EXPEDICAO_COMPRAS']) then raise exception 'Perfil sem acesso à escala.' using errcode='42501';end if;
      return jsonb_build_object('id',r.id);
    end if;
  end if;
  if p_revisao is distinct from e.revisao then raise exception 'Evento alterado. Atualize a escala.' using errcode='40001';end if;
  if jsonb_typeof(p_dados) is distinct from 'object' then raise exception 'Dados inválidos.';end if;
  if p_acao in ('VERBA','APROVAR','REALIZAR') and not pieggi.tem_acesso(e.empresa_id,array['ADMIN','FINANCEIRO']) then raise exception 'Somente o financeiro aprova ou realiza despesas.' using errcode='42501';end if;
  if p_acao in ('SOLICITAR','EDITAR','CONFIRMAR') and not pieggi.tem_acesso(e.empresa_id,array['ADMIN','PROGRAMACAO','EXPEDICAO_COMPRAS']) then raise exception 'Perfil sem acesso à escala.' using errcode='42501';end if;
  if p_acao='VERBA' then
    limite:=(p_dados->>'limite')::numeric;
    if limite is null or limite<0 or limite>999999999 or limite<>round(limite,2) then raise exception 'Verba inválida.';end if;
    -- Revisão não cancela compromisso financeiro: só cancelamento explícito libera a reserva.
    select coalesce(sum(v.valor),0) into total from pieggi.equipe_valores v join pieggi.evento_equipe eq on eq.id=v.equipe_id where eq.evento_id=e.id and eq.estado<>'CANCELADA';
    if limite<total then raise exception 'A verba não pode ser menor que as contratações já aprovadas.';end if;
    select to_jsonb(v) into anterior from pieggi.evento_verbas v where evento_id=e.id;
    insert into pieggi.evento_verbas(evento_id,empresa_id,limite) values(e.id,e.empresa_id,limite) on conflict(evento_id) do update set limite=excluded.limite,atualizado_em=now();v_id:=e.id;
  else
    if e.contrato_assinado_em is null and nullif(trim(e.liberacao_excepcional_motivo),'') is null then raise exception 'Contrato pendente.';end if;
    select id into pr from pieggi.programacoes where evento_id=e.id and status='APROVADA' order by versao desc limit 1 for share;
    if p_acao<>'CANCELAR' and pr is null then raise exception 'Aprove a programação antes de alterar a escala.';end if;
    if p_acao<>'SOLICITAR' then
      select * into r from pieggi.evento_equipe where id=(p_dados->>'id')::uuid and evento_id=e.id for update;
      if not found then raise exception 'Contratação indisponível.' using errcode='42501';end if;
      anterior:=to_jsonb(r);v_id:=r.id;
      if r.estado='CANCELADA' then raise exception 'Contratação cancelada. Crie uma nova solicitação.';end if;
      if p_acao<>'EDITAR' and p_acao<>'CANCELAR' and r.programacao_id<>pr then raise exception 'Escala de versão anterior. Revise e solicite nova aprovação.';end if;
    end if;
    if p_acao in ('SOLICITAR','EDITAR') then
      if e.etapa_operacao in ('EM_CAMPO','ENTREGUE') or (p_acao='EDITAR' and r.estado='EXECUTADA') then raise exception 'Não altere uma contratação após a saída/execução. Registre ajuste separado.';end if;
      if exists(select 1 from jsonb_object_keys(p_dados) k where k not in ('id','fornecedorId','categoria','funcao','inicio','fim','orientacoes')) then raise exception 'Campos não permitidos.';end if;
      if (p_dados->>'inicio')::timestamptz is null or (p_dados->>'fim')::timestamptz is null or (p_dados->>'fim')::timestamptz<=(p_dados->>'inicio')::timestamptz or coalesce(p_dados->>'categoria','') not in ('EQUIPE','LOCACAO','INSUMO') or length(trim(coalesce(p_dados->>'funcao',''))) not between 2 and 200 then raise exception 'Informe função, categoria e horários válidos. O fim deve ser posterior ao início.';end if;
      if not exists(select 1 from pieggi.fornecedores where id=(p_dados->>'fornecedorId')::uuid and empresa_id=e.empresa_id and ativo) then raise exception 'Fornecedor indisponível.';end if;
      if p_acao='SOLICITAR' then
        insert into pieggi.evento_equipe(id,empresa_id,evento_id,programacao_id,fornecedor_id,categoria,funcao,inicio,fim,orientacoes,criado_por)
          values((p_dados->>'id')::uuid,e.empresa_id,e.id,pr,(p_dados->>'fornecedorId')::uuid,p_dados->>'categoria',p_dados->>'funcao',(p_dados->>'inicio')::timestamptz,(p_dados->>'fim')::timestamptz,coalesce(p_dados->>'orientacoes',''),auth.uid()) returning id into v_id;
      else
        update pieggi.evento_equipe set programacao_id=pr,fornecedor_id=(p_dados->>'fornecedorId')::uuid,categoria=p_dados->>'categoria',funcao=p_dados->>'funcao',inicio=(p_dados->>'inicio')::timestamptz,fim=(p_dados->>'fim')::timestamptz,orientacoes=coalesce(p_dados->>'orientacoes',''),estado='SOLICITADA',referencia=null,motivo='Alterada: exige nova aprovação financeira.',atualizado_em=now() where id=r.id;
      end if;
    elsif p_acao='APROVAR' then
      if r.estado<>'SOLICITADA' then raise exception 'Somente uma solicitação revisada pode ser aprovada.';end if;
      valor:=(p_dados->>'valor')::numeric;
      if valor is null or valor<=0 or valor>999999999 or valor<>round(valor,2) or length(trim(coalesce(p_dados->>'referencia',''))) not between 2 and 300 then raise exception 'Informe valor e referência da cotação.';end if;
      select v.limite into limite from pieggi.evento_verbas v where v.evento_id=e.id;
      select coalesce(sum(v.valor),0) into total from pieggi.equipe_valores v join pieggi.evento_equipe eq on eq.id=v.equipe_id where eq.evento_id=e.id and eq.id<>r.id and eq.estado<>'CANCELADA';
      if limite is null or total+valor>limite then raise exception 'Verba não definida ou insuficiente. Ajuste a alçada financeira antes de aprovar.';end if;
      if r.categoria='EQUIPE' then
        -- Serializa somente a pessoa/fornecedor, inclusive aprovações em eventos diferentes.
        perform pg_advisory_xact_lock(hashtextextended(r.fornecedor_id::text,0));
        if exists(select 1 from pieggi.evento_equipe eq where eq.fornecedor_id=r.fornecedor_id and eq.id<>r.id and eq.categoria='EQUIPE' and eq.estado not in ('CANCELADA','EXECUTADA') and exists(select 1 from pieggi.equipe_valores v where v.equipe_id=eq.id) and eq.inicio<r.fim and eq.fim>r.inicio) then raise exception 'Profissional já reservado neste horário. Ajuste a escala.';end if;
      end if;
      insert into pieggi.equipe_valores(equipe_id,empresa_id,valor,aprovado_por,referencia) values(r.id,e.empresa_id,valor,auth.uid(),p_dados->>'referencia') on conflict(equipe_id) do update set valor=excluded.valor,aprovado_por=auth.uid(),aprovado_em=now(),referencia=excluded.referencia;
      update pieggi.evento_equipe set estado='APROVADA',motivo=null,atualizado_em=now() where id=r.id;
    elsif p_acao='CONFIRMAR' then
      if r.estado<>'APROVADA' or length(trim(coalesce(p_dados->>'referencia',''))) not between 2 and 300 then raise exception 'Aprovação financeira e referência de aceite são obrigatórias.';end if;
      update pieggi.evento_equipe set estado='CONFIRMADA',referencia=p_dados->>'referencia',atualizado_em=now() where id=r.id;
    elsif p_acao='REALIZAR' then
      if r.estado<>'CONFIRMADA' or length(trim(coalesce(p_dados->>'referencia',''))) not between 2 and 300 or (p_dados->>'competencia')::date is null or (p_dados->>'competencia')::date>current_date then raise exception 'Confirme a prestação e informe referência/data efetiva.';end if;
      select v.valor into valor from pieggi.equipe_valores v where equipe_id=r.id;
      insert into pieggi.evento_custos(empresa_id,evento_id,categoria,descricao,valor,competencia,referencia,idempotencia,criado_por)
        values(e.empresa_id,e.id,case when r.categoria='INSUMO' then 'ALIMENTACAO' else r.categoria end,r.funcao,valor,(p_dados->>'competencia')::date,p_dados->>'referencia',r.id,auth.uid());
      update pieggi.evento_equipe set estado='EXECUTADA',atualizado_em=now() where id=r.id;
    elsif p_acao='CANCELAR' then
      if r.estado='EXECUTADA' then raise exception 'Despesa já realizada. Estorne no financeiro com motivo; não apague a execução.';end if;
      if length(trim(coalesce(p_dados->>'motivo',''))) not between 5 and 500 then raise exception 'Informe motivo do cancelamento.';end if;
      update pieggi.evento_equipe set estado='CANCELADA',motivo=p_dados->>'motivo',atualizado_em=now() where id=r.id;
    else raise exception 'Ação desconhecida.';end if;
  end if;
  update pieggi.eventos set atualizado_em=now() where id=e.id;
  insert into pieggi.operacao_notificacoes(empresa_id,evento_id,mensagem) values(e.empresa_id,e.id,'Equipe/extra: '||p_acao||'. Consulte a escala atualizada.');
  insert into pieggi.auditoria_eventos(id,empresa_id,usuario_id,acao,entidade,entidade_id,dados) values(gen_random_uuid(),e.empresa_id,auth.uid(),'EQUIPE_'||p_acao,'evento',e.id::text,jsonb_build_object('id',v_id,'antes',anterior,'dados',p_dados));
  return jsonb_build_object('id',v_id);
end $$;
revoke all on function pieggi.operar_equipe(uuid,integer,text,jsonb) from public,anon;
grant execute on function pieggi.operar_equipe(uuid,integer,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
