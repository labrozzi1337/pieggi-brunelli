insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000001','admin@example.test'),('10000000-0000-4000-8000-000000000002','cozinha@example.test'),('10000000-0000-4000-8000-000000000003','externo@example.test');
insert into pieggi.usuarios(id,nome) select id,email from auth.users;
insert into pieggi.fiscal_empresas(id,cnpj,razao_social,crt,logradouro,numero_endereco,bairro,codigo_municipio_ibge,municipio,uf,cep,ambiente_padrao,criado_em,atualizado_em)
values('20000000-0000-4000-8000-000000000001','00000000000000','TESTE LOCAL','3','Rua','1','Bairro','3550308','São Paulo','SP','00000000','HOMOLOGACAO',now(),now());
insert into pieggi.usuario_empresas(usuario_id,empresa_id) select id,'20000000-0000-4000-8000-000000000001' from auth.users where email<>'externo@example.test';
insert into pieggi.usuario_papeis(usuario_id,papel) values ('10000000-0000-4000-8000-000000000001','ADMIN'),('10000000-0000-4000-8000-000000000002','PRODUCAO');
insert into pieggi.clientes(id,empresa_id,nome) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','CLIENTE DE TESTE');
insert into pieggi.eventos(id,empresa_id,cliente_id,titulo,pax,data_evento,horario_inicio,horario_fim,tabela_preco,logradouro,numero_endereco,bairro,cidade,uf,cep,contato_local_nome,contato_local_telefone)
values('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','EVENTO DE TESTE',50,'2026-11-01','10:00','12:00','EXTERNOS','Rua','1','Bairro','São Paulo','SP','00000000','Teste','1100000000');
insert into pieggi.evento_valores(evento_id,valor_venda,custo_estimado) values('40000000-0000-4000-8000-000000000001',1000,200);
set role authenticated;
set request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
do $$ begin
  begin
    perform pieggi.operar_evento('40000000-0000-4000-8000-000000000001',1,'PROGRAMACAO_SALVAR','{}');
    raise exception 'TESTE: contrato não bloqueou';
  exception when raise_exception then if SQLERRM<>'Contrato ainda não formalizado.' then raise; end if; end;
end $$;
-- CRUD público: criação atômica e rejeição de revisão nula.
set role authenticated;
set request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
do $$ declare r jsonb; eid uuid; begin
  r:=pieggi.salvar_evento('20000000-0000-4000-8000-000000000001',null,null,'{"titulo":"Novo lead real de teste"}','{"nome":"Cliente dois","tipo":"PF"}');
  eid:=(r->'evento'->>'id')::uuid;
  if r->'evento'->>'etapa_comercial'<>'FRIO' then raise exception 'TESTE: estado inicial'; end if;
  perform pieggi.salvar_evento('20000000-0000-4000-8000-000000000001',eid,(r->'evento'->>'atualizado_em')::timestamptz,'{"titulo":"Título editado"}',null);
  begin
    perform pieggi.operar_evento(eid,null,'VALORES_SALVAR','{}');
    raise exception 'TESTE: revisão nula aceita';
  exception when serialization_failure then null; end;
end $$;
reset role;
reset role;
update pieggi.eventos set contrato_assinado_em=now() where id='40000000-0000-4000-8000-000000000001';
do $$ begin if (select count(*) from pieggi.integracao_fila)<>2 then raise exception 'TESTE: filas de assinatura'; end if; end $$;
set role authenticated;
select pieggi.operar_evento('40000000-0000-4000-8000-000000000001',2,'PROGRAMACAO_SALVAR','{"saidaEm":"2026-11-01T10:00:00Z","alteracoes":"Primeira versão de teste","itens":[{"nome":"Item teste","receita":"Receita de teste completa","quantidade":55,"unidade":"UN","setor":"A_CLASSIFICAR","servico":"Coffee"}]}');
do $$ begin
  begin
    perform pieggi.operar_evento('40000000-0000-4000-8000-000000000001',3,'PROGRAMACAO_APROVAR','{}');
    raise exception 'TESTE: classificação não bloqueou';
  exception when raise_exception then if SQLERRM<>'Classifique todos os itens antes de aprovar.' then raise; end if; end;
