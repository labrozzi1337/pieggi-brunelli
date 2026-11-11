-- Aplicar depois de 20261005154000. Não altera documentos fiscais existentes.
begin;

create or replace function pieggi.tem_acesso(p_empresa uuid, p_papeis text[] default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from pieggi.usuarios u
    join pieggi.usuario_empresas ue on ue.usuario_id = u.id
    where u.id = auth.uid() and u.ativo and ue.empresa_id = p_empresa
      and (p_papeis is null or exists (
        select 1 from pieggi.usuario_papeis up where up.usuario_id = u.id and up.papel = any(p_papeis)
      ))
  )
$$;
revoke all on function pieggi.tem_acesso(uuid,text[]) from public, anon;
grant execute on function pieggi.tem_acesso(uuid,text[]) to authenticated;

create table if not exists pieggi.programacoes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references pieggi.eventos(id),
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  versao integer not null check (versao > 0),
  status text not null default 'RASCUNHO' check (status in ('RASCUNHO','APROVADA','INVALIDADA')),
  saida_em timestamptz not null,
  itens jsonb not null check (jsonb_typeof(itens) = 'array' and jsonb_array_length(itens) > 0),
  alteracoes text not null check (length(trim(alteracoes)) >= 5),
  criado_por uuid not null references pieggi.usuarios(id),
  aprovado_por uuid references pieggi.usuarios(id),
  aprovado_em timestamptz,
  criado_em timestamptz not null default now(),
  unique(evento_id,versao),
  unique(id,evento_id)
);
create unique index if not exists programacao_aprovada_unica on pieggi.programacoes(evento_id) where status='APROVADA';

create table if not exists pieggi.operacao_tarefas (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references pieggi.eventos(id),
  programacao_id uuid not null,
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  tipo text not null check (tipo in ('PRODUCAO','EXPEDICAO','CAMPO','CONFERENCIA','RETORNO')),
  setor text not null,
  titulo text not null,
  descricao text not null default '',
  quantidade numeric(14,3),
  unidade text,
  estado text not null default 'PENDENTE' check (estado in ('PENDENTE','EM_ANDAMENTO','PRONTO')),
  evidencia_obrigatoria boolean not null default false,
  evidencia_path text,
  concluido_por uuid references pieggi.usuarios(id),
  atualizado_em timestamptz not null default now(),
  foreign key (programacao_id,evento_id) references pieggi.programacoes(id,evento_id)
);
create index if not exists operacao_tarefas_evento_idx on pieggi.operacao_tarefas(evento_id,programacao_id,tipo);

create table if not exists pieggi.operacao_notificacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  evento_id uuid not null references pieggi.eventos(id),
  mensagem text not null,
  criado_em timestamptz not null default now()
);

-- Fila transacional: assinatura não significa que uma API externa já foi executada.
create table if not exists pieggi.integracao_fila (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  evento_id uuid not null references pieggi.eventos(id),
  tipo text not null check (tipo in ('AGENDA','FATURAMENTO','POS_EVENTO')),
  status text not null default 'AGUARDANDO_CONFIGURACAO' check (status in ('AGUARDANDO_CONFIGURACAO','PENDENTE','PROCESSANDO','CONCLUIDO','ERRO')),
  tentativas integer not null default 0,
  criado_em timestamptz not null default now(),
  unique(evento_id,tipo)
);

create table if not exists pieggi.financeiro_titulos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  evento_id uuid not null references pieggi.eventos(id),
  descricao text not null check(length(trim(descricao)) > 0),
  valor numeric(14,2) not null check(valor > 0),
  vencimento date not null,
  recebido_em date,
  forma text not null check(forma in ('PIX','BOLETO','TRANSFERENCIA','CARTAO','DINHEIRO')),
  referencia text,
  idempotencia uuid not null unique,
  criado_em timestamptz not null default now()
);

create table if not exists pieggi.evento_pos_venda (
  evento_id uuid primary key references pieggi.eventos(id),
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  nota integer check(nota between 0 and 10),
  comentario text not null default '',
  retorno_em date,
  atualizado_em timestamptz not null default now()
);

