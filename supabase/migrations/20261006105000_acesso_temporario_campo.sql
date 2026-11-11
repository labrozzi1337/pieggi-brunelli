begin;
-- A URL é uma credencial temporária: armazenamos somente SHA-256, nunca o token.
create table if not exists pieggi.campo_acessos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references pieggi.eventos(id),
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  responsavel text not null check(length(trim(responsavel)) between 2 and 100),
  expira_em timestamptz not null,
  revogado_em timestamptz,
  criado_por uuid not null references pieggi.usuarios(id),
  criado_em timestamptz not null default now()
);
create index if not exists campo_acessos_evento_idx on pieggi.campo_acessos(evento_id);
alter table pieggi.campo_acessos enable row level security;
revoke all on pieggi.campo_acessos from public,anon,authenticated;
grant select(id,evento_id,empresa_id,responsavel,expira_em,revogado_em,criado_em) on pieggi.campo_acessos to authenticated;
drop policy if exists campo_acessos_ler on pieggi.campo_acessos;
create policy campo_acessos_ler on pieggi.campo_acessos for select to authenticated using(pieggi.tem_acesso(empresa_id,array['ADMIN','EXPEDICAO_COMPRAS']));

create or replace function pieggi.gerenciar_acesso_campo(p_evento uuid,p_responsavel text,p_hash text,p_revogar uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e pieggi.eventos%rowtype; v_id uuid; v_expira timestamptz;
begin
  select * into e from pieggi.eventos where id=p_evento for update;
  if not found or not pieggi.tem_acesso(e.empresa_id,array['ADMIN','EXPEDICAO_COMPRAS']) then raise exception 'Acesso negado.' using errcode='42501'; end if;
  if p_revogar is not null then
    update pieggi.campo_acessos set revogado_em=now() where id=p_revogar and evento_id=e.id and revogado_em is null returning id into v_id;
    if not found then raise exception 'Link já revogado ou indisponível.'; end if;
  else
    if e.data_evento is null or e.data_evento<(now() at time zone 'America/Sao_Paulo')::date or e.etapa_operacao='ENTREGUE' then raise exception 'Informe uma data válida para o evento.'; end if;
    if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_responsavel is null or length(trim(p_responsavel)) not between 2 and 100 then raise exception 'Responsável ou token inválido.'; end if;
    if e.contrato_assinado_em is null and nullif(trim(e.liberacao_excepcional_motivo),'') is null then raise exception 'Formalize o contrato antes de compartilhar o campo.'; end if;
    v_expira:=((e.data_evento+1)::timestamp at time zone 'America/Sao_Paulo');
    update pieggi.campo_acessos set revogado_em=now() where evento_id=e.id and revogado_em is null;
    insert into pieggi.campo_acessos(evento_id,empresa_id,token_hash,responsavel,expira_em,criado_por) values(e.id,e.empresa_id,p_hash,trim(p_responsavel),v_expira,auth.uid()) returning id into v_id;
  end if;
  insert into pieggi.auditoria_eventos(id,empresa_id,usuario_id,acao,entidade,entidade_id,dados) values(gen_random_uuid(),e.empresa_id,auth.uid(),case when p_revogar is null then 'CAMPO_LINK_CRIADO' else 'CAMPO_LINK_REVOGADO' end,'evento',e.id::text,jsonb_build_object('acessoId',v_id));
  return jsonb_build_object('id',v_id,'expiraEm',v_expira);
end $$;
revoke all on function pieggi.gerenciar_acesso_campo(uuid,text,text,uuid) from public,anon;
grant execute on function pieggi.gerenciar_acesso_campo(uuid,text,text,uuid) to authenticated;

-- Exclusivo do backend. O token não é um usuário Supabase nem autoriza leituras genéricas.
create or replace function pieggi.consultar_campo(p_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a pieggi.campo_acessos%rowtype; e pieggi.eventos%rowtype; p pieggi.programacoes%rowtype; v_tarefas jsonb;
begin
  select * into a from pieggi.campo_acessos where token_hash=p_hash and revogado_em is null and expira_em>now();
  select * into e from pieggi.eventos where id=a.evento_id;
  if e.id is null or e.data_evento is distinct from (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Link indisponível, revogado ou fora do dia do evento.' using errcode='42501'; end if;
  select * into p from pieggi.programacoes where evento_id=e.id and status='APROVADA';
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'titulo',t.titulo,'estado',t.estado,'atualizadoEm',t.atualizado_em) order by array_position(array['Chegada ao local','Higienização e mesa montada','Reposição','Desmontagem'],t.titulo)),'[]') into v_tarefas from pieggi.operacao_tarefas t where t.programacao_id=p.id and t.tipo='CAMPO';
  return jsonb_build_object('acessoId',a.id,'responsavel',a.responsavel,'expiraEm',a.expira_em,
    'evento',jsonb_build_object('id',e.id,'titulo',e.titulo,'revisao',e.revisao,'etapa',e.etapa_operacao,'data',e.data_evento,'inicio',e.horario_inicio,'fim',e.horario_fim,'pax',e.pax,'logradouro',e.logradouro,'numero',e.numero_endereco,'complemento',e.complemento,'bairro',e.bairro,'cidade',e.cidade,'uf',e.uf,'contato',e.contato_local_nome,'telefone',e.contato_local_telefone),
    'programacao',case when p.id is not null then jsonb_build_object('id',p.id,'versao',p.versao,'alteracoes',p.alteracoes,'saidaEm',p.saida_em,'itens',p.itens) else null end,'tarefas',v_tarefas);
