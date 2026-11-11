import { autorizarEmpresa, type PapelUsuario, type UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import { linhas, PAPEIS_EVENTO, podeAcessar, temPapel, veValores, type Leitura, type Linha } from "@/dominios/operacao/eventos";
import { ErroOperacao } from "@/dominios/operacao/http";
import { PAPEIS_FINANCEIROS } from "@/dominios/regras/repositorio";

const PAPEIS_COMPRAS = ["ADMIN", "PROGRAMACAO", "EXPEDICAO_COMPRAS"] as const satisfies readonly PapelUsuario[];

/** Eventos da central: em andamento, dos últimos 60 dias (ou desde `desde`, no painel mensal) ou o aberto pelo link. */
export const JANELA_OPERACAO_DIAS = 60;

/**
 * Central de operação numa única consulta (uma ida ao banco). Cada bloco segue a visibilidade que as antigas policies
 * davam a cada perfil; o histórico de versões da programação vem sem os itens (só a versão vigente precisa deles).
 */
export async function painelOperacao(sql: Leitura, usuario: UsuarioAutenticado, empresa: string, eventoAberto?: string, desde?: string) {
  autorizarEmpresa(usuario, empresa);
  const operacional = temPapel(usuario, PAPEIS_EVENTO), financeiro = temPapel(usuario, PAPEIS_FINANCEIROS);
  const lista = (ver: boolean, consulta: ReturnType<Leitura>) => ver ? sql`coalesce((select jsonb_agg(j) from (${consulta}) q), '[]')` : sql`'[]'::jsonb`;
  const [painel] = await sql<{ eventos: Linha[]; programacoes: Linha[]; tarefas: Linha[]; notificacoes: Linha[]; titulos: Linha[]; integracoes: Linha[]; posVenda: Linha[]; etapasCampo: Linha[]; valores: Linha[]; custos: Linha[]; produtos: Linha[] }[]>`
    with ev as (
      select id,titulo,empresa_id,cliente_id,data_evento,pax,horario_inicio,horario_fim,etapa_comercial,etapa_operacao,etapa_financeiro,contrato_assinado_em,revisao
      from eventos where empresa_id = ${empresa}
        and (etapa_operacao <> 'ENTREGUE' or coalesce(data_evento, current_date) >= least(current_date - ${JANELA_OPERACAO_DIAS}::int, ${desde ?? null}::date) or id = ${eventoAberto ?? null}::uuid)
    )
    select
      ${lista(operacional, sql`select to_jsonb(x) j from ev x order by x.data_evento nulls last, x.id`)} eventos,
      ${lista(operacional, sql`select case when p.versao = max(p.versao) over (partition by p.evento_id) then to_jsonb(p) else to_jsonb(p) - 'itens' - 'rotulos' - 'roteiro_campo' end j
        from programacoes p where p.evento_id in (select id from ev) order by p.versao desc, p.id`)} programacoes,
      ${lista(operacional, sql`select to_jsonb(t) j from operacao_tarefas t where t.evento_id in (select id from ev) order by t.id`)} tarefas,
      ${lista(operacional, sql`select to_jsonb(n) j from operacao_notificacoes n where n.empresa_id = ${empresa} order by n.criado_em desc limit 100`)} notificacoes,
      ${lista(financeiro, sql`select to_jsonb(t) j from financeiro_titulos t where t.evento_id in (select id from ev) order by t.id`)} titulos,
      ${lista(financeiro, sql`select to_jsonb(i) j from integracao_fila i where i.evento_id in (select id from ev) order by i.id`)} integracoes,
      ${lista(operacional, sql`select to_jsonb(v) j from evento_pos_venda v where v.evento_id in (select id from ev) order by v.evento_id`)} "posVenda",
      ${lista(true, sql`select to_jsonb(x) j from (select id,evento_id,programacao_id,ordem,tipo,titulo,orientacao,previsto_em,concluido_em,observacao from campo_etapas where evento_id in (select id from ev)) x order by x.ordem, x.id`)} "etapasCampo",
      ${lista(financeiro, sql`select jsonb_build_object('evento_id',v.evento_id,'valor_venda',v.valor_venda,'custo_estimado',v.custo_estimado,'proposta_id',v.proposta_id,'eventos',jsonb_build_object('empresa_id',${empresa}::uuid)) j
        from evento_valores v where v.evento_id in (select id from ev) order by v.evento_id`)} valores,
      ${lista(financeiro, sql`select to_jsonb(c) j from evento_custos c where c.evento_id in (select id from ev) order by c.criado_em desc, c.id`)} custos,
      ${lista(temPapel(usuario, PAPEIS_COMPRAS), sql`select jsonb_build_object('id',id,'codigo',codigo,'descricao',descricao) j from fiscal_produtos where empresa_id = ${empresa} and ativo order by codigo`)} produtos`;
  return { ...painel!, podeValores: veValores(usuario) };
}

/** Produtos fiscais ativos para vincular itens da programação a regras de compra. */
export async function catalogoCompras(sql: Leitura, usuario: UsuarioAutenticado, empresa: string) {
  if (!podeAcessar(usuario, empresa, PAPEIS_COMPRAS)) throw new ErroOperacao("Acesso negado.", 403);
  return linhas(sql`select jsonb_build_object('id',id,'codigo',codigo,'descricao',descricao) j from fiscal_produtos where empresa_id = ${empresa} and ativo order by codigo`);
}

/** Tarefas de produção da programação aprovada de eventos em produção/expedição. */
export async function painelProducao(sql: Leitura, usuario: UsuarioAutenticado, empresa: string) {
  autorizarEmpresa(usuario, empresa);
  if (!temPapel(usuario, ["ADMIN", "PRODUCAO", "PROGRAMACAO"])) throw new ErroOperacao("Perfil sem acesso ao painel de produção.", 403);
  return linhas(sql`
    select jsonb_build_object('id',t.id,'evento_id',t.evento_id,'programacao_id',t.programacao_id,'setor',t.setor,'titulo',t.titulo,'descricao',t.descricao,
      'quantidade',t.quantidade,'unidade',t.unidade,'estado',t.estado,'atualizado_em',t.atualizado_em,
      'programacoes',jsonb_build_object('versao',p.versao,'status',p.status,'saida_em',p.saida_em),
      'eventos',jsonb_build_object('titulo',e.titulo,'revisao',e.revisao,'etapa_operacao',e.etapa_operacao)) j
    from operacao_tarefas t join programacoes p on p.id = t.programacao_id join eventos e on e.id = t.evento_id
    where t.empresa_id = ${empresa} and t.tipo = 'PRODUCAO' and p.status = 'APROVADA' and e.etapa_operacao in ('PRODUCAO','EXPEDICAO')
    order by t.id`);
}

/** Dados da agenda (.ics) do evento; null quando ainda não há contrato, data e horários. */
export async function dadosAgenda(sql: Leitura, usuario: UsuarioAutenticado, eventoId: string) {
  const [e] = await linhas<{ id: string; empresa_id: string; titulo: string; data_evento: string | null; horario_inicio: string | null; horario_fim: string | null; revisao: number; contrato_assinado_em: string | null } & Linha>(sql`
    select to_jsonb(x) j from (select id,empresa_id,titulo,data_evento,horario_inicio,horario_fim,logradouro,numero_endereco,bairro,cidade,uf,revisao,contrato_assinado_em from eventos where id = ${eventoId}) x`);
  if (e && !podeAcessar(usuario, e.empresa_id, PAPEIS_EVENTO)) throw new ErroOperacao("Acesso negado.", 403);
  if (!e?.contrato_assinado_em || !e.data_evento || !e.horario_inicio || !e.horario_fim) return null;
  return { id: e.id, titulo: e.titulo, data: e.data_evento, inicio: e.horario_inicio, fim: e.horario_fim, revisao: e.revisao,
    local: [e.logradouro, e.numero_endereco, e.bairro, e.cidade, e.uf].filter(Boolean).join(", ") };
}