alter table pieggi.eventos add column if not exists revisao integer not null default 1;

-- Uma alteração operacional invalida todos os derivados na mesma transação.
create or replace function pieggi.evento_proteger_fluxo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then
    new.revisao := old.revisao + 1;
    new.atualizado_em := now();
    if row(new.pax,new.data_evento,new.horario_inicio,new.horario_fim,new.logradouro,new.numero_endereco,new.complemento,new.bairro,new.cidade,new.uf,new.cep)
       is distinct from row(old.pax,old.data_evento,old.horario_inicio,old.horario_fim,old.logradouro,old.numero_endereco,old.complemento,old.bairro,old.cidade,old.uf,old.cep) then
      update pieggi.programacoes set status='INVALIDADA' where evento_id=new.id and status='APROVADA';
      if found then
        new.etapa_operacao := 'PROGRAMACAO';
        insert into pieggi.operacao_notificacoes(empresa_id,evento_id,mensagem)
          values(new.empresa_id,new.id,'Dados do evento alterados. Programação e derivados bloqueados até nova aprovação.');
      end if;
    end if;
    if old.contrato_assinado_em is not null and new.contrato_assinado_em is null then
      raise exception 'Contrato assinado exige procedimento de cancelamento.' using errcode='P0001';
    end if;
  end if;
  if new.contrato_assinado_em is not null and (TG_OP='INSERT' or old.contrato_assinado_em is null) then
    new.etapa_comercial := 'CONTRATO_ASSINADO';
    new.etapa_operacao := 'PROGRAMACAO';
    insert into pieggi.integracao_fila(empresa_id,evento_id,tipo)
      values(new.empresa_id,new.id,'AGENDA'),(new.empresa_id,new.id,'FATURAMENTO') on conflict do nothing;
  end if;
  return new;
end
$$;
-- AFTER para filas com FK; BEFORE para revisão e invalidação.
create or replace function pieggi.evento_filas()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.contrato_assinado_em is not null then
    insert into pieggi.integracao_fila(empresa_id,evento_id,tipo)
      values(new.empresa_id,new.id,'AGENDA'),(new.empresa_id,new.id,'FATURAMENTO') on conflict do nothing;
  end if;
  if new.etapa_operacao='ENTREGUE' then
    insert into pieggi.integracao_fila(empresa_id,evento_id,tipo) values(new.empresa_id,new.id,'POS_EVENTO') on conflict do nothing;
  end if;
  return new;
end
$$;
drop trigger if exists evento_proteger_fluxo on pieggi.eventos;
create trigger evento_proteger_fluxo before update on pieggi.eventos for each row execute function pieggi.evento_proteger_fluxo();
drop trigger if exists evento_filas on pieggi.eventos;
create trigger evento_filas after insert or update on pieggi.eventos for each row execute function pieggi.evento_filas();

-- Usuários leem com seu JWT; escritas do fluxo passam apenas pela RPC transacional.
do $$ declare t text; begin
  foreach t in array array['programacoes','operacao_tarefas','operacao_notificacoes','integracao_fila','financeiro_titulos','evento_pos_venda'] loop
    execute format('alter table pieggi.%I enable row level security',t);
    execute format('revoke all on table pieggi.%I from public,anon,authenticated',t);
    execute format('grant select on table pieggi.%I to authenticated',t);
    execute format('drop policy if exists leitura_empresa on pieggi.%I',t);
    if t in ('financeiro_titulos','integracao_fila') then
      execute format('create policy leitura_empresa on pieggi.%I for select to authenticated using (pieggi.tem_acesso(empresa_id,ARRAY[''ADMIN'',''COMERCIAL'',''ATENDIMENTO'',''FINANCEIRO'']))',t);
    else
      execute format('create policy leitura_empresa on pieggi.%I for select to authenticated using (pieggi.tem_acesso(empresa_id,ARRAY[''ADMIN'',''COMERCIAL'',''ATENDIMENTO'',''FINANCEIRO'',''PROGRAMACAO'',''PRODUCAO'',''EXPEDICAO_COMPRAS'']))',t);
    end if;
  end loop;
