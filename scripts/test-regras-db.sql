-- Fase 1: carga, isolamento de valores financeiros, alteração versionada e auditada.
reset role;
do $$ begin
  if (select count(*) from pieggi.regras_negocio where valor is not null) <> 107 then raise exception 'TESTE: carga de regras incompleta ou duplicada'; end if;
  if (select count(*) from pieggi.cardapio_itens) <> 137 or (select count(*) from pieggi.cardapio_custos) <> 137 then raise exception 'TESTE: carga do cardápio incompleta ou duplicada'; end if;
end $$;

set role authenticated;
set request.jwt.claim.sub='10000000-0000-4000-8000-000000000002'; -- PRODUCAO
do $$ begin
  if exists (select 1 from pieggi.regras_negocio where financeiro) then raise exception 'TESTE: produção leu preço/CMV'; end if;
  if not exists (select 1 from pieggi.regras_negocio where codigo = 'almoco.proteina_g') then raise exception 'TESTE: produção sem regra operacional'; end if;
  if exists (select 1 from pieggi.cardapio_custos) then raise exception 'TESTE: produção leu custo do cardápio'; end if;
  if (select count(*) from pieggi.cardapio_itens) <> 137 then raise exception 'TESTE: produção sem cardápio'; end if;
  begin
    perform pieggi.alterar_regra('almoco.proteina_g', 'GLOBAL', '', '{"COMPLETO":160,"INTERMEDIARIO":170,"REDUZIDO":200}', '2099-01-01', 'Tentativa sem papel');
    raise exception 'TESTE: produção alterou regra';
  exception when insufficient_privilege then null; end;
end $$;

set request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; -- ADMIN
do $$ declare r jsonb; antiga uuid; nova pieggi.regras_negocio%rowtype; begin
  begin
    perform pieggi.alterar_regra('almoco.proteina_g', 'GLOBAL', '', '{"COMPLETO":160,"INTERMEDIARIO":170,"REDUZIDO":200}', '2020-01-01', 'Vigência retroativa');
    raise exception 'TESTE: vigência retroativa aceita';
  exception when raise_exception then if SQLERRM not like 'A vigência não pode ser retroativa%' then raise; end if; end;
  begin
    perform pieggi.alterar_regra('almoco.proteina_g', 'GLOBAL', '', '150', '2099-01-01', 'Formato errado');
    raise exception 'TESTE: formato diferente aceito';
  exception when raise_exception then if SQLERRM not like 'O novo valor precisa%' then raise; end if; end;
  select id into antiga from pieggi.regras_negocio where codigo = 'almoco.proteina_g' and versao = 1;
  r := pieggi.alterar_regra('almoco.proteina_g', 'GLOBAL', '', '{"COMPLETO":160,"INTERMEDIARIO":170,"REDUZIDO":200}', '2099-01-01', 'Caso 7 da especificação');
  select * into nova from pieggi.regras_negocio where id = (r->>'id')::uuid;
  if nova.versao <> 2 or nova.substitui_regra_id <> antiga or nova.financeiro or nova.titulo is null then raise exception 'TESTE: versão nova sem histórico'; end if;
  if (select valor from pieggi.regras_negocio where id = antiga) ->> 'COMPLETO' <> '150' then raise exception 'TESTE: versão anterior foi alterada'; end if;
  r := pieggi.alterar_regra('logistica.valor', 'REGIAO', 'GUARULHOS', '400', '2099-01-01', 'Nova região', 'Logística Guarulhos');
  if not (select financeiro from pieggi.regras_negocio where id = (r->>'id')::uuid) then raise exception 'TESTE: escopo novo de preço ficou visível à operação'; end if;
end $$;

reset role;
do $$ begin
  if (select count(*) from pieggi.auditoria_eventos where acao = 'REGRA_ALTERADA') <> 2 then raise exception 'TESTE: alteração de regra sem auditoria'; end if;
end $$;
select 'OK: regras versionadas, isolamento de preço/custo e cardápio' as resultado;
