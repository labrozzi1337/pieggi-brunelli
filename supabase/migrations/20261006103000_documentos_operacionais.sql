begin;
alter table pieggi.programacoes add column if not exists rotulos jsonb not null default '[]'::jsonb;
create table if not exists pieggi.documentos_operacionais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references pieggi.fiscal_empresas(id),
  programacao_id uuid not null references pieggi.programacoes(id),
  tipo text not null check(tipo in ('PROGRAMACAO','COMANDA','PLAQUINHAS')),
  setor text not null default '',
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  criado_por uuid not null references pieggi.usuarios(id),
  criado_em timestamptz not null default now()
);
alter table pieggi.documentos_operacionais enable row level security;
revoke all on pieggi.documentos_operacionais from public,anon,authenticated;
grant select on pieggi.documentos_operacionais to authenticated;
drop policy if exists documentos_operacionais_ler on pieggi.documentos_operacionais;
create policy documentos_operacionais_ler on pieggi.documentos_operacionais for select to authenticated using(pieggi.tem_acesso(empresa_id));

-- Os rótulos pertencem à versão, nunca ao arquivo derivado. A revisão é atômica.
create or replace function pieggi.salvar_programacao_documentos(p_evento uuid,p_revisao integer,p_dados jsonb,p_rotulos jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare resultado jsonb; r jsonb; n integer;
begin
  if jsonb_typeof(p_rotulos) is distinct from 'array' then raise exception 'Rótulos inválidos.'; end if;
  n:=jsonb_array_length(p_dados->'itens');
  if jsonb_array_length(p_rotulos) not in (0,n) then raise exception 'Cada item deve ter seu próprio rótulo.'; end if;
  for r in select value from jsonb_array_elements(p_rotulos) loop
    if jsonb_typeof(r) is distinct from 'object' or exists(select 1 from jsonb_object_keys(r) k where k not in ('nomeEn','nomeEs','descricaoPt','descricaoEn','descricaoEs','restricoes','confirmado','exibir','ficha')) then raise exception 'Campos de rótulo não permitidos.'; end if;
    if jsonb_typeof(r->'restricoes') is distinct from 'array' or jsonb_array_length(r->'restricoes')>5 then raise exception 'Restrições inválidas.'; end if;
    if exists(select 1 from jsonb_array_elements_text(r->'restricoes') x where x not in ('SEM_GLUTEN','VEGANO','VEGETARIANO','SEM_LACTOSE','SEM_ACUCAR')) then raise exception 'Restrição desconhecida.'; end if;
    if jsonb_typeof(r->'confirmado') is distinct from 'boolean' or jsonb_typeof(r->'exibir') is distinct from 'boolean' then raise exception 'Confirme a classificação da plaquinha.'; end if;
    if exists(select 1 from unnest(array['nomeEn','nomeEs','descricaoPt','descricaoEn','descricaoEs','ficha']) k where jsonb_typeof(r->k) is distinct from 'string') then raise exception 'Informe os textos da plaquinha.'; end if;
    if exists(select 1 from jsonb_each_text(r) x where x.key not in ('restricoes','confirmado','exibir') and length(x.value)>1000) then raise exception 'Texto do rótulo excede o limite.'; end if;
  end loop;
  resultado:=pieggi.operar_evento(p_evento,p_revisao,'PROGRAMACAO_SALVAR',p_dados);
  update pieggi.programacoes set rotulos=p_rotulos where id=(resultado->>'id')::uuid;
  return resultado;
end $$;
revoke all on function pieggi.salvar_programacao_documentos(uuid,integer,jsonb,jsonb) from public,anon;
grant execute on function pieggi.salvar_programacao_documentos(uuid,integer,jsonb,jsonb) to authenticated;

create or replace function pieggi.registrar_documento_operacional(p_programacao uuid,p_tipo text,p_setor text,p_sha256 text)
returns uuid language plpgsql security definer set search_path='' as $$
declare p pieggi.programacoes%rowtype; v_id uuid;
begin
  select * into p from pieggi.programacoes where id=p_programacao for share;
  if not found or not pieggi.tem_acesso(p.empresa_id,array['ADMIN','PROGRAMACAO','PRODUCAO','EXPEDICAO_COMPRAS','ATENDIMENTO']) then raise exception 'Acesso negado.' using errcode='42501'; end if;
  if p.status<>'APROVADA' then raise exception 'Programação invalidada ou ainda não aprovada. Atualize a tela.' using errcode='40001'; end if;
  insert into pieggi.documentos_operacionais(empresa_id,programacao_id,tipo,setor,sha256,criado_por) values(p.empresa_id,p.id,p_tipo,coalesce(p_setor,''),p_sha256,auth.uid()) returning id into v_id;
  insert into pieggi.auditoria_eventos(id,empresa_id,usuario_id,acao,entidade,entidade_id,dados) values(gen_random_uuid(),p.empresa_id,auth.uid(),'DOCUMENTO_GERADO','programacao',p.id::text,jsonb_build_object('tipo',p_tipo,'setor',p_setor,'versao',p.versao,'sha256',p_sha256));
  return v_id;
end $$;
revoke all on function pieggi.registrar_documento_operacional(uuid,text,text,text) from public,anon;
grant execute on function pieggi.registrar_documento_operacional(uuid,text,text,text) to authenticated;
create index if not exists documentos_operacionais_programacao_idx on pieggi.documentos_operacionais(programacao_id,criado_em desc);
notify pgrst,'reload schema';
commit;
