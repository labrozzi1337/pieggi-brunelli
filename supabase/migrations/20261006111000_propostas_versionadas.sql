begin;
-- Versões comerciais imutáveis. Quantidade comercial não é rendimento de produção.
create table if not exists pieggi.propostas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  evento_id uuid not null references pieggi.eventos(id),
  versao integer not null check(versao>0),
  status text not null default 'RASCUNHO' check(status in ('RASCUNHO','APROVADA','INVALIDADA')),
  briefing jsonb not null,
  itens jsonb not null,
  snapshot jsonb not null,
  desconto numeric(14,2) not null check(desconto>=0),
  taxas numeric(14,2) not null check(taxas>=0),
  total numeric(14,2) not null check(total>0),
  custo_estimado numeric(14,2) check(custo_estimado>=0),
  fonte_preco text not null,
  alteracoes text not null,
  validade date not null,
  idempotencia uuid not null unique,
  criado_por uuid not null references pieggi.usuarios(id),
  aprovado_por uuid references pieggi.usuarios(id),
  aprovado_em timestamptz,
  criado_em timestamptz not null default now(),
  unique(evento_id,versao)
);
create index if not exists propostas_empresa_idx on pieggi.propostas(empresa_id,evento_id,versao desc);
create unique index if not exists propostas_uma_aprovada_idx on pieggi.propostas(evento_id) where status='APROVADA';
alter table pieggi.propostas enable row level security;
revoke all on pieggi.propostas from public,anon,authenticated;
grant select on pieggi.propostas to authenticated;
drop policy if exists propostas_ler on pieggi.propostas;
create policy propostas_ler on pieggi.propostas for select to authenticated using(pieggi.tem_acesso(empresa_id,array['ADMIN','COMERCIAL','ATENDIMENTO','FINANCEIRO']));
alter table pieggi.evento_valores add column if not exists proposta_id uuid references pieggi.propostas(id);

