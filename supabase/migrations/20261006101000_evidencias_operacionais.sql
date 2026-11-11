begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('pieggi-evidencias','pieggi-evidencias',false,8388608,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do nothing;

drop policy if exists pieggi_evidencias_inserir on storage.objects;
create policy pieggi_evidencias_inserir on storage.objects for insert to authenticated
with check(bucket_id='pieggi-evidencias' and exists(
  select 1 from pieggi.eventos e where e.id::text=(storage.foldername(name))[1]
    and pieggi.tem_acesso(e.empresa_id,array['ADMIN','EXPEDICAO_COMPRAS','PROGRAMACAO','COMERCIAL','ATENDIMENTO'])
));
drop policy if exists pieggi_evidencias_ler on storage.objects;
create policy pieggi_evidencias_ler on storage.objects for select to authenticated
using(bucket_id='pieggi-evidencias' and exists(
  select 1 from pieggi.eventos e where e.id::text=(storage.foldername(name))[1] and pieggi.tem_acesso(e.empresa_id)
    and (metadata->>'mimetype' in ('image/jpeg','image/png','image/webp') or pieggi.tem_acesso(e.empresa_id,array['ADMIN','COMERCIAL','ATENDIMENTO','FINANCEIRO']))
));

create or replace function pieggi.concluir_tarefa_evidencia(p_tarefa uuid,p_revisao integer,p_path text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e pieggi.eventos%rowtype; t pieggi.operacao_tarefas%rowtype;
begin
  select * into t from pieggi.operacao_tarefas where id=p_tarefa;
  select * into e from pieggi.eventos where id=t.evento_id for update;
  if not found or not pieggi.tem_acesso(e.empresa_id,array['ADMIN','EXPEDICAO_COMPRAS']) then raise exception 'Acesso negado.' using errcode='42501'; end if;
  if p_revisao is distinct from e.revisao then raise exception 'Evento alterado. Atualize a tela.' using errcode='40001'; end if;
  if e.etapa_operacao<>'EM_CAMPO' or not t.evidencia_obrigatoria then raise exception 'Evidência disponível apenas para tarefa de campo em andamento.'; end if;
  if not exists(select 1 from pieggi.programacoes where id=t.programacao_id and status='APROVADA') then raise exception 'Programação invalidada.'; end if;
  if not exists(select 1 from storage.objects where bucket_id='pieggi-evidencias' and name=p_path
    and split_part(name,'/',1)=e.id::text and owner_id=auth.uid()::text and metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')) then raise exception 'Envie uma foto válida antes de concluir.'; end if;
  if t.estado='PRONTO' then raise exception 'Evidência já registrada.'; end if;
  update pieggi.operacao_tarefas set estado='PRONTO',evidencia_path=p_path,concluido_por=auth.uid(),atualizado_em=now() where id=t.id;
  update pieggi.eventos set atualizado_em=now() where id=e.id;
  insert into pieggi.auditoria_eventos(id,empresa_id,usuario_id,acao,entidade,entidade_id,dados)
  values(gen_random_uuid(),e.empresa_id,auth.uid(),'EVIDENCIA_REGISTRADA','evento',e.id::text,jsonb_build_object('tarefaId',t.id));
  return jsonb_build_object('id',t.id);
end $$;
revoke all on function pieggi.concluir_tarefa_evidencia(uuid,integer,text) from public,anon;
grant execute on function pieggi.concluir_tarefa_evidencia(uuid,integer,text) to authenticated;
notify pgrst,'reload schema';
commit;
