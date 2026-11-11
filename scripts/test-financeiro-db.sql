reset role;
set role authenticated;
set request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
do $$ declare eid uuid; rev integer; r jsonb; chave uuid:=gen_random_uuid(); corpo jsonb; cid uuid; begin
  r:=pieggi.salvar_evento('20000000-0000-4000-8000-000000000001',null,null,'{"titulo":"Financeiro teste"}','{"nome":"Cliente financeiro teste","tipo":"PF"}');eid:=(r->'evento'->>'id')::uuid;
  perform pieggi.operar_financeiro(eid,1,'VALORES_SALVAR','{"venda":1000.25,"custoEstimado":300}');
  if (select valor_venda from pieggi.evento_valores where evento_id=eid)<>1000.25 then raise exception 'TESTE: venda perdeu centavos';end if;
  select revisao into rev from pieggi.eventos where id=eid;
  corpo:=jsonb_build_object('categoria','ALIMENTACAO','descricao','Alimentos conferidos','valor',123.45,'competencia','2026-10-06','referencia','Nota fixture','idempotencia',chave);
  r:=pieggi.operar_financeiro(eid,rev,'CUSTO_CRIAR',corpo);cid:=(r->>'id')::uuid;
  perform pieggi.operar_financeiro(eid,rev,'CUSTO_CRIAR',corpo);
  if (select count(*) from pieggi.evento_custos where evento_id=eid)<>1 then raise exception 'TESTE: repetição duplicou custo';end if;
  begin perform pieggi.operar_financeiro(eid,rev,'CUSTO_CRIAR',corpo||'{"valor":130}');raise exception 'TESTE: idempotência aceita outro corpo';exception when raise_exception then if SQLERRM<>'Chave já utilizada por outro lançamento.' then raise;end if;end;
  select revisao into rev from pieggi.eventos where id=eid;
  perform pieggi.operar_financeiro(eid,rev,'CUSTO_CANCELAR',jsonb_build_object('id',cid,'motivo','Estorno conferido'));
  if not exists(select 1 from pieggi.evento_custos where id=cid and cancelado_em is not null) then raise exception 'TESTE: histórico de estorno apagado';end if;
end $$;
set request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
do $$ begin
  if exists(select 1 from pieggi.evento_custos) then raise exception 'TESTE: custos vazaram para cozinha';end if;
  begin perform pieggi.operar_financeiro('40000000-0000-4000-8000-000000000001',1,'VALORES_SALVAR','{"venda":1,"custoEstimado":1}');raise exception 'TESTE: cozinha alterou financeiro';exception when insufficient_privilege then null;end;
end $$;
reset role;