end $$;
grant select on pieggi.eventos, pieggi.clientes, pieggi.evento_valores to authenticated;
drop policy if exists eventos_ler_empresa on pieggi.eventos;
create policy eventos_ler_empresa on pieggi.eventos for select to authenticated using(pieggi.tem_acesso(empresa_id,ARRAY['ADMIN','COMERCIAL','ATENDIMENTO','FINANCEIRO','PROGRAMACAO','PRODUCAO','EXPEDICAO_COMPRAS']));
drop policy if exists clientes_ler_empresa on pieggi.clientes;
create policy clientes_ler_empresa on pieggi.clientes for select to authenticated using(pieggi.tem_acesso(empresa_id,ARRAY['ADMIN','COMERCIAL','ATENDIMENTO','FINANCEIRO']));
drop policy if exists valores_ler_empresa on pieggi.evento_valores;
create policy valores_ler_empresa on pieggi.evento_valores for select to authenticated using(exists(select 1 from pieggi.eventos e where e.id=evento_id and pieggi.tem_acesso(e.empresa_id,ARRAY['ADMIN','COMERCIAL','ATENDIMENTO','FINANCEIRO'])));

create or replace function pieggi.operar_evento(p_evento uuid, p_revisao integer, p_acao text, p_dados jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e pieggi.eventos%rowtype;
  p pieggi.programacoes%rowtype;
  t pieggi.operacao_tarefas%rowtype;
  item jsonb;
  v_id uuid;
  v_versao integer;
  v_papeis text[];
  v_tipo text;
begin
  select * into e from pieggi.eventos where id=p_evento for update;
  if not found or not pieggi.tem_acesso(e.empresa_id) then raise exception 'Evento indisponível.' using errcode='42501'; end if;
  v_papeis := case
    when p_acao in ('PROGRAMACAO_SALVAR','PROGRAMACAO_APROVAR') then array['ADMIN','PROGRAMACAO']
    when p_acao in ('TITULO_CRIAR','TITULO_RECEBER') then array['ADMIN','FINANCEIRO']
    when p_acao='POS_VENDA' then array['ADMIN','ATENDIMENTO','COMERCIAL']
    when p_acao in ('EXPEDIR','ENTREGAR') then array['ADMIN','EXPEDICAO_COMPRAS']
    when p_acao='TAREFA_ATUALIZAR' then array['ADMIN','PRODUCAO','EXPEDICAO_COMPRAS','PROGRAMACAO']
    else array['ADMIN'] end;
  if not pieggi.tem_acesso(e.empresa_id,v_papeis) then raise exception 'Perfil sem permissão.' using errcode='42501'; end if;
  if e.revisao is distinct from p_revisao then raise exception 'Evento alterado por outra pessoa. Atualize a tela.' using errcode='40001'; end if;
  if jsonb_typeof(p_dados) is distinct from 'object' then raise exception 'Dados inválidos.'; end if;

  if p_acao='PROGRAMACAO_SALVAR' then
    if e.contrato_assinado_em is null and nullif(trim(e.liberacao_excepcional_motivo),'') is null then raise exception 'Contrato ainda não formalizado.'; end if;
    if e.etapa_operacao in ('EM_CAMPO','ENTREGUE') then raise exception 'Evento já saiu. Registre a ocorrência antes de reprogramar.'; end if;
    if jsonb_typeof(p_dados->'itens') is distinct from 'array' then raise exception 'Informe os itens da programação.'; end if;
    if jsonb_array_length(p_dados->'itens') not between 1 and 500 then raise exception 'Informe entre 1 e 500 itens.'; end if;
    for item in select value from jsonb_array_elements(p_dados->'itens') loop
      if nullif(trim(item->>'nome'),'') is null or nullif(trim(item->>'receita'),'') is null
        or coalesce((item->>'quantidade')::numeric,0)<=0
        or coalesce(item->>'setor','') not in ('A_CLASSIFICAR','COZINHA_QUENTE','COZINHA_FRIA','CONFEITARIA','BEBIDAS','ESTRUTURA','FORNECEDOR')
        or coalesce(item->>'unidade','') not in ('UN','KG','G','L','ML') then raise exception 'Item incompleto: nome, receita, quantidade, unidade e setor são obrigatórios.'; end if;
      if exists(select 1 from jsonb_object_keys(item) k where k not in ('nome','receita','quantidade','unidade','setor','servico','produtoId')) then raise exception 'Campos não permitidos no item operacional.'; end if;
    end loop;
    select coalesce(max(versao),0)+1 into v_versao from pieggi.programacoes where evento_id=e.id;
    update pieggi.programacoes set status='INVALIDADA' where evento_id=e.id and status in ('APROVADA','RASCUNHO');
    insert into pieggi.programacoes(evento_id,empresa_id,versao,saida_em,itens,alteracoes,criado_por)
    values(e.id,e.empresa_id,v_versao,(p_dados->>'saidaEm')::timestamptz,p_dados->'itens',p_dados->>'alteracoes',auth.uid()) returning id into v_id;
    update pieggi.eventos set etapa_operacao='PROGRAMACAO' where id=e.id;
    insert into pieggi.operacao_notificacoes(empresa_id,evento_id,mensagem) values(e.empresa_id,e.id,'Nova programação v'||v_versao||'. Derivados bloqueados até aprovação.');
  elsif p_acao='PROGRAMACAO_APROVAR' then
    select * into p from pieggi.programacoes where evento_id=e.id and status='RASCUNHO' order by versao desc limit 1;
    if not found then raise exception 'Não há rascunho para aprovar.'; end if;
    if e.contrato_assinado_em is null and nullif(trim(e.liberacao_excepcional_motivo),'') is null then raise exception 'Contrato ainda não formalizado.'; end if;
    if exists(select 1 from jsonb_array_elements(p.itens) i where i->>'setor'='A_CLASSIFICAR') then raise exception 'Classifique todos os itens antes de aprovar.'; end if;
    update pieggi.programacoes set status='APROVADA',aprovado_por=auth.uid(),aprovado_em=now() where id=p.id;
    for item in select value from jsonb_array_elements(p.itens) loop
      if item->>'setor' not in ('ESTRUTURA','FORNECEDOR') then
        insert into pieggi.operacao_tarefas(evento_id,programacao_id,empresa_id,tipo,setor,titulo,descricao,quantidade,unidade)
        values(e.id,p.id,e.empresa_id,'PRODUCAO',item->>'setor',item->>'nome',item->>'receita',(item->>'quantidade')::numeric,item->>'unidade');
      end if;
      insert into pieggi.operacao_tarefas(evento_id,programacao_id,empresa_id,tipo,setor,titulo,descricao,quantidade,unidade)
      values(e.id,p.id,e.empresa_id,'EXPEDICAO',item->>'setor',item->>'nome',item->>'receita',(item->>'quantidade')::numeric,item->>'unidade');
    end loop;
    insert into pieggi.operacao_tarefas(evento_id,programacao_id,empresa_id,tipo,setor,titulo)
      select e.id,p.id,e.empresa_id,'CONFERENCIA','GERAL',x from unnest(array['Conferência da programação','Conferência da produção','Conferência de carregamento']) x;
    insert into pieggi.operacao_tarefas(evento_id,programacao_id,empresa_id,tipo,setor,titulo,evidencia_obrigatoria)
      select e.id,p.id,e.empresa_id,'CAMPO','CAMPO',x,true from unnest(array['Chegada ao local','Higienização e mesa montada','Reposição','Desmontagem']) x;
    insert into pieggi.operacao_tarefas(evento_id,programacao_id,empresa_id,tipo,setor,titulo)
      values(e.id,p.id,e.empresa_id,'RETORNO','EXPEDICAO','Conferência de retorno na Pieggi');
    update pieggi.eventos set etapa_operacao='PRODUCAO' where id=e.id;
    v_id:=p.id;
  elsif p_acao='TAREFA_ATUALIZAR' then
    select tt.* into t from pieggi.operacao_tarefas tt join pieggi.programacoes pp on pp.id=tt.programacao_id and pp.status='APROVADA' where tt.id=(p_dados->>'id')::uuid and tt.evento_id=e.id for update of tt;
    if not found then raise exception 'Tarefa indisponível ou programação invalidada.'; end if;
    v_papeis := case when t.tipo='PRODUCAO' then array['ADMIN','PRODUCAO'] when t.tipo='CONFERENCIA' then array['ADMIN','PROGRAMACAO','PRODUCAO','EXPEDICAO_COMPRAS'] else array['ADMIN','EXPEDICAO_COMPRAS'] end;
    if not pieggi.tem_acesso(e.empresa_id,v_papeis) then raise exception 'Perfil sem permissão para esta tarefa.' using errcode='42501'; end if;
    if t.estado='PRONTO' then raise exception 'Tarefa concluída. Reprogramação é necessária para alterar.'; end if;
    if t.tipo='RETORNO' and (e.etapa_operacao<>'EM_CAMPO' or exists(select 1 from pieggi.operacao_tarefas where programacao_id=t.programacao_id and tipo='CAMPO' and estado<>'PRONTO')) then raise exception 'Conclua o campo antes da conferência de retorno.'; end if;
    if t.tipo='EXPEDICAO' and p_dados->>'estado'='PRONTO' and exists(select 1 from pieggi.operacao_tarefas where programacao_id=t.programacao_id and tipo='PRODUCAO' and estado<>'PRONTO') then raise exception 'Conclua a produção antes do carregamento.'; end if;
    if p_dados->>'estado' is distinct from (case when t.estado='PENDENTE' and t.tipo in ('PRODUCAO','EXPEDICAO') then 'EM_ANDAMENTO' else 'PRONTO' end) then raise exception 'Respeite a sequência de conferência.'; end if;
    if t.evidencia_obrigatoria then raise exception 'Envie a evidência pelo fluxo de campo antes de concluir.'; end if;
    if t.tipo='PRODUCAO' and exists(select 1 from pieggi.operacao_tarefas where programacao_id=t.programacao_id and titulo='Conferência da programação' and tipo='CONFERENCIA' and estado<>'PRONTO') then raise exception 'Confira a programação antes de iniciar a produção.'; end if;
    if t.tipo='CONFERENCIA' and t.titulo='Conferência da produção' and exists(select 1 from pieggi.operacao_tarefas where programacao_id=t.programacao_id and tipo='PRODUCAO' and estado<>'PRONTO') then raise exception 'Conclua a produção antes de conferi-la.'; end if;
    if t.tipo='CONFERENCIA' and t.titulo='Conferência de carregamento' and exists(select 1 from pieggi.operacao_tarefas where programacao_id=t.programacao_id and (tipo in ('PRODUCAO','EXPEDICAO') or titulo='Conferência da produção') and estado<>'PRONTO') then raise exception 'Conclua a produção e o carregamento antes da conferência final.'; end if;
    update pieggi.operacao_tarefas set estado=p_dados->>'estado',concluido_por=auth.uid(),atualizado_em=now() where id=t.id;
    if not exists(select 1 from pieggi.operacao_tarefas where programacao_id=t.programacao_id and tipo='PRODUCAO' and estado<>'PRONTO') and e.etapa_operacao='PRODUCAO' then
      update pieggi.eventos set etapa_operacao='EXPEDICAO' where id=e.id;
    else update pieggi.eventos set atualizado_em=now() where id=e.id;
    end if;
    v_id:=t.id;
  elsif p_acao in ('EXPEDIR','ENTREGAR') then
    select * into p from pieggi.programacoes where evento_id=e.id and status='APROVADA';
    if not found then raise exception 'Aprovação da programação necessária.'; end if;
    if p_acao='EXPEDIR' then
      if e.etapa_operacao<>'EXPEDICAO' then raise exception 'Conclua a produção primeiro.'; end if;
      if exists(select 1 from pieggi.operacao_tarefas where programacao_id=p.id and tipo in ('PRODUCAO','EXPEDICAO','CONFERENCIA') and estado<>'PRONTO') then raise exception 'Existem itens ou conferências pendentes. Saída bloqueada.'; end if;
      update pieggi.eventos set etapa_operacao='EM_CAMPO' where id=e.id;
    else
      if e.etapa_operacao<>'EM_CAMPO' then raise exception 'Evento não está em campo.'; end if;
      if exists(select 1 from pieggi.operacao_tarefas where programacao_id=p.id and estado<>'PRONTO') then raise exception 'Conclua campo, evidências e retorno antes de entregar.'; end if;
      update pieggi.eventos set etapa_operacao='ENTREGUE' where id=e.id;
    end if;
  elsif p_acao='TITULO_CRIAR' then
    if e.contrato_assinado_em is null then raise exception 'Contrato assinado obrigatório para contas a receber.'; end if;
    insert into pieggi.financeiro_titulos(empresa_id,evento_id,descricao,valor,vencimento,forma,idempotencia)
    values(e.empresa_id,e.id,p_dados->>'descricao',(p_dados->>'valor')::numeric,(p_dados->>'vencimento')::date,p_dados->>'forma',(p_dados->>'idempotencia')::uuid)
    on conflict(idempotencia) do nothing returning id into v_id;
    if v_id is null then raise exception 'Esta solicitação já foi registrada. Atualize a tela.'; end if;
    update pieggi.eventos set atualizado_em=now() where id=e.id;
  elsif p_acao='TITULO_RECEBER' then
    if nullif(trim(p_dados->>'referencia'),'') is null or p_dados->>'recebidoEm' is null then raise exception 'Informe data e referência do recebimento.'; end if;
    if (p_dados->>'recebidoEm')::date > current_date then raise exception 'Recebimento não pode estar no futuro.'; end if;
    update pieggi.financeiro_titulos set recebido_em=(p_dados->>'recebidoEm')::date,referencia=nullif(p_dados->>'referencia','')
      where id=(p_dados->>'id')::uuid and evento_id=e.id and recebido_em is null returning id into v_id;
    if not found then raise exception 'Título indisponível ou já recebido.'; end if;
    update pieggi.eventos set atualizado_em=now() where id=e.id;
  elsif p_acao='POS_VENDA' then
    if e.etapa_operacao<>'ENTREGUE' then raise exception 'Pós-venda disponível após entrega.'; end if;
    insert into pieggi.evento_pos_venda(evento_id,empresa_id,nota,comentario,retorno_em)
    values(e.id,e.empresa_id,(p_dados->>'nota')::integer,coalesce(p_dados->>'comentario',''),(p_dados->>'retornoEm')::date)
    on conflict(evento_id) do update set nota=excluded.nota,comentario=excluded.comentario,retorno_em=excluded.retorno_em,atualizado_em=now();
    update pieggi.eventos set atualizado_em=now() where id=e.id;
  else raise exception 'Ação não reconhecida.';
  end if;
  insert into pieggi.auditoria_eventos(id,empresa_id,usuario_id,acao,entidade,entidade_id,dados)
  values(gen_random_uuid(),e.empresa_id,auth.uid(),p_acao,'evento',e.id::text,jsonb_build_object('revisaoAnterior',e.revisao,'registroId',v_id));
  return jsonb_build_object('id',coalesce(v_id,e.id));
end
$$;
revoke all on function pieggi.operar_evento(uuid,integer,text,jsonb) from public,anon;
grant execute on function pieggi.operar_evento(uuid,integer,text,jsonb) to authenticated;
revoke all on function pieggi.evento_proteger_fluxo(),pieggi.evento_filas() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
