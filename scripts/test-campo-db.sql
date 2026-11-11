reset role;
set request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
do $$ declare eid uuid; pid uuid; aid uuid; tid uuid; dados jsonb; caminho text; r integer; begin
  insert into pieggi.eventos(id,empresa_id,cliente_id,titulo,data_evento,liberacao_excepcional_motivo)
  values(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Campo de teste',(now() at time zone 'America/Sao_Paulo')::date,'Fixture isolado') returning id into eid;
  set role authenticated;
  dados:=pieggi.gerenciar_acesso_campo(eid,'Líder teste',repeat('c',64));aid:=(dados->>'id')::uuid;
  begin perform pieggi.consultar_campo(repeat('c',64));raise exception 'TESTE: RPC de capacidade liberada ao usuário';exception when insufficient_privilege then null;end;
  reset role;
  if has_function_privilege('anon','pieggi.consultar_campo(text)','EXECUTE') then raise exception 'TESTE: acesso anônimo sem token';end if;
  dados:=pieggi.consultar_campo(repeat('c',64));
  if dados::text ~ 'valor_venda|cliente_id|documento|token_hash|custo_estimado' then raise exception 'TESTE: dado privado vazou';end if;
  begin perform pieggi.consultar_campo(repeat('d',64));raise exception 'TESTE: token inexistente aceito';exception when insufficient_privilege then null;end;
  insert into pieggi.programacoes(evento_id,empresa_id,versao,status,saida_em,itens,alteracoes,criado_por)
  values(eid,'20000000-0000-4000-8000-000000000001',1,'APROVADA',now(),'[{"nome":"Item teste","receita":"Receita inteira","quantidade":3,"unidade":"UN","setor":"COZINHA_FRIA"}]','Fixture de campo','10000000-0000-4000-8000-000000000001') returning id into pid;
  insert into pieggi.operacao_tarefas(evento_id,programacao_id,empresa_id,tipo,setor,titulo,evidencia_obrigatoria) select eid,pid,'20000000-0000-4000-8000-000000000001','CAMPO','CAMPO',x,true from unnest(array['Chegada ao local','Higienização e mesa montada','Reposição','Desmontagem']) x;
  update pieggi.eventos set etapa_operacao='EM_CAMPO' where id=eid returning revisao into r;
  caminho:=eid::text||'/'||aid::text||'/fixture.png';insert into storage.objects(bucket_id,name,metadata) values('pieggi-evidencias',caminho,'{"mimetype":"image/png"}');
  select id into tid from pieggi.operacao_tarefas where programacao_id=pid and titulo='Reposição';
  begin perform pieggi.registrar_foto_campo(repeat('c',64),tid,r,caminho);raise exception 'TESTE: etapa pulada';exception when raise_exception then if SQLERRM<>'Conclua a etapa anterior antes de continuar.' then raise;end if;end;
  select id into tid from pieggi.operacao_tarefas where programacao_id=pid and titulo='Chegada ao local';
  begin perform pieggi.registrar_foto_campo(repeat('c',64),tid,r-1,caminho);raise exception 'TESTE: revisão obsoleta aceita';exception when serialization_failure then null;end;
  perform pieggi.registrar_foto_campo(repeat('c',64),tid,r,caminho);
  if (select concluido_por from pieggi.operacao_tarefas where id=tid) is not null then raise exception 'TESTE: líder impersonou admin';end if;
  set role authenticated;
  perform pieggi.gerenciar_acesso_campo(eid,null,null,aid);
  reset role;
  begin perform pieggi.consultar_campo(repeat('c',64));raise exception 'TESTE: link revogado aceito';exception when insufficient_privilege then null;end;
  set role authenticated;
  perform pieggi.gerenciar_acesso_campo(eid,'Novo líder',repeat('e',64));
  reset role;
  begin update pieggi.eventos set data_evento=(now() at time zone 'America/Sao_Paulo')::date+1 where id=eid;raise exception 'TESTE: edição tardia permitida';exception when raise_exception then if SQLERRM<>'Evento já saiu. Dados operacionais não podem ser alterados sem tratar a ocorrência.' then raise;end if;end;
  update pieggi.campo_acessos set expira_em=now()-interval '1 minute' where evento_id=eid;
  begin perform pieggi.consultar_campo(repeat('e',64));raise exception 'TESTE: link fora do dia aceito';exception when insufficient_privilege then null;end;
end $$;
reset role;
