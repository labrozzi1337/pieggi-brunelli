begin;
alter table pieggi.programacoes add column if not exists roteiro_campo jsonb not null default '[]'::jsonb;
create table if not exists pieggi.campo_etapas (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references pieggi.fiscal_empresas(id),
  evento_id uuid not null references pieggi.eventos(id), programacao_id uuid not null references pieggi.programacoes(id),
  ordem integer not null check(ordem>0), tipo text not null check(tipo in ('MONTAGEM','REPOSICAO','DESMONTAGEM')),
  titulo text not null, orientacao text not null, previsto_em timestamptz not null,
  concluido_em timestamptz, acesso_id uuid references pieggi.campo_acessos(id), observacao text,
  unique(programacao_id,ordem)
);
alter table pieggi.campo_etapas enable row level security;
revoke all on pieggi.campo_etapas from public,anon,authenticated;
grant select on pieggi.campo_etapas to authenticated;
drop policy if exists campo_etapas_ler on pieggi.campo_etapas;
create policy campo_etapas_ler on pieggi.campo_etapas for select to authenticated using(pieggi.tem_acesso(empresa_id));

create or replace function pieggi.salvar_programacao_campo(p_evento uuid,p_revisao integer,p_dados jsonb,p_rotulos jsonb,p_roteiro jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;etapa jsonb;anterior timestamptz;horario timestamptz;fase integer;fase_anterior integer:=0;
begin
  if jsonb_typeof(p_roteiro) is distinct from 'array' or jsonb_array_length(p_roteiro)>200 then raise exception 'Roteiro de campo inválido.';end if;
  for etapa in select value from jsonb_array_elements(p_roteiro) loop
    if jsonb_typeof(etapa) is distinct from 'object' or exists(select 1 from jsonb_object_keys(etapa) k where k not in ('tipo','titulo','orientacao','previstoEm')) then raise exception 'Campos de roteiro não permitidos.';end if;
    if exists(select 1 from unnest(array['tipo','titulo','orientacao','previstoEm']) k where jsonb_typeof(etapa->k) is distinct from 'string') then raise exception 'Textos e horário do roteiro são obrigatórios.';end if;
    if coalesce(etapa->>'tipo','') not in ('MONTAGEM','REPOSICAO','DESMONTAGEM') or length(trim(coalesce(etapa->>'titulo',''))) not between 2 and 200 or length(trim(coalesce(etapa->>'orientacao',''))) not between 5 and 2000 then raise exception 'Informe tipo, título e orientação de cada etapa.';end if;
    horario:=(etapa->>'previstoEm')::timestamptz;
    fase:=array_position(array['MONTAGEM','REPOSICAO','DESMONTAGEM'],etapa->>'tipo');
    if fase<fase_anterior then raise exception 'Ordene montagem, reposição e desmontagem nesta sequência.';end if;
    fase_anterior:=fase;
    if horario is null or not isfinite(horario) or (anterior is not null and horario<anterior) then raise exception 'Organize as etapas em ordem de horário.';end if;
    anterior:=horario;
  end loop;
  r:=pieggi.salvar_programacao_documentos(p_evento,p_revisao,p_dados,p_rotulos);
  update pieggi.programacoes set roteiro_campo=p_roteiro where id=(r->>'id')::uuid;
  return r;
end $$;
revoke all on function pieggi.salvar_programacao_campo(uuid,integer,jsonb,jsonb,jsonb) from public,anon;
grant execute on function pieggi.salvar_programacao_campo(uuid,integer,jsonb,jsonb,jsonb) to authenticated;

create or replace function pieggi.gerar_roteiro_campo()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='APROVADA' and old.status is distinct from new.status then
    if jsonb_array_length(new.roteiro_campo)=0 then raise exception 'Defina o roteiro de montagem, reposição e desmontagem na programação antes de aprovar.';end if;
    if exists(select 1 from unnest(array['MONTAGEM','REPOSICAO','DESMONTAGEM']) tipo where not exists(select 1 from jsonb_array_elements(new.roteiro_campo) etapa where etapa->>'tipo'=tipo)) then raise exception 'O roteiro precisa conter montagem, reposição e desmontagem.';end if;
    insert into pieggi.campo_etapas(empresa_id,evento_id,programacao_id,ordem,tipo,titulo,orientacao,previsto_em)
      select new.empresa_id,new.evento_id,new.id,n::integer,etapa->>'tipo',etapa->>'titulo',etapa->>'orientacao',(etapa->>'previstoEm')::timestamptz
      from jsonb_array_elements(new.roteiro_campo) with ordinality x(etapa,n) on conflict(programacao_id,ordem) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists gerar_roteiro_campo on pieggi.programacoes;
create trigger gerar_roteiro_campo after update of status on pieggi.programacoes for each row execute function pieggi.gerar_roteiro_campo();

-- Reutiliza a consulta do token de 050; acrescenta apenas o roteiro da versão aprovada.
create or replace function pieggi.consultar_campo(p_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a pieggi.campo_acessos%rowtype;e pieggi.eventos%rowtype;p pieggi.programacoes%rowtype;fotos jsonb;etapas jsonb;
begin
  select * into a from pieggi.campo_acessos where token_hash=p_hash and revogado_em is null and expira_em>now();
  select * into e from pieggi.eventos where id=a.evento_id;
  if e.id is null or e.data_evento is distinct from (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Link indisponível, revogado ou fora do dia do evento.' using errcode='42501';end if;
  select * into p from pieggi.programacoes where evento_id=e.id and status='APROVADA';
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'titulo',t.titulo,'estado',t.estado,'atualizadoEm',t.atualizado_em) order by array_position(array['Chegada ao local','Higienização e mesa montada','Reposição','Desmontagem'],t.titulo)),'[]') into fotos from pieggi.operacao_tarefas t where t.programacao_id=p.id and t.tipo='CAMPO';
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'ordem',t.ordem,'tipo',t.tipo,'titulo',t.titulo,'orientacao',t.orientacao,'previstoEm',t.previsto_em,'concluidoEm',t.concluido_em,'observacao',t.observacao) order by t.ordem),'[]') into etapas from pieggi.campo_etapas t where t.programacao_id=p.id;
  return jsonb_build_object('acessoId',a.id,'responsavel',a.responsavel,'expiraEm',a.expira_em,
    'evento',jsonb_build_object('id',e.id,'titulo',e.titulo,'revisao',e.revisao,'etapa',e.etapa_operacao,'data',e.data_evento,'inicio',e.horario_inicio,'fim',e.horario_fim,'pax',e.pax,'logradouro',e.logradouro,'numero',e.numero_endereco,'complemento',e.complemento,'bairro',e.bairro,'cidade',e.cidade,'uf',e.uf,'contato',e.contato_local_nome,'telefone',e.contato_local_telefone),
    'programacao',case when p.id is not null then jsonb_build_object('id',p.id,'versao',p.versao,'alteracoes',p.alteracoes,'saidaEm',p.saida_em,'itens',p.itens) else null end,'tarefas',fotos,'etapas',etapas);
