-- Executado apenas no PostgreSQL descartável depois do ciclo operacional.
reset role;
insert into pieggi.fiscal_produtos(id,empresa_id,codigo,descricao,unidade,ncm,cfop_padrao,origem,cst_icms,aliquota_icms,cst_pis,aliquota_pis,cst_cofins,aliquota_cofins,origem_catalogo,referencia_origem,criado_em,atualizado_em)
values('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','TESTE-CAFE','Café','L','09012100','5101','0','90',4,'01',0.65,'01',3,'Teste local','Teste local',now(),now());
set role authenticated;
set request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
do $$ declare f uuid; regra uuid; r jsonb; eid uuid; pid uuid; ids jsonb; resultado jsonb; begin
  r:=pieggi.operar_compras('20000000-0000-4000-8000-000000000001','FORNECEDOR_CRIAR','{"nome":"Fornecedor de teste","contato":"Sem contato real"}'); f:=(r->>'id')::uuid;
  r:=pieggi.operar_compras('20000000-0000-4000-8000-000000000001','REGRA_CRIAR',jsonb_build_object('produtoId','50000000-0000-4000-8000-000000000001','fornecedorId',f,'insumo','Pó de café','unidadeProducao','L','quantidadeProducao',10,'quantidadeCompra',1,'embalagem','Pacote 500g')); regra:=(r->>'id')::uuid;
  r:=pieggi.salvar_evento('20000000-0000-4000-8000-000000000001',null,null,'{"titulo":"Compras exatas"}','{"nome":"Cliente compras","tipo":"PF"}');eid:=(r->'evento'->>'id')::uuid;
  -- Exceção só no fixture, antes de programar, sem contrato real.
  reset role;
  update pieggi.eventos set liberacao_excepcional_motivo='Fixture local' where id=eid;
  set role authenticated;
  r:=pieggi.salvar_programacao_campo(eid,2,'{"saidaEm":"2026-11-01T10:00:00Z","alteracoes":"Teste de demanda exata","itens":[{"nome":"Café","receita":"Receita de café","quantidade":2.5,"unidade":"L","setor":"BEBIDAS","servico":"Coffee","produtoId":"50000000-0000-4000-8000-000000000001"},{"nome":"Café segundo serviço","receita":"Receita de café","quantidade":2.5,"unidade":"L","setor":"BEBIDAS","servico":"Coffee","produtoId":"50000000-0000-4000-8000-000000000001"},{"nome":"Sem conversão","receita":"Receita completa","quantidade":1,"unidade":"UN","setor":"BEBIDAS","servico":"Coffee"}]}','[]','[{"tipo":"MONTAGEM","titulo":"Montar mesa","orientacao":"Montar os itens conferidos.","previstoEm":"2026-11-01T10:00:00Z"},{"tipo":"REPOSICAO","titulo":"Repor mesa","orientacao":"Repor os itens programados.","previstoEm":"2026-11-01T11:00:00Z"},{"tipo":"DESMONTAGEM","titulo":"Desmontar mesa","orientacao":"Retirar e conferir os itens.","previstoEm":"2026-11-01T12:00:00Z"}]'); pid:=(r->>'id')::uuid;
  perform pieggi.operar_evento(eid,3,'PROGRAMACAO_APROVAR','{}');
  resultado:=pieggi.consolidar_compras('20000000-0000-4000-8000-000000000001','2026-11-01','2026-11-01');
  if jsonb_array_length(resultado)<>1 or (resultado->0->>'embalagens')::numeric<>1 or (resultado->0->>'quantidade_exata')::numeric<>0.5 then raise exception 'TESTE: arredondou por evento em vez de consolidar'; end if;
  if (select count(*) from pieggi.compra_demandas where programacao_id=pid and pendencia is not null)<>1 then raise exception 'TESTE: omitiu item sem conversão'; end if;
  ids:=resultado->0->'ids';
  perform pieggi.operar_compras('20000000-0000-4000-8000-000000000001','COMPRADO',jsonb_build_object('ids',ids,'referencia','Pedido teste'));
  perform pieggi.operar_compras('20000000-0000-4000-8000-000000000001','REABRIR',jsonb_build_object('ids',ids,'referencia','Reabertura teste'));
  perform pieggi.registrar_documento_operacional(pid,'PROGRAMACAO','',repeat('a',64));
  perform pieggi.operar_compras('20000000-0000-4000-8000-000000000001','REGRA_REVOGAR',jsonb_build_object('id',regra));
  if (select count(*) from pieggi.compra_demandas where programacao_id=pid and regra_id=regra)<>2 then raise exception 'TESTE: revogar mudou snapshot aprovado'; end if;
  perform pieggi.salvar_programacao_documentos(eid,4,'{"saidaEm":"2026-11-01T10:00:00Z","alteracoes":"Revisão invalida compras","itens":[{"nome":"Item revisão","receita":"Receita revisão","quantidade":1,"unidade":"UN","setor":"BEBIDAS","servico":"Coffee"}]}','[]');
  if jsonb_array_length(pieggi.consolidar_compras('20000000-0000-4000-8000-000000000001','2026-11-01','2026-11-01'))<>0 then raise exception 'TESTE: compras inválidas continuam liberadas'; end if;
  begin perform pieggi.registrar_documento_operacional(pid,'PROGRAMACAO','',repeat('b',64)); raise exception 'TESTE: documento invalidado disponível'; exception when serialization_failure then null; end;
  begin perform pieggi.operar_compras('20000000-0000-4000-8000-000000000001','COMPRADO',jsonb_build_object('ids',ids,'referencia','Não pode')); raise exception 'TESTE: compra invalidada disponível'; exception when serialization_failure then null; end;
end $$;
set request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
do $$ begin
  if exists(select 1 from pieggi.compra_regras) then raise exception 'TESTE: cozinha vê fornecedores'; end if;
  begin perform pieggi.catalogo_compras('20000000-0000-4000-8000-000000000001');raise exception 'TESTE: cozinha lê catálogo';exception when insufficient_privilege then null;end;
end $$;
reset role;