end $$;
select pieggi.salvar_programacao_campo('40000000-0000-4000-8000-000000000001',3,'{"saidaEm":"2026-11-01T10:00:00Z","alteracoes":"Classificação corrigida","itens":[{"nome":"Item teste","receita":"Receita de teste completa","quantidade":55,"unidade":"UN","setor":"COZINHA_FRIA","servico":"Coffee"}]}','[]','[{"tipo":"MONTAGEM","titulo":"Montar mesa","orientacao":"Montar os itens conferidos.","previstoEm":"2026-11-01T10:00:00Z"},{"tipo":"REPOSICAO","titulo":"Repor mesa","orientacao":"Repor os itens programados.","previstoEm":"2026-11-01T11:00:00Z"},{"tipo":"DESMONTAGEM","titulo":"Desmontar mesa","orientacao":"Retirar e conferir os itens.","previstoEm":"2026-11-01T12:00:00Z"}]');
select pieggi.operar_evento('40000000-0000-4000-8000-000000000001',4,'PROGRAMACAO_APROVAR','{}');
do $$ begin
  if (select count(*) from pieggi.operacao_tarefas where tipo='PRODUCAO')<>1 then raise exception 'TESTE: item duplicado em setores'; end if;
  begin
    perform pieggi.operar_evento('40000000-0000-4000-8000-000000000001',4,'EXPEDIR','{}');
    raise exception 'TESTE: revisão não bloqueou';
  exception when serialization_failure then null; end;
  begin
    perform pieggi.operar_evento('40000000-0000-4000-8000-000000000001',5,'EXPEDIR','{}');
    raise exception 'TESTE: produção não bloqueou';
  exception when raise_exception then if SQLERRM<>'Conclua a produção primeiro.' then raise; end if; end;
end $$;
set request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
do $$ begin
  if (select count(*) from pieggi.evento_valores)<>0 then raise exception 'TESTE: preço vazou para produção'; end if;
  if (select count(*) from pieggi.clientes)<>0 then raise exception 'TESTE: cliente vazou para produção'; end if;
  if (select count(*) from pieggi.operacao_tarefas where tipo='PRODUCAO')<>1 then raise exception 'TESTE: produção não enxerga tarefa'; end if;
  begin
    perform pieggi.operar_evento('40000000-0000-4000-8000-000000000001',5,'VALORES_SALVAR','{}');
    raise exception 'TESTE: produção conseguiu alterar valores';
  exception when insufficient_privilege then null; end;
end $$;
set request.jwt.claim.sub='10000000-0000-4000-8000-000000000003';
do $$ begin
  if (select count(*) from pieggi.programacoes)<>0 then raise exception 'TESTE: outra empresa enxerga programação'; end if;
end $$;
reset role;
update pieggi.eventos set pax=60 where id='40000000-0000-4000-8000-000000000001';
do $$ begin
  if exists(select 1 from pieggi.programacoes where status='APROVADA') then raise exception 'TESTE: alteração não invalidou'; end if;
  if (select etapa_operacao from pieggi.eventos where id='40000000-0000-4000-8000-000000000001')<>'PROGRAMACAO' then raise exception 'TESTE: etapa não voltou'; end if;
  if (select count(*) from pieggi.integracao_fila)<>2 then raise exception 'TESTE: filas duplicadas'; end if;
end $$;