create or replace function pieggi.proposta_snapshot(p_evento uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('evento',jsonb_build_object('titulo',e.titulo,'tabelaPreco',e.tabela_preco,'pax',e.pax,'data',e.data_evento,'inicio',e.horario_inicio,'fim',e.horario_fim,'logradouro',e.logradouro,'numero',e.numero_endereco,'complemento',e.complemento,'bairro',e.bairro,'cidade',e.cidade,'uf',e.uf,'cep',e.cep,'contato',e.contato_local_nome,'telefone',e.contato_local_telefone),
  'cliente',jsonb_build_object('id',c.id,'tipo',c.tipo,'nome',c.nome,'documento',c.documento,'email',c.email,'telefone',c.telefone))
  from pieggi.eventos e join pieggi.clientes c on c.id=e.cliente_id where e.id=p_evento
$$;
revoke all on function pieggi.proposta_snapshot(uuid) from public,anon,authenticated;

create or replace function pieggi.salvar_proposta(p_evento uuid,p_revisao integer,p_dados jsonb,p_chave uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e pieggi.eventos%rowtype; p pieggi.propostas%rowtype; b jsonb; l jsonb; subtotal numeric:=0; qtd numeric; preco numeric; d numeric; t numeric; custo numeric; v_id uuid;
begin
  select * into e from pieggi.eventos where id=p_evento for update;
  if not found or not pieggi.tem_acesso(e.empresa_id,array['ADMIN','COMERCIAL','ATENDIMENTO']) then raise exception 'Acesso negado.' using errcode='42501'; end if;
  if jsonb_typeof(p_dados) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_dados) k where k not in ('briefing','itens','desconto','taxas','custoEstimado','fontePreco','alteracoes','validade')) or p_chave is null then raise exception 'Proposta inválida.'; end if;
  select * into p from pieggi.propostas where idempotencia=p_chave;
  if found then
    if p.evento_id<>e.id or jsonb_build_object('briefing',p.briefing,'itens',p.itens,'desconto',p.desconto,'taxas',p.taxas,'custoEstimado',p.custo_estimado,'fontePreco',p.fonte_preco,'alteracoes',p.alteracoes,'validade',p.validade) is distinct from p_dados then raise exception 'Chave utilizada por outra proposta.'; end if;
    return jsonb_build_object('id',p.id);
  end if;
  if e.revisao is distinct from p_revisao then raise exception 'Evento alterado. Atualize antes de salvar.' using errcode='40001'; end if;
  if e.contrato_assinado_em is not null or e.etapa_comercial='PERDIDO' then raise exception 'Evento encerrado comercialmente. Alterações exigem tratamento contratual.'; end if;
  b:=p_dados->'briefing';
  if jsonb_typeof(b) is distinct from 'object' or exists(select 1 from jsonb_object_keys(b) k where k not in ('startse','categoria','restricoesConfirmadas','restricoes','restritos','cobrancaRestritos','escopo'))
    or jsonb_typeof(b->'startse') is distinct from 'boolean' or b->'restricoesConfirmadas' is distinct from 'true'::jsonb
    or coalesce(b->>'categoria','') not in ('STARTSE_INTELI','NEGOCIACAO','EXTERNOS','WTC')
    or length(trim(coalesce(b->>'escopo',''))) not between 5 and 5000
    or length(coalesce(b->>'restricoes',''))>2000
    or jsonb_typeof(b->'restritos') is distinct from 'number' or (b->>'restritos')::numeric<0 or (b->>'restritos')::numeric<>trunc((b->>'restritos')::numeric)
    or coalesce(b->>'cobrancaRestritos','') not in ('SEM_RESTRICOES','PAGO','CORTESIA') then raise exception 'Confirme cliente StartSe, tabela e restrições antes de montar a proposta.'; end if;
  if ((b->>'restritos')::numeric>0 and (length(trim(coalesce(b->>'restricoes','')))<2 or b->>'cobrancaRestritos'='SEM_RESTRICOES')) or ((b->>'restritos')::numeric=0 and b->>'cobrancaRestritos'<>'SEM_RESTRICOES') or (e.pax is not null and (b->>'restritos')::numeric>e.pax) then raise exception 'Confira quantidade, tipo e cobrança dos participantes com restrições.'; end if;
  if (b->>'startse')::boolean and b->>'categoria'<>'STARTSE_INTELI' then raise exception 'StartSe utiliza sua tabela específica.'; end if;
  if jsonb_typeof(p_dados->'itens') is distinct from 'array' or jsonb_array_length(p_dados->'itens') not between 1 and 100 then raise exception 'Informe de 1 a 100 itens comerciais.'; end if;
  for l in select value from jsonb_array_elements(p_dados->'itens') loop
    if jsonb_typeof(l) is distinct from 'object' or exists(select 1 from jsonb_object_keys(l) k where k not in ('nome','servico','quantidade','unidade','preco')) or length(trim(coalesce(l->>'nome',''))) not between 2 and 200 or length(trim(coalesce(l->>'servico',''))) not between 2 and 100 or coalesce(l->>'unidade','') not in ('UN','PAX','SERVICO','KG','L') or jsonb_typeof(l->'quantidade') is distinct from 'number' or jsonb_typeof(l->'preco') is distinct from 'number' then raise exception 'Item comercial inválido.'; end if;
    qtd:=(l->>'quantidade')::numeric;preco:=(l->>'preco')::numeric;
    if qtd<=0 or qtd>1000000 or qtd<>round(qtd,3) or preco<=0 or preco>999999999 or preco<>round(preco,2) or (l->>'unidade' in ('UN','PAX','SERVICO') and qtd<>trunc(qtd)) then raise exception 'Confira quantidade e preço, com no máximo duas casas para valores.'; end if;
    subtotal:=subtotal+round(qtd*preco,2);
  end loop;
  if jsonb_typeof(p_dados->'desconto') is distinct from 'number' or jsonb_typeof(p_dados->'taxas') is distinct from 'number' or coalesce(jsonb_typeof(p_dados->'custoEstimado'),'') not in ('null','number') then raise exception 'Totais inválidos.'; end if;
  d:=(p_dados->>'desconto')::numeric;t:=(p_dados->>'taxas')::numeric;custo:=(p_dados->>'custoEstimado')::numeric;
  if d is null or t is null or least(d,t)<0 or d>subtotal or d<>round(d,2) or t<>round(t,2) or (custo is not null and (custo<0 or custo<>round(custo,2) or custo>999999999)) or subtotal-d+t<=0 or subtotal-d+t>999999999 then raise exception 'Totais inválidos.'; end if;
  if b->>'categoria' in ('STARTSE_INTELI','WTC') and t<>0 then raise exception 'Esta tabela é isenta de taxas e logística.'; end if;
  if exists(select 1 from unnest(array['fontePreco','alteracoes','validade']) f(k) where jsonb_typeof(p_dados->k) is distinct from 'string') or coalesce(p_dados->>'validade','') !~ '^\d{4}-\d{2}-\d{2}$' or length(trim(coalesce(p_dados->>'fontePreco',''))) not between 5 and 500 or length(trim(coalesce(p_dados->>'alteracoes',''))) not between 5 and 2000 or (p_dados->>'validade')::date is null or (p_dados->>'validade')::date<(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Informe fonte de preço, resumo da revisão e validade vigente.'; end if;
  insert into pieggi.propostas(empresa_id,evento_id,versao,briefing,itens,snapshot,desconto,taxas,total,custo_estimado,fonte_preco,alteracoes,validade,idempotencia,criado_por)
    values(e.empresa_id,e.id,coalesce((select max(versao) from pieggi.propostas where evento_id=e.id),0)+1,b,p_dados->'itens',pieggi.proposta_snapshot(e.id),d,t,subtotal-d+t,custo,p_dados->>'fontePreco',p_dados->>'alteracoes',(p_dados->>'validade')::date,p_chave,auth.uid()) returning id into v_id;
  update pieggi.eventos set atualizado_em=now() where id=e.id;
  insert into pieggi.auditoria_eventos(id,empresa_id,usuario_id,acao,entidade,entidade_id,dados) values(gen_random_uuid(),e.empresa_id,auth.uid(),'PROPOSTA_VERSIONADA','proposta',v_id::text,jsonb_build_object('eventoId',e.id));
  return jsonb_build_object('id',v_id);
end $$;
revoke all on function pieggi.salvar_proposta(uuid,integer,jsonb,uuid) from public,anon;
grant execute on function pieggi.salvar_proposta(uuid,integer,jsonb,uuid) to authenticated;

create or replace function pieggi.aprovar_proposta(p_evento uuid,p_revisao integer,p_proposta uuid,p_confirmado boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e pieggi.eventos%rowtype; p pieggi.propostas%rowtype;
begin
  select * into e from pieggi.eventos where id=p_evento for update;
  if not found or not pieggi.tem_acesso(e.empresa_id,array['ADMIN','COMERCIAL','ATENDIMENTO']) then raise exception 'Acesso negado.' using errcode='42501'; end if;
  select * into p from pieggi.propostas where id=p_proposta and evento_id=e.id for update;
  if not found or p_confirmado is distinct from true then raise exception 'Confirme o resumo completo antes de aprovar.'; end if;
  if p.status='APROVADA' and p.snapshot=pieggi.proposta_snapshot(e.id) then return jsonb_build_object('id',p.id); end if;
  if e.revisao is distinct from p_revisao then raise exception 'Evento alterado. Atualize antes de aprovar.' using errcode='40001'; end if;
  if e.contrato_assinado_em is not null or e.etapa_comercial='PERDIDO' or p.status<>'RASCUNHO' or p.versao<>(select max(versao) from pieggi.propostas where evento_id=e.id) then raise exception 'Aprove somente a última versão em rascunho, antes do contrato.'; end if;
  if p.snapshot is distinct from pieggi.proposta_snapshot(e.id) then raise exception 'Briefing ou cliente mudou. Salve uma nova versão com os dados atuais.'; end if;
  if p.validade<(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Proposta vencida. Crie uma nova versão.'; end if;
  if exists(select 1 from unnest(array[e.tabela_preco,e.pax::text,e.data_evento::text,e.horario_inicio::text,e.horario_fim::text,e.logradouro,e.numero_endereco,e.bairro,e.cidade,e.uf,e.cep,e.contato_local_nome,e.contato_local_telefone]) x where nullif(trim(x),'') is null) then raise exception 'Complete tabela, pax, data, horários, endereço e contato no evento antes de aprovar.'; end if;
  update pieggi.propostas set status='INVALIDADA' where evento_id=e.id and status='APROVADA';
  update pieggi.propostas set status='APROVADA',aprovado_em=now(),aprovado_por=auth.uid() where id=p.id;
  insert into pieggi.evento_valores(evento_id,valor_venda,custo_estimado,proposta_id) values(e.id,p.total,p.custo_estimado,p.id) on conflict(evento_id) do update set valor_venda=excluded.valor_venda,custo_estimado=excluded.custo_estimado,proposta_id=excluded.proposta_id,atualizado_em=now();
  update pieggi.eventos set etapa_comercial='QUENTE' where id=e.id;
  insert into pieggi.auditoria_eventos(id,empresa_id,usuario_id,acao,entidade,entidade_id,dados) values(gen_random_uuid(),e.empresa_id,auth.uid(),'PROPOSTA_APROVADA','proposta',p.id::text,jsonb_build_object('eventoId',e.id,'versao',p.versao));
  return jsonb_build_object('id',p.id);
end $$;
revoke all on function pieggi.aprovar_proposta(uuid,integer,uuid,boolean) from public,anon;
grant execute on function pieggi.aprovar_proposta(uuid,integer,uuid,boolean) to authenticated;

-- Uma venda originada em proposta não pode ser sobrescrita por formulário financeiro.
create or replace function pieggi.proteger_valor_proposta()
returns trigger language plpgsql security definer set search_path='' as $$
declare p pieggi.propostas%rowtype;
begin
  if tg_op='UPDATE' and old.proposta_id is not null and new.proposta_id is null and exists(select 1 from pieggi.propostas where id=old.proposta_id and status='APROVADA') then raise exception 'Revise a proposta para alterar a venda aprovada.'; end if;
  if new.proposta_id is not null then
    select * into p from pieggi.propostas where id=new.proposta_id;
    if p.evento_id is distinct from new.evento_id or p.status<>'APROVADA' or new.valor_venda is distinct from p.total or new.custo_estimado is distinct from p.custo_estimado then raise exception 'Revise a proposta para alterar os valores aprovados.'; end if;
  end if;
  return new;
end $$;
drop trigger if exists valores_proposta_proteger on pieggi.evento_valores;
create trigger valores_proposta_proteger before insert or update on pieggi.evento_valores for each row execute function pieggi.proteger_valor_proposta();

create or replace function pieggi.proposta_portao_evento()
returns trigger language plpgsql security definer set search_path='' as $$
declare p pieggi.propostas%rowtype;
begin
  if row(new.titulo,new.cliente_id,new.tabela_preco,new.pax,new.data_evento,new.horario_inicio,new.horario_fim,new.logradouro,new.numero_endereco,new.complemento,new.bairro,new.cidade,new.uf,new.cep,new.contato_local_nome,new.contato_local_telefone) is distinct from row(old.titulo,old.cliente_id,old.tabela_preco,old.pax,old.data_evento,old.horario_inicio,old.horario_fim,old.logradouro,old.numero_endereco,old.complemento,old.bairro,old.cidade,old.uf,old.cep,old.contato_local_nome,old.contato_local_telefone) then
    if old.contrato_assinado_em is not null and exists(select 1 from pieggi.propostas where evento_id=old.id and status='APROVADA') then raise exception 'Contrato já assinado. Trate o aditivo antes de mudar o briefing aprovado.'; end if;
    update pieggi.propostas set status='INVALIDADA' where evento_id=old.id and status='APROVADA';
    update pieggi.evento_valores set proposta_id=null,valor_venda=null,custo_estimado=null where evento_id=old.id and proposta_id is not null;
  end if;
  if (new.etapa_comercial='CONTRATO_ENVIADO' and old.etapa_comercial<>'CONTRATO_ENVIADO') or (new.contrato_assinado_em is not null and old.contrato_assinado_em is null) then
    if exists(select 1 from pieggi.propostas where evento_id=old.id) then
      select * into p from pieggi.propostas where evento_id=old.id and status='APROVADA';
      if not found or p.versao<>(select max(versao) from pieggi.propostas where evento_id=old.id) or p.snapshot is distinct from pieggi.proposta_snapshot(old.id) or p.validade<(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Aprove a proposta vigente antes de formalizar o contrato.'; end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists evento_proposta_portao on pieggi.eventos;
create trigger evento_proposta_portao before update on pieggi.eventos for each row execute function pieggi.proposta_portao_evento();

create or replace function pieggi.proposta_portao_cliente()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if row(new.tipo,new.nome,new.documento,new.email,new.telefone) is distinct from row(old.tipo,old.nome,old.documento,old.email,old.telefone) then
    if exists(select 1 from pieggi.eventos e join pieggi.propostas p on p.evento_id=e.id and p.status='APROVADA' where e.cliente_id=old.id and e.contrato_assinado_em is not null) then raise exception 'Cliente vinculado a proposta contratada. Trate o aditivo antes de alterar os dados.'; end if;
    perform 1 from pieggi.eventos where cliente_id=old.id order by id for update;
    update pieggi.propostas set status='INVALIDADA' where status='APROVADA' and evento_id in (select id from pieggi.eventos where cliente_id=old.id);
    update pieggi.evento_valores set proposta_id=null,valor_venda=null,custo_estimado=null where proposta_id is not null and evento_id in (select id from pieggi.eventos where cliente_id=old.id);
  end if;
  return new;
end $$;
drop trigger if exists cliente_proposta_portao on pieggi.clientes;
create trigger cliente_proposta_portao before update on pieggi.clientes for each row execute function pieggi.proposta_portao_cliente();

-- Handoff explicitamente sem preços; planejamento deve calcular rendimentos separadamente.
create or replace function pieggi.proposta_operacional(p_evento uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e pieggi.eventos%rowtype; p pieggi.propostas%rowtype;
begin
  select * into e from pieggi.eventos where id=p_evento;
  if not found or not pieggi.tem_acesso(e.empresa_id,array['ADMIN','PROGRAMACAO','COMERCIAL','ATENDIMENTO']) then raise exception 'Acesso negado.' using errcode='42501'; end if;
  select * into p from pieggi.propostas where evento_id=e.id and status='APROVADA';
  if not found or p.snapshot is distinct from pieggi.proposta_snapshot(e.id) then return null; end if;
  return jsonb_build_object('versao',p.versao,'escopo',p.briefing->>'escopo','restricoes',p.briefing->>'restricoes','restritos',p.briefing->'restritos','itens',(select jsonb_agg(jsonb_build_object('nome',i->>'nome','servico',i->>'servico','quantidade',i->'quantidade','unidade',i->>'unidade')) from jsonb_array_elements(p.itens) i));
end $$;
revoke all on function pieggi.proposta_operacional(uuid) from public,anon;
grant execute on function pieggi.proposta_operacional(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
