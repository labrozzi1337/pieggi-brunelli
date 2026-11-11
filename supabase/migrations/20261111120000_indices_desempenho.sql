-- Índices para as leituras de toda tela (central de operação, eventos, compras, estoque) e para o aviso de mudanças.
-- Só estrutura de armazenamento: nenhuma regra, função ou trigger. Idempotente.
begin;

create index if not exists operacao_tarefas_programacao_idx on pieggi.operacao_tarefas (programacao_id);
create index if not exists campo_etapas_evento_idx on pieggi.campo_etapas (evento_id);
create index if not exists financeiro_titulos_evento_idx on pieggi.financeiro_titulos (evento_id);
create index if not exists evento_custos_evento_idx on pieggi.evento_custos (evento_id);
create index if not exists operacao_notificacoes_empresa_idx on pieggi.operacao_notificacoes (empresa_id, criado_em desc);
create index if not exists eventos_cliente_idx on pieggi.eventos (cliente_id);
create index if not exists compra_demandas_empresa_idx on pieggi.compra_demandas (empresa_id);
create index if not exists pedido_compra_itens_insumo_idx on pieggi.pedido_compra_itens (insumo_id);
create index if not exists insumo_precos_empresa_idx on pieggi.insumo_precos (empresa_id, registrado_em desc);
create index if not exists estoque_lotes_empresa_idx on pieggi.estoque_lotes (empresa_id);
create index if not exists evento_equipe_evento_idx on pieggi.evento_equipe (evento_id);
create index if not exists evento_balancos_evento_idx on pieggi.evento_balancos (evento_id);
-- Aviso de mudanças em tempo real: "houve alteração nesta empresa desde X?".
create index if not exists auditoria_eventos_empresa_idx on pieggi.auditoria_eventos (empresa_id, criado_em desc);

commit;
