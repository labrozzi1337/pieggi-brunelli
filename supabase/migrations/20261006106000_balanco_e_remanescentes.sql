begin;
create table if not exists pieggi.evento_balancos (
  programacao_id uuid primary key references pieggi.programacoes(id),
  evento_id uuid not null references pieggi.eventos(id),
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  revisao integer not null default 1,
  linhas jsonb not null,
  recebedor text not null default '',
  observacoes text not null default '',
  atualizado_por uuid not null references pieggi.usuarios(id),
  atualizado_em timestamptz not null default now()
);
create table if not exists pieggi.remanescentes_termos (
  id uuid primary key default gen_random_uuid(),
  programacao_id uuid not null references pieggi.programacoes(id),
  evento_id uuid not null references pieggi.eventos(id),
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  revisao_balanco integer not null,
  snapshot jsonb not null,
  arquivo_path text not null,
  assinado_em timestamptz not null,
  registrado_por uuid not null references pieggi.usuarios(id),
  criado_em timestamptz not null default now(),
  unique(programacao_id,revisao_balanco)
);
do $$ declare t text; begin
  foreach t in array array['evento_balancos','remanescentes_termos'] loop
    execute format('alter table pieggi.%I enable row level security',t);
    execute format('revoke all on pieggi.%I from public,anon,authenticated',t);
    execute format('grant select on pieggi.%I to authenticated',t);
    execute format('drop policy if exists balanco_ler on pieggi.%I',t);
    execute format('create policy balanco_ler on pieggi.%I for select to authenticated using(pieggi.tem_acesso(empresa_id,array[''ADMIN'',''EXPEDICAO_COMPRAS'',''COMERCIAL'',''ATENDIMENTO'']))',t);
  end loop;
end $$;