end $$;
revoke all on function pieggi.consultar_campo(text) from public,anon,authenticated;
grant execute on function pieggi.consultar_campo(text) to service_role;

create or replace function pieggi.concluir_etapa_campo(p_hash text,p_etapa uuid,p_revisao integer,p_observacao text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a pieggi.campo_acessos%rowtype;e pieggi.eventos%rowtype;t pieggi.campo_etapas%rowtype;
begin
  select * into a from pieggi.campo_acessos where token_hash=p_hash;
  select * into e from pieggi.eventos where id=a.evento_id for update;
  select * into a from pieggi.campo_acessos where id=a.id for share;
  if e.id is null or a.revogado_em is not null or a.expira_em<=now() or e.data_evento is distinct from (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Link indisponível, revogado ou fora do dia do evento.' using errcode='42501';end if;
  select * into t from pieggi.campo_etapas where id=p_etapa and evento_id=e.id for update;
  if not found or not exists(select 1 from pieggi.programacoes where id=t.programacao_id and status='APROVADA') then raise exception 'Etapa indisponível nesta programação.' using errcode='42501';end if;
  if t.concluido_em is not null then return jsonb_build_object('id',t.id);end if;
  if p_revisao is distinct from e.revisao then raise exception 'Evento alterado. Atualize antes de continuar.' using errcode='40001';end if;
  if e.etapa_operacao<>'EM_CAMPO' then raise exception 'A expedição ainda não liberou o evento ou ele já foi encerrado.';end if;
  if length(coalesce(p_observacao,''))>1000 then raise exception 'Observação excede o limite.';end if;
  if not exists(select 1 from pieggi.operacao_tarefas where programacao_id=t.programacao_id and tipo='CAMPO' and titulo='Chegada ao local' and estado='PRONTO') then raise exception 'Registre a foto de chegada antes de iniciar o roteiro.';end if;
  if t.tipo in ('REPOSICAO','DESMONTAGEM') and not exists(select 1 from pieggi.operacao_tarefas where programacao_id=t.programacao_id and tipo='CAMPO' and titulo=case t.tipo when 'REPOSICAO' then 'Higienização e mesa montada' else 'Reposição' end and estado='PRONTO') then raise exception 'Registre a foto da fase anterior antes de continuar o roteiro.';end if;
  if exists(select 1 from pieggi.campo_etapas where programacao_id=t.programacao_id and ordem<t.ordem and concluido_em is null) then raise exception 'Conclua a etapa anterior do roteiro.';end if;
  update pieggi.campo_etapas set concluido_em=now(),acesso_id=a.id,observacao=nullif(trim(p_observacao),'') where id=t.id;
  update pieggi.eventos set atualizado_em=now() where id=e.id;
  insert into pieggi.auditoria_eventos(id,empresa_id,acao,entidade,entidade_id,dados) values(gen_random_uuid(),e.empresa_id,'CAMPO_ETAPA_CONCLUIDA','evento',e.id::text,jsonb_build_object('etapaId',t.id,'acessoId',a.id,'responsavel',a.responsavel));
  return jsonb_build_object('id',t.id);
end $$;
revoke all on function pieggi.concluir_etapa_campo(text,uuid,integer,text) from public,anon,authenticated;
grant execute on function pieggi.concluir_etapa_campo(text,uuid,integer,text) to service_role;

create or replace function pieggi.campo_foto_exige_roteiro()
returns trigger language plpgsql security definer set search_path='' as $$
declare tipo_etapa text;
begin
  if new.tipo='CAMPO' and new.estado='PRONTO' and old.estado<>'PRONTO' then
    tipo_etapa:=case new.titulo when 'Higienização e mesa montada' then 'MONTAGEM' when 'Reposição' then 'REPOSICAO' when 'Desmontagem' then 'DESMONTAGEM' else null end;
    if tipo_etapa is not null and exists(select 1 from pieggi.campo_etapas where programacao_id=new.programacao_id and tipo=tipo_etapa and concluido_em is null) then raise exception 'Conclua as etapas correspondentes do roteiro antes de enviar esta foto.';end if;
  end if;
  return new;
end $$;
drop trigger if exists campo_foto_exige_roteiro on pieggi.operacao_tarefas;
create trigger campo_foto_exige_roteiro before update of estado on pieggi.operacao_tarefas for each row execute function pieggi.campo_foto_exige_roteiro();
notify pgrst,'reload schema';
commit;
