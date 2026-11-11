reset role;
set request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
do $$ declare e uuid;p uuid;a uuid;etapa uuid;foto uuid;rev integer;roteiro jsonb;resultado jsonb;caminho text;fase text;begin
  insert into pieggi.eventos(id,empresa_id,cliente_id,titulo,data_evento,liberacao_excepcional_motivo)
    values(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Roteiro fixture',(now() at time zone 'America/Sao_Paulo')::date,'Fixture roteiro') returning id into e;
  roteiro:=(select jsonb_agg(jsonb_build_object('tipo',tipo,'titulo','Etapa '||tipo,'orientacao','Orientação completa de teste.','previstoEm',now()+n*interval '1 hour') order by n) from unnest(array['MONTAGEM','REPOSICAO','DESMONTAGEM']) with ordinality x(tipo,n));
  set role authenticated;
  begin
    perform pieggi.salvar_programacao_campo(e,1,jsonb_build_object('saidaEm',now(),'alteracoes','Fixture inválida','itens','[{"nome":"Item roteiro","receita":"Receita completa","quantidade":3,"unidade":"UN","setor":"COZINHA_FRIA","servico":"Coffee"}]'::jsonb),'[]',jsonb_build_array(jsonb_build_object('tipo','MONTAGEM','titulo','Montagem','orientacao','Orientação completa','previstoEm','infinity')));
    raise exception 'TESTE: horário infinito aceito';
  exception when raise_exception then if SQLERRM<>'Organize as etapas em ordem de horário.' then raise;end if;end;
  begin
    resultado:=pieggi.salvar_programacao_campo(e,1,jsonb_build_object('saidaEm',now(),'alteracoes','Fixture sem roteiro','itens','[{"nome":"Item roteiro","receita":"Receita completa","quantidade":3,"unidade":"UN","setor":"COZINHA_FRIA","servico":"Coffee"}]'::jsonb),'[]','[]');
    perform pieggi.operar_evento(e,2,'PROGRAMACAO_APROVAR','{}');
    raise exception 'TESTE: aprovação sem roteiro aceita';
  exception when raise_exception then if SQLERRM<>'Defina o roteiro de montagem, reposição e desmontagem na programação antes de aprovar.' then raise;end if;end;
  resultado:=pieggi.salvar_programacao_campo(e,1,jsonb_build_object('saidaEm',now(),'alteracoes','Roteiro para teste','itens','[{"nome":"Item roteiro","receita":"Receita completa","quantidade":3,"unidade":"UN","setor":"COZINHA_FRIA","servico":"Coffee"}]'::jsonb),'[]',roteiro);p:=(resultado->>'id')::uuid;
  perform pieggi.operar_evento(e,2,'PROGRAMACAO_APROVAR','{}');
  if (select count(*) from pieggi.campo_etapas where programacao_id=p)<>3 then raise exception 'TESTE: roteiro não derivado';end if;
  resultado:=pieggi.gerenciar_acesso_campo(e,'Líder do roteiro',repeat('f',64));a:=(resultado->>'id')::uuid;
  reset role;
  update pieggi.eventos set etapa_operacao='EM_CAMPO' where id=e returning revisao into rev;
  caminho:=e::text||'/'||a::text||'/foto.png';insert into storage.objects(bucket_id,name,metadata) values('pieggi-evidencias',caminho,'{"mimetype":"image/png"}');
  select id into etapa from pieggi.campo_etapas where programacao_id=p and ordem=1;
  begin perform pieggi.concluir_etapa_campo(repeat('f',64),etapa,rev,'');raise exception 'TESTE: roteiro antes da chegada';exception when raise_exception then if SQLERRM<>'Registre a foto de chegada antes de iniciar o roteiro.' then raise;end if;end;
  select id into foto from pieggi.operacao_tarefas where programacao_id=p and titulo='Chegada ao local';
  perform pieggi.registrar_foto_campo(repeat('f',64),foto,rev,caminho);
  select revisao into rev from pieggi.eventos where id=e;
  select id into foto from pieggi.operacao_tarefas where programacao_id=p and titulo='Higienização e mesa montada';
  begin perform pieggi.registrar_foto_campo(repeat('f',64),foto,rev,caminho);raise exception 'TESTE: foto sem montagem';exception when raise_exception then if SQLERRM<>'Conclua as etapas correspondentes do roteiro antes de enviar esta foto.' then raise;end if;end;
  begin perform pieggi.concluir_etapa_campo(repeat('f',64),etapa,rev-1,'');raise exception 'TESTE: roteiro revisão antiga';exception when serialization_failure then null;end;
  for fase in select unnest(array['MONTAGEM','REPOSICAO','DESMONTAGEM']) loop
    select id into etapa from pieggi.campo_etapas where programacao_id=p and tipo=fase;
    select revisao into rev from pieggi.eventos where id=e;
    perform pieggi.concluir_etapa_campo(repeat('f',64),etapa,rev,'Conferido presencialmente');
    perform pieggi.concluir_etapa_campo(repeat('f',64),etapa,rev,'Conferido presencialmente');
    select id into foto from pieggi.operacao_tarefas where programacao_id=p and titulo=case fase when 'MONTAGEM' then 'Higienização e mesa montada' when 'REPOSICAO' then 'Reposição' else 'Desmontagem' end;
    select revisao into rev from pieggi.eventos where id=e;
    perform pieggi.registrar_foto_campo(repeat('f',64),foto,rev,caminho);
  end loop;
  resultado:=pieggi.consultar_campo(repeat('f',64));
  if jsonb_array_length(resultado->'etapas')<>3 or exists(select 1 from jsonb_array_elements(resultado->'etapas') t where t->>'concluidoEm' is null) then raise exception 'TESTE: roteiro incompleto';end if;
  if (select count(*) from pieggi.auditoria_eventos where entidade_id=e::text and acao='CAMPO_ETAPA_CONCLUIDA')<>3 then raise exception 'TESTE: confirmação duplicou';end if;
  update pieggi.programacoes set status='INVALIDADA' where id=p;
  begin perform pieggi.concluir_etapa_campo(repeat('f',64),etapa,rev,'');raise exception 'TESTE: roteiro invalidado aceito';exception when insufficient_privilege then null;end;
  if has_function_privilege('authenticated','pieggi.concluir_etapa_campo(text,uuid,integer,text)','EXECUTE') then raise exception 'TESTE: RPC de token aberta';end if;
end $$;
reset role;