end $$;
revoke all on function pieggi.consultar_campo(text) from public,anon,authenticated;
grant execute on function pieggi.consultar_campo(text) to service_role;

create or replace function pieggi.registrar_foto_campo(p_hash text,p_tarefa uuid,p_revisao integer,p_path text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a pieggi.campo_acessos%rowtype; e pieggi.eventos%rowtype; t pieggi.operacao_tarefas%rowtype; v_ordem text[]:=array['Chegada ao local','Higienização e mesa montada','Reposição','Desmontagem'];
begin
  select * into a from pieggi.campo_acessos where token_hash=p_hash;
  select * into e from pieggi.eventos where id=a.evento_id for update;
  select * into a from pieggi.campo_acessos where id=a.id for share;
  if e.id is null or a.revogado_em is not null or a.expira_em<=now() or e.data_evento is distinct from (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Link indisponível, revogado ou fora do dia do evento.' using errcode='42501'; end if;
  if p_revisao is distinct from e.revisao then raise exception 'Evento alterado. Atualize antes de enviar.' using errcode='40001'; end if;
  if e.etapa_operacao<>'EM_CAMPO' then raise exception 'A expedição ainda não liberou o evento ou ele já foi encerrado.'; end if;
  select * into t from pieggi.operacao_tarefas where id=p_tarefa and evento_id=e.id and tipo='CAMPO' and evidencia_obrigatoria for update;
  if not found or not exists(select 1 from pieggi.programacoes where id=t.programacao_id and status='APROVADA') then raise exception 'Tarefa indisponível nesta programação.' using errcode='42501'; end if;
  if t.estado='PRONTO' then raise exception 'Foto já registrada. Atualize a tela.'; end if;
  if array_position(v_ordem,t.titulo) is null or exists(select 1 from pieggi.operacao_tarefas anterior where anterior.programacao_id=t.programacao_id and anterior.tipo='CAMPO' and array_position(v_ordem,anterior.titulo)<array_position(v_ordem,t.titulo) and anterior.estado<>'PRONTO') then raise exception 'Conclua a etapa anterior antes de continuar.'; end if;
  if not exists(select 1 from storage.objects where bucket_id='pieggi-evidencias' and name=p_path and split_part(name,'/',1)=e.id::text and split_part(name,'/',2)=a.id::text and metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')) then raise exception 'Foto inválida para este evento.'; end if;
  update pieggi.operacao_tarefas set estado='PRONTO',evidencia_path=p_path,concluido_por=null,atualizado_em=now() where id=t.id;
  update pieggi.eventos set atualizado_em=now() where id=e.id;
  insert into pieggi.auditoria_eventos(id,empresa_id,acao,entidade,entidade_id,dados) values(gen_random_uuid(),e.empresa_id,'CAMPO_FOTO_REGISTRADA','evento',e.id::text,jsonb_build_object('acessoId',a.id,'responsavel',a.responsavel,'tarefaId',t.id));
  return jsonb_build_object('id',t.id);
end $$;
revoke all on function pieggi.registrar_foto_campo(text,uuid,integer,text) from public,anon,authenticated;
grant execute on function pieggi.registrar_foto_campo(text,uuid,integer,text) to service_role;
notify pgrst,'reload schema';
commit;
