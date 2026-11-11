-- Fluxo guiado do evento: proposta com serviços estruturados (propostas.briefing.servicos, jsonb já existente),
-- programação gerada pelo motor (estrutura completa) e documentos derivados. Idempotente.
-- O banco só armazena: as regras abaixo são dados editáveis pelo admin, não lógica.
begin;

-- Estrutura completa da programação (Programacao do motor), ao lado do formato legado `itens` usado por telas e ganchos.
alter table pieggi.programacoes add column if not exists estrutura jsonb;

-- Dados obrigatórios para contrato passam a ser conferidos no backend (cliente de endereço fixo não digita endereço;
-- telefone do contato é opcional). Remove o CHECK antigo que exigia todos os campos estruturados.
do $$
declare c record;
begin
  for c in select conname from pg_constraint
    where conrelid = 'pieggi.eventos'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%contato_local_telefone%'
  loop
    execute format('alter table pieggi.eventos drop constraint %I', c.conname);
  end loop;
end $$;

-- Carga 3 de regras (gerada a partir de REGRAS_V3 em apps/backend/src/dominios/regras/regras-iniciais.ts).
insert into pieggi.regras_negocio (id, codigo, versao, titulo, descricao, origem, status, escopo, vigente_desde, valor, escopo_tipo, escopo_chave, financeiro) values
  (gen_random_uuid(), 'programacao.checklist', 1, 'Checklist das copeiras na página 1 da programação', 'Checklist das copeiras na página 1 da programação', 'Especificação 05/11/2026 §6 Checklist Copeiras', 'APROVADA', '{}'::jsonb, timestamptz '2026-11-05T00:00:00-03:00', '{"checklistTitulo":"CHECKLIST COPEIRAS","checklist":[{"titulo":"(A) Montagem/entrega, por serviço","texto":"Fotografar cada mesa montada e enviar ao Luiz (WhatsApp) +55 11 97603-8194; faltando algo, avisar o Luiz.","itens":["Auditório montado com café e águas","Coffee da manhã","Almoço","Coffee da tarde","Refresqueiras de suco e chá abastecidas","Acompanhamentos (açúcar, adoçante, achocolatado, sachê de chá)"]},{"titulo":"(B) Higienização e apresentação","itens":["Talheres, pratos, copos e louças sem mancha","Álcool 70% antes de expor","Limpar bicos","Verrines, doces e cupcakes limpos","Nescau limpo e seco","Escaldar garrafas"]},{"titulo":"(C) Lavagem para ir embora","itens":["Retirar restos com papel toalha antes de lavar","Não jogar alimento na pia do cliente"]}]}'::jsonb, 'GLOBAL', '', false),
  (gen_random_uuid(), 'programacao.padroes', 1, 'Programação gerada: saída (min antes do início) e roteiro de campo padrão (base INICIO/MEIO/FIM ± minutos) — confirmar com a operação', 'Programação gerada: saída (min antes do início) e roteiro de campo padrão (base INICIO/MEIO/FIM ± minutos) — confirmar com a operação', 'Especificação 05/11/2026 §6 Programação / 13 Logística', 'PENDENTE', '{}'::jsonb, timestamptz '2026-11-05T00:00:00-03:00', '{"saidaAntesMin":120,"roteiro":[{"tipo":"MONTAGEM","titulo":"Montagem e higienização da mesa","orientacao":"Montar conforme a programação e fotografar a mesa pronta.","base":"INICIO","minutos":-60},{"tipo":"REPOSICAO","titulo":"Reposição","orientacao":"Repor itens e bebidas conforme a programação.","base":"MEIO","minutos":0},{"tipo":"DESMONTAGEM","titulo":"Desmontagem e lavagem","orientacao":"Recolher, lavar conforme o checklist e conferir o retorno.","base":"FIM","minutos":30}]}'::jsonb, 'GLOBAL', '', false),
  (gen_random_uuid(), 'tabela_preco.padrao', 1, 'Tabela de preço padrão (demais clientes)', 'Tabela de preço padrão (demais clientes)', 'Especificação 05/11/2026 §4 Tabelas de preço', 'APROVADA', '{}'::jsonb, timestamptz '2026-11-05T00:00:00-03:00', '"EXTERNOS"'::jsonb, 'GLOBAL', '', false),
  (gen_random_uuid(), 'tabela_preco.padrao', 2, 'StartSe: tabela StartSe-Atual', 'StartSe: tabela StartSe-Atual', 'Especificação 05/11/2026 §4 Tabelas de preço', 'APROVADA', '{}'::jsonb, timestamptz '2026-11-05T00:00:00-03:00', '"STARTSE_ATUAL"'::jsonb, 'CLIENTE', 'STARTSE', false),
  (gen_random_uuid(), 'tabela_preco.padrao', 3, 'Inteli: tabela StartSe-Atual (confirmar)', 'Inteli: tabela StartSe-Atual (confirmar)', 'Especificação 05/11/2026 §4 Tabelas de preço', 'PENDENTE', '{}'::jsonb, timestamptz '2026-11-05T00:00:00-03:00', '"STARTSE_ATUAL"'::jsonb, 'CLIENTE', 'INTELI', false),
  (gen_random_uuid(), 'tabela_preco.padrao', 4, 'WTC: tabela WTC', 'WTC: tabela WTC', 'Especificação 05/11/2026 §4 Tabelas de preço', 'APROVADA', '{}'::jsonb, timestamptz '2026-11-05T00:00:00-03:00', '"WTC"'::jsonb, 'CLIENTE', 'WTC', false)

on conflict (codigo, versao) do nothing;

commit;
