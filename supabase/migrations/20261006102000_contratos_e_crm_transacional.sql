begin;
create table if not exists pieggi.evento_contratos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references pieggi.eventos(id),
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  arquivo_path text not null,
  assinado_em timestamptz not null,
  registrado_por uuid not null references pieggi.usuarios(id),
  criado_em timestamptz not null default now(),
  unique(evento_id)
);
alter table pieggi.evento_contratos enable row level security;
revoke all on pieggi.evento_contratos from public,anon,authenticated;
grant select on pieggi.evento_contratos to authenticated;
drop policy if exists contrato_ler on pieggi.evento_contratos;
create policy contrato_ler on pieggi.evento_contratos for select to authenticated using(pieggi.tem_acesso(empresa_id,array['ADMIN','COMERCIAL','ATENDIMENTO','FINANCEIRO']));

create or replace function pieggi.registrar_contrato(p_evento uuid,p_revisao integer,p_path text,p_assinado timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e pieggi.eventos%rowtype;
begin
  select * into e from pieggi.eventos where id=p_evento for update;
  if not found or not pieggi.tem_acesso(e.empresa_id,array['ADMIN','COMERCIAL','ATENDIMENTO']) then raise exception 'Acesso negado.' using errcode='42501'; end if;
  if p_revisao is distinct from e.revisao then raise exception 'Evento alterado. Atualize a tela.' using errcode='40001'; end if;
  if e.contrato_assinado_em is not null then raise exception 'Contrato já registrado.'; end if;
  if p_assinado is null or p_assinado>now() then raise exception 'Data de assinatura inválida.'; end if;
  if exists(select 1 from unnest(array[e.tabela_preco,e.pax::text,e.data_evento::text,e.horario_inicio::text,e.horario_fim::text,e.logradouro,e.numero_endereco,e.bairro,e.cidade,e.uf,e.cep,e.contato_local_nome,e.contato_local_telefone]) x where nullif(trim(x),'') is null) then raise exception 'Complete tabela, pax, data, horários, endereço e contato local no evento.'; end if;
  if not exists(select 1 from storage.objects where bucket_id='pieggi-evidencias' and name=p_path and split_part(name,'/',1)=e.id::text and owner_id=auth.uid()::text and metadata->>'mimetype'='application/pdf') then raise exception 'Envie o PDF assinado antes de registrar.'; end if;
  insert into pieggi.evento_contratos(evento_id,empresa_id,arquivo_path,assinado_em,registrado_por) values(e.id,e.empresa_id,p_path,p_assinado,auth.uid());
  update pieggi.eventos set contrato_assinado_em=p_assinado where id=e.id;
  insert into pieggi.auditoria_eventos(id,empresa_id,usuario_id,acao,entidade,entidade_id) values(gen_random_uuid(),e.empresa_id,auth.uid(),'CONTRATO_REGISTRADO','evento',e.id::text);
  return jsonb_build_object('id',e.id);
end $$;
revoke all on function pieggi.registrar_contrato(uuid,integer,text,timestamptz) from public,anon;
grant execute on function pieggi.registrar_contrato(uuid,integer,text,timestamptz) to authenticated;

-- CRUD comercial atômico. A RPC não aceita estados financeiros, operacionais ou assinatura.
create or replace function pieggi.salvar_evento(p_empresa uuid,p_id uuid,p_atualizado timestamptz,p_evento jsonb,p_cliente jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e pieggi.eventos%rowtype; c pieggi.clientes%rowtype; v_id uuid; v_cliente uuid; v_doc text;
begin
  if not pieggi.tem_acesso(p_empresa,array['ADMIN','COMERCIAL','ATENDIMENTO']) then raise exception 'Acesso negado.' using errcode='42501'; end if;
  if jsonb_typeof(p_evento) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_evento) k where k not in ('titulo','origem_lead','etapa_comercial','tabela_preco','pax','data_evento','horario_inicio','horario_fim','logradouro','numero_endereco','complemento','bairro','cidade','uf','cep','contato_local_nome','contato_local_telefone','observacoes')) then raise exception 'Campos não permitidos.'; end if;
  if p_id is not null then
    select * into e from pieggi.eventos where id=p_id and empresa_id=p_empresa for update;
    if not found then raise exception 'Evento não encontrado.' using errcode='42501'; end if;
    if p_atualizado is distinct from e.atualizado_em then raise exception 'Evento alterado por outra pessoa. Atualize a tela.' using errcode='40001'; end if;
    if p_evento ? 'etapa_comercial' and p_evento->>'etapa_comercial'='CONTRATO_ASSINADO' and e.contrato_assinado_em is null then raise exception 'Registre o PDF assinado na operação.'; end if;
    if e.contrato_assinado_em is not null and p_evento ? 'etapa_comercial' and p_evento->>'etapa_comercial'<>'CONTRATO_ASSINADO' then raise exception 'Contrato assinado não pode voltar no funil.'; end if;
    v_id:=e.id; v_cliente:=e.cliente_id;
  else
    v_id:=gen_random_uuid();
    e.id:=v_id; e.empresa_id:=p_empresa; e.etapa_comercial:='FRIO'; e.etapa_operacao:='BLOQUEADO'; e.etapa_financeiro:='A_FATURAR'; e.revisao:=1; e.criado_por:=auth.uid(); e.criado_em:=now(); e.atualizado_em:=now();
    if p_evento ? 'etapa_comercial' then raise exception 'Novo evento inicia em Frio.'; end if;
  end if;
  if p_cliente is not null and p_cliente<>'null'::jsonb then
    if nullif(trim(p_cliente->>'nome'),'') is null or coalesce(p_cliente->>'tipo','') not in ('PF','PJ') then raise exception 'Cliente inválido.'; end if;
    v_doc:=nullif(regexp_replace(coalesce(p_cliente->>'documento',''),'[^0-9]','','g'),'');
    if v_cliente is null and v_doc is not null then select id into v_cliente from pieggi.clientes where empresa_id=p_empresa and documento=v_doc; end if;
    if v_cliente is null then
      insert into pieggi.clientes(id,empresa_id,tipo,nome,documento,email,telefone) values(gen_random_uuid(),p_empresa,p_cliente->>'tipo',p_cliente->>'nome',v_doc,nullif(p_cliente->>'email',''),nullif(p_cliente->>'telefone','')) returning id into v_cliente;
    elsif p_id is not null then
      update pieggi.clientes set tipo=p_cliente->>'tipo',nome=p_cliente->>'nome',documento=v_doc,email=nullif(p_cliente->>'email',''),telefone=nullif(p_cliente->>'telefone',''),atualizado_em=now() where id=v_cliente and empresa_id=p_empresa;
    end if;
  end if;
  if v_cliente is null then raise exception 'Informe o cliente.'; end if;
  e:=jsonb_populate_record(e,p_evento); e.cliente_id:=v_cliente;
  if length(trim(coalesce(e.titulo,'')))<2 then raise exception 'Informe o título do evento.'; end if;
  if e.horario_inicio is not null and e.horario_fim is not null and e.horario_fim<=e.horario_inicio then raise exception 'Término deve ser posterior ao início.'; end if;
  if e.etapa_comercial in ('CONTRATO_ENVIADO','CONTRATO_ASSINADO') and exists(select 1 from unnest(array[e.tabela_preco,e.pax::text,e.data_evento::text,e.horario_inicio::text,e.horario_fim::text,e.logradouro,e.numero_endereco,e.bairro,e.cidade,e.uf,e.cep,e.contato_local_nome,e.contato_local_telefone]) x where nullif(trim(x),'') is null) then raise exception 'Complete os dados obrigatórios antes do contrato.'; end if;
  if p_id is null then insert into pieggi.eventos select e.*;
  else
    update pieggi.eventos set titulo=e.titulo,origem_lead=e.origem_lead,etapa_comercial=e.etapa_comercial,tabela_preco=e.tabela_preco,pax=e.pax,data_evento=e.data_evento,horario_inicio=e.horario_inicio,horario_fim=e.horario_fim,logradouro=e.logradouro,numero_endereco=e.numero_endereco,complemento=e.complemento,bairro=e.bairro,cidade=e.cidade,uf=e.uf,cep=e.cep,contato_local_nome=e.contato_local_nome,contato_local_telefone=e.contato_local_telefone,observacoes=e.observacoes where id=e.id;
  end if;
  select * into e from pieggi.eventos where id=v_id;
  select * into c from pieggi.clientes where id=v_cliente;
  insert into pieggi.auditoria_eventos(id,empresa_id,usuario_id,acao,entidade,entidade_id) values(gen_random_uuid(),p_empresa,auth.uid(),case when p_id is null then 'EVENTO_CRIADO' else 'EVENTO_ATUALIZADO' end,'evento',v_id::text);
  return jsonb_build_object('evento',to_jsonb(e),'cliente',to_jsonb(c));
end $$;
revoke all on function pieggi.salvar_evento(uuid,uuid,timestamptz,jsonb,jsonb) from public,anon;
grant execute on function pieggi.salvar_evento(uuid,uuid,timestamptz,jsonb,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
