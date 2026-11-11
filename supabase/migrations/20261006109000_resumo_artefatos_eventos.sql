begin;
-- Indicadores do card: não expõe fornecedor, custo, valor, foto ou conteúdo de documentos.
create or replace function pieggi.resumo_artefatos_eventos(p_empresa uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not pieggi.tem_acesso(p_empresa,array['ADMIN','COMERCIAL','ATENDIMENTO','FINANCEIRO','PROGRAMACAO','PRODUCAO','EXPEDICAO_COMPRAS']) then raise exception 'Acesso negado.' using errcode='42501';end if;
  return coalesce((select jsonb_agg(jsonb_build_object('eventoId',e.id,'versao',p.versao,
    'programacao',coalesce(p.status,'PENDENTE'),
    'comanda',case when p.status is distinct from 'APROVADA' then 'BLOQUEADO' when not exists(
      select 1 from jsonb_array_elements(p.itens) i where not exists(select 1 from pieggi.documentos_operacionais d where d.programacao_id=p.id and d.tipo='COMANDA' and d.setor=i->>'setor')
    ) then 'PRONTO' else 'PENDENTE' end,
    'plaquinhas',case when p.status is distinct from 'APROVADA' then 'BLOQUEADO' when exists(select 1 from pieggi.documentos_operacionais d where d.programacao_id=p.id and d.tipo='PLAQUINHAS') then 'PRONTO' else 'PENDENTE' end,
    'compras',case when p.status is distinct from 'APROVADA' then 'BLOQUEADO' when exists(select 1 from pieggi.compra_demandas d where d.programacao_id=p.id) and not exists(select 1 from pieggi.compra_demandas d where d.programacao_id=p.id and (d.pendencia is not null or d.comprado_em is null)) then 'PRONTO' else 'PENDENTE' end,
    'campo',case when p.status is distinct from 'APROVADA' then 'BLOQUEADO' when (select count(*) from pieggi.operacao_tarefas t where t.programacao_id=p.id and t.tipo='CAMPO')=4 and exists(select 1 from pieggi.campo_etapas t where t.programacao_id=p.id) and not exists(select 1 from pieggi.campo_etapas t where t.programacao_id=p.id and t.concluido_em is null) and not exists(select 1 from pieggi.operacao_tarefas t where t.programacao_id=p.id and t.tipo='CAMPO' and t.estado<>'PRONTO') then 'PRONTO' else 'PENDENTE' end
  ) order by e.id) from pieggi.eventos e left join lateral(select pr.id,pr.versao,pr.status,pr.itens from pieggi.programacoes pr where pr.evento_id=e.id order by pr.versao desc limit 1) p on true where e.empresa_id=p_empresa),'[]'::jsonb);
end $$;
revoke all on function pieggi.resumo_artefatos_eventos(uuid) from public,anon;
grant execute on function pieggi.resumo_artefatos_eventos(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