create or replace function pieggi.salvar_balanco(p_evento uuid,p_revisao integer,p_balanco_revisao integer,p_linhas jsonb,p_recebedor text,p_observacoes text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e pieggi.eventos%rowtype; p pieggi.programacoes%rowtype; b pieggi.evento_balancos%rowtype; l jsonb; item jsonb; v_linhas jsonb:='[]'; indice integer:=0; rem numeric; ret numeric; des numeric; qtd numeric;
begin
  select * into e from pieggi.eventos where id=p_evento for update;
  if not found or not pieggi.tem_acesso(e.empresa_id,array['ADMIN','EXPEDICAO_COMPRAS']) then raise exception 'Acesso negado.' using errcode='42501'; end if;
  if p_revisao is distinct from e.revisao then raise exception 'Evento alterado. Atualize a tela.' using errcode='40001'; end if;
  if e.etapa_operacao<>'EM_CAMPO' then raise exception 'Balanço disponível durante campo e retorno, antes de encerrar.'; end if;
  select * into p from pieggi.programacoes where evento_id=e.id and status='APROVADA';
  if not found then raise exception 'Programação ainda não aprovada.'; end if;
  select * into b from pieggi.evento_balancos where programacao_id=p.id for update;
  if coalesce(b.revisao,0) is distinct from p_balanco_revisao then raise exception 'Balanço alterado. Atualize antes de salvar.' using errcode='40001'; end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' then raise exception 'Informe todos os itens do balanço.'; end if;
  if length(coalesce(p_recebedor,''))>200 or length(coalesce(p_observacoes,''))>3000 then raise exception 'Texto excede o limite.'; end if;
  for item in select value from jsonb_array_elements(p.itens) loop
    if item->>'setor'<>'ESTRUTURA' then
      select value into l from jsonb_array_elements(p_linhas) where value->>'indice'=indice::text;
      if l is null or (select count(*) from jsonb_array_elements(p_linhas) where value->>'indice'=indice::text)<>1 then raise exception 'Confira todos os itens, sem duplicações.'; end if;
      if exists(select 1 from jsonb_object_keys(l) k where k not in ('indice','remanescentes','retorno','descarte')) or jsonb_typeof(l->'remanescentes')<>'number' or jsonb_typeof(l->'retorno')<>'number' or jsonb_typeof(l->'descarte')<>'number' then raise exception 'Quantidade inválida.'; end if;
      rem:=(l->>'remanescentes')::numeric;ret:=(l->>'retorno')::numeric;des:=(l->>'descarte')::numeric;qtd:=(item->>'quantidade')::numeric;
      if rem is null or ret is null or des is null or least(rem,ret,des)<0 or rem+ret+des>qtd or rem<>round(rem,3) or ret<>round(ret,3) or des<>round(des,3) or (item->>'unidade'='UN' and (rem<>trunc(rem) or ret<>trunc(ret) or des<>trunc(des))) then raise exception 'Sobras e descarte devem caber na quantidade programada, respeitando a unidade.'; end if;
      v_linhas:=v_linhas||jsonb_build_array(jsonb_build_object('indice',indice,'nome',item->>'nome','unidade',item->>'unidade','programado',qtd,'consumido',qtd-rem-ret-des,'remanescentes',rem,'retorno',ret,'descarte',des));
    end if;
    indice:=indice+1;
  end loop;
  if jsonb_array_length(v_linhas)<>jsonb_array_length(p_linhas) then raise exception 'Itens extras no balanço.'; end if;
  if exists(select 1 from jsonb_array_elements(v_linhas) x where (x->>'remanescentes')::numeric>0) and length(trim(coalesce(p_recebedor,'')))<2 then raise exception 'Informe quem recebeu os remanescentes.'; end if;
  insert into pieggi.evento_balancos(programacao_id,evento_id,empresa_id,revisao,linhas,recebedor,observacoes,atualizado_por) values(p.id,e.id,e.empresa_id,coalesce(b.revisao,0)+1,v_linhas,trim(coalesce(p_recebedor,'')),coalesce(p_observacoes,''),auth.uid())
  on conflict(programacao_id) do update set revisao=excluded.revisao,linhas=excluded.linhas,recebedor=excluded.recebedor,observacoes=excluded.observacoes,atualizado_por=excluded.atualizado_por,atualizado_em=now();
  update pieggi.eventos set atualizado_em=now() where id=e.id;
  insert into pieggi.auditoria_eventos(id,empresa_id,usuario_id,acao,entidade,entidade_id,dados) values(gen_random_uuid(),e.empresa_id,auth.uid(),'BALANCO_REGISTRADO','evento',e.id::text,jsonb_build_object('anterior',to_jsonb(b),'linhas',v_linhas,'revisao',coalesce(b.revisao,0)+1));
  return jsonb_build_object('id',p.id);
end $$;
revoke all on function pieggi.salvar_balanco(uuid,integer,integer,jsonb,text,text) from public,anon;
grant execute on function pieggi.salvar_balanco(uuid,integer,integer,jsonb,text,text) to authenticated;

create or replace function pieggi.registrar_termo_remanescentes(p_evento uuid,p_revisao integer,p_balanco_revisao integer,p_path text,p_assinado timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e pieggi.eventos%rowtype; b pieggi.evento_balancos%rowtype; v_id uuid;
begin
  select * into e from pieggi.eventos where id=p_evento for update;
  if not found or not pieggi.tem_acesso(e.empresa_id,array['ADMIN','EXPEDICAO_COMPRAS']) then raise exception 'Acesso negado.' using errcode='42501'; end if;
  select b1.* into b from pieggi.evento_balancos b1 join pieggi.programacoes p on p.id=b1.programacao_id and p.status='APROVADA' where b1.evento_id=e.id for update of b1;
  if p_revisao is distinct from e.revisao or b.programacao_id is null or p_balanco_revisao is distinct from b.revisao then raise exception 'Balanço alterado. Gere o termo atualizado.' using errcode='40001'; end if;
  if e.etapa_operacao<>'EM_CAMPO' or p_assinado is null or p_assinado>now() then raise exception 'Evento ou data de assinatura inválido.'; end if;
  if not exists(select 1 from jsonb_array_elements(b.linhas) x where (x->>'remanescentes')::numeric>0) then raise exception 'Não há remanescentes entregues ao cliente.'; end if;
  if not exists(select 1 from storage.objects where bucket_id='pieggi-evidencias' and name=p_path and split_part(name,'/',1)=e.id::text and owner_id=auth.uid()::text and metadata->>'mimetype'='application/pdf') then raise exception 'Envie o termo assinado em PDF.'; end if;
  insert into pieggi.remanescentes_termos(programacao_id,evento_id,empresa_id,revisao_balanco,snapshot,arquivo_path,assinado_em,registrado_por) values(b.programacao_id,e.id,e.empresa_id,b.revisao,to_jsonb(b),p_path,p_assinado,auth.uid()) returning id into v_id;
  update pieggi.eventos set atualizado_em=now() where id=e.id;
  insert into pieggi.auditoria_eventos(id,empresa_id,usuario_id,acao,entidade,entidade_id,dados) values(gen_random_uuid(),e.empresa_id,auth.uid(),'TERMO_REMANESCENTES_REGISTRADO','evento',e.id::text,jsonb_build_object('termoId',v_id,'revisaoBalanco',b.revisao));
  return jsonb_build_object('id',v_id);
end $$;
revoke all on function pieggi.registrar_termo_remanescentes(uuid,integer,integer,text,timestamptz) from public,anon;
grant execute on function pieggi.registrar_termo_remanescentes(uuid,integer,integer,text,timestamptz) to authenticated;

create or replace function pieggi.evento_portao_balanco()
returns trigger language plpgsql security definer set search_path='' as $$
declare b pieggi.evento_balancos%rowtype;
begin
  if old.etapa_operacao in ('EM_CAMPO','ENTREGUE') and row(new.pax,new.data_evento,new.horario_inicio,new.horario_fim,new.logradouro,new.numero_endereco,new.complemento,new.bairro,new.cidade,new.uf,new.cep) is distinct from row(old.pax,old.data_evento,old.horario_inicio,old.horario_fim,old.logradouro,old.numero_endereco,old.complemento,old.bairro,old.cidade,old.uf,old.cep) then raise exception 'Evento já saiu. Dados operacionais não podem ser alterados sem tratar a ocorrência.'; end if;
  if new.etapa_operacao='ENTREGUE' and old.etapa_operacao<>'ENTREGUE' then
    select b1.* into b from pieggi.evento_balancos b1 join pieggi.programacoes p on p.id=b1.programacao_id and p.status='APROVADA' where b1.evento_id=new.id;
    if not found then raise exception 'Registre o balanço de consumo, retorno e descarte antes de encerrar.'; end if;
    if exists(select 1 from jsonb_array_elements(b.linhas) x where (x->>'remanescentes')::numeric>0) and not exists(select 1 from pieggi.remanescentes_termos t where t.programacao_id=b.programacao_id and t.revisao_balanco=b.revisao) then raise exception 'Anexe o termo assinado dos remanescentes desta revisão antes de encerrar.'; end if;
  end if;
  return new;
end $$;
drop trigger if exists evento_bloquear_edicao_tardia on pieggi.eventos;
create trigger evento_bloquear_edicao_tardia before update on pieggi.eventos for each row execute function pieggi.evento_portao_balanco();

-- Expedição pode baixar apenas seu termo; contratos continuam protegidos.
drop policy if exists pieggi_remanescentes_ler on storage.objects;
create policy pieggi_remanescentes_ler on storage.objects for select to authenticated using(bucket_id='pieggi-evidencias' and exists(select 1 from pieggi.remanescentes_termos t where t.arquivo_path=name and pieggi.tem_acesso(t.empresa_id,array['ADMIN','EXPEDICAO_COMPRAS','ATENDIMENTO','COMERCIAL'])));
notify pgrst,'reload schema';
commit;