-- Ciclo completo local: contrato, conferências nos três momentos, fotos, retorno e NPS.
insert into auth.users(id,email) values('10000000-0000-4000-8000-000000000004','expedicao@example.test');
insert into pieggi.usuarios(id,nome) values('10000000-0000-4000-8000-000000000004','Expedição');
insert into pieggi.usuario_empresas values('10000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001',now());
insert into pieggi.usuario_papeis values('10000000-0000-4000-8000-000000000004','EXPEDICAO_COMPRAS',now());
set role authenticated;
set request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
do $$ declare r jsonb; eid uuid; rev integer; task record; path text; begin
  r:=pieggi.salvar_evento('20000000-0000-4000-8000-000000000001',null,null,
    '{"titulo":"Ciclo completo","pax":10,"data_evento":"2026-11-01","horario_inicio":"10:00","horario_fim":"12:00","tabela_preco":"EXTERNOS","logradouro":"Rua","numero_endereco":"1","bairro":"Centro","cidade":"São Paulo","uf":"SP","cep":"00000000","contato_local_nome":"Contato","contato_local_telefone":"1100000000"}',
    '{"nome":"Cliente ciclo","tipo":"PF"}');
  eid:=(r->'evento'->>'id')::uuid;
  path:=eid::text||'/contrato.pdf';
  insert into storage.objects(bucket_id,name,owner_id,metadata) values('pieggi-evidencias',path,auth.uid()::text,'{"mimetype":"application/pdf"}');
  perform pieggi.registrar_contrato(eid,1,path,now());
  if (select count(*) from pieggi.integracao_fila where evento_id=eid)<>2 then raise exception 'TESTE: contrato não gerou fila'; end if;
  perform pieggi.salvar_programacao_campo(eid,2,'{"saidaEm":"2026-11-01T10:00:00Z","alteracoes":"Versão inicial do ciclo","itens":[{"nome":"Item teste","receita":"Receita teste","quantidade":10,"unidade":"UN","setor":"COZINHA_FRIA","servico":"Coffee"}]}','[]','[{"tipo":"MONTAGEM","titulo":"Montar mesa","orientacao":"Montar os itens conferidos.","previstoEm":"2026-11-01T10:00:00Z"},{"tipo":"REPOSICAO","titulo":"Repor mesa","orientacao":"Repor os itens programados.","previstoEm":"2026-11-01T11:00:00Z"},{"tipo":"DESMONTAGEM","titulo":"Desmontar mesa","orientacao":"Retirar e conferir os itens.","previstoEm":"2026-11-01T12:00:00Z"}]');
  perform pieggi.operar_evento(eid,3,'PROGRAMACAO_APROVAR','{}');
  for task in select id from pieggi.operacao_tarefas where evento_id=eid and tipo='CONFERENCIA' and titulo='Conferência da programação' loop
    perform pieggi.operar_evento(eid,4,'TAREFA_ATUALIZAR',jsonb_build_object('id',task.id,'estado','PRONTO'));
  end loop;
  for task in select id from pieggi.operacao_tarefas where evento_id=eid and tipo in ('PRODUCAO','EXPEDICAO') order by case tipo when 'PRODUCAO' then 0 else 1 end loop
    select revisao into rev from pieggi.eventos where id=eid;
    perform pieggi.operar_evento(eid,rev,'TAREFA_ATUALIZAR',jsonb_build_object('id',task.id,'estado','EM_ANDAMENTO'));
    perform pieggi.operar_evento(eid,rev+1,'TAREFA_ATUALIZAR',jsonb_build_object('id',task.id,'estado','PRONTO'));
  end loop;
  for task in select id,row_number() over(order by titulo) n from pieggi.operacao_tarefas where evento_id=eid and tipo='CONFERENCIA' and estado<>'PRONTO' order by titulo loop
    perform set_config('request.jwt.claim.sub',case task.n when 1 then '10000000-0000-4000-8000-000000000001' when 2 then '10000000-0000-4000-8000-000000000002' else '10000000-0000-4000-8000-000000000004' end,true);
    select revisao into rev from pieggi.eventos where id=eid;
    perform pieggi.operar_evento(eid,rev,'TAREFA_ATUALIZAR',jsonb_build_object('id',task.id,'estado','PRONTO'));
  end loop;
  perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
  if exists(select 1 from storage.objects where name=path) then raise exception 'TESTE: contrato vazou para expedição'; end if;
  select revisao into rev from pieggi.eventos where id=eid;
  perform pieggi.operar_evento(eid,rev,'EXPEDIR','{}');
  -- Fixture da conferência interna; o token e a sequência pública têm teste próprio.
  reset role;
  update pieggi.campo_etapas set concluido_em=now() where evento_id=eid;
  set role authenticated;
  for task in select id from pieggi.operacao_tarefas where evento_id=eid and tipo='CAMPO' loop
    path:=eid::text||'/'||task.id::text||'.jpg';
    insert into storage.objects(bucket_id,name,owner_id,metadata) values('pieggi-evidencias',path,auth.uid()::text,'{"mimetype":"image/jpeg"}');
    select revisao into rev from pieggi.eventos where id=eid;
    perform pieggi.concluir_tarefa_evidencia(task.id,rev,path);
  end loop;
  for task in select id from pieggi.operacao_tarefas where evento_id=eid and tipo='RETORNO' loop
    select revisao into rev from pieggi.eventos where id=eid;
    perform pieggi.operar_evento(eid,rev,'TAREFA_ATUALIZAR',jsonb_build_object('id',task.id,'estado','PRONTO'));
  end loop;
  select revisao into rev from pieggi.eventos where id=eid;
  perform pieggi.salvar_balanco(eid,rev,0,'[{"indice":0,"remanescentes":0,"retorno":0,"descarte":0}]','','Conferência local de teste');
  select revisao into rev from pieggi.eventos where id=eid;
  perform pieggi.operar_evento(eid,rev,'ENTREGAR','{}');
  perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
  perform pieggi.operar_evento(eid,rev+1,'POS_VENDA','{"nota":10,"comentario":"Teste local","retornoEm":null}');
  if (select count(*) from pieggi.integracao_fila where evento_id=eid)<>3 then raise exception 'TESTE: pós evento não gerou fila'; end if;
  if (select etapa_operacao from pieggi.eventos where id=eid)<>'ENTREGUE' then raise exception 'TESTE: entrega'; end if;
end $$;
reset role;
