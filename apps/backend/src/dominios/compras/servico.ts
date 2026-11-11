// Compras e Estoque com o banco (schema pieggi). Toda regra mora aqui ou em calculos.ts; o banco só guarda.
import type postgres from "postgres";
import { z } from "zod";
import type { UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import { auditar, ErroOperacao } from "@/dominios/operacao/http";
import type { ProgramacaoLinha } from "@/dominios/operacao/ganchos-tipos";
import { Leitor } from "@/dominios/regras/motor";
import { carregarRegras, dataSaoPaulo } from "@/dominios/regras/repositorio";
import type { Tx } from "@/integrations/banco";
import {
  arred, calcularAlertas, cmvEstimado, consolidarPorFornecedor, converter, custoMedioPonderado, custoPorFicha, escolherFornecedor,
  explodirNecessidade, normalizarTexto, ranquearCotacao, segundaDaSemana, sugerirInsumos, unidadeBase,
  type DemandaPronta, type InsumoCompra, type Oferta
} from "./calculos";

type Db = postgres.ISql;
const hoje = () => dataSaoPaulo(new Date());
const SISTEMA = { papeis: ["ADMIN" as const] };

// ---------------------------------------------------------------- Regras

export async function parametros(db: Db) {
  const l = new Leitor(await carregarRegras(db, SISTEMA), { data: hoje() });
  const num = z.number().min(0);
  return {
    rendimentos: l.ler("rendimento", z.record(z.string(), z.number().positive()), {}, false) ?? {},
    variacaoPreco: l.ler("compras.variacao_preco_alerta", num, {}, false) ?? Infinity,
    diasValidade: l.ler("estoque.validade_alerta_dias", z.number().int().min(0), {}, false) ?? 0,
    custoFinanceiro: l.ler("compras.custo_financeiro_mensal", num, {}, false) ?? 0,
    cmvAlerta: l.ler("compras.cmv_alerta", num, {}, false) ?? l.ler("cmv.bloqueio", num, {}, false) ?? Infinity,
    cmvDivisor: l.ler("cmv.divisor_preco", z.number().positive(), {}, false) ?? null
  };
}

// ---------------------------------------------------------------- Itens da programação (formato atual e o novo de documentos/tipos.ts)

const itemSchema = z.object({
  nome: z.string().optional(), receita: z.string().optional(), item: z.string().optional(),
  quantidade: z.number(), unidade: z.string(), setor: z.string().optional(),
  produtoId: z.string().uuid().nullish(), cardapioItemId: z.string().uuid().nullish(),
  fornecedor: z.string().nullish(), compradoPronto: z.boolean().optional()
});
export const codigoFornecedor = (texto: string) => normalizarTexto(texto).toUpperCase().replace(/ /g, "_");

interface Fichas { porItem: Map<string, LinhaFichaDb[]>; porProduto: Map<string, LinhaFichaDb[]> }
interface LinhaFichaDb { cardapio_item_id: string | null; produto_id: string | null; insumo_id: string; insumo: string; unidade: string; unidade_item: string; quantidade: number; rendimento: number | null; rendimento_chave: string | null }

async function lerFichas(db: Db, empresaId: string): Promise<Fichas> {
  const linhas = await db<LinhaFichaDb[]>`select f.cardapio_item_id, f.produto_id, f.insumo_id, i.nome insumo, i.unidade, f.unidade_item, f.quantidade, f.rendimento, i.rendimento_chave
    from fichas_tecnicas f join insumos i on i.id = f.insumo_id where i.empresa_id = ${empresaId} and i.ativo`;
  const agrupar = (k: "cardapio_item_id" | "produto_id") => linhas.reduce((m, l) => l[k] ? m.set(l[k], [...(m.get(l[k]) ?? []), l]) : m, new Map<string, LinhaFichaDb[]>());
  return { porItem: agrupar("cardapio_item_id"), porProduto: agrupar("produto_id") };
}

const rendimentoDe = (l: Pick<LinhaFichaDb, "rendimento" | "rendimento_chave">, rendimentos: Record<string, number>) =>
  l.rendimento ?? (l.rendimento_chave ? rendimentos[l.rendimento_chave] : undefined) ?? 1;

/** Porta do antigo trigger gerar_demanda_compra: explode cada item da programação aprovada em demandas por insumo. */
export async function gerarDemandas(tx: Tx, p: Pick<ProgramacaoLinha, "id" | "evento_id" | "empresa_id" | "itens">, indices?: ReadonlySet<number>) {
  const { rendimentos } = await parametros(tx);
  const fichas = await lerFichas(tx, p.empresa_id);
  const cardapio = await tx<{ id: string; nome: string; fornecedor: string | null }[]>`select id, nome, fornecedor from cardapio_itens where ativo`;
  const porNome = new Map(cardapio.map((c) => [normalizarTexto(c.nome), c]));
  const porId = new Map(cardapio.map((c) => [c.id, c]));
  const fornecedores = new Map((await tx<{ id: string; codigo: string }[]>`select id, codigo from fornecedores where empresa_id = ${p.empresa_id} and ativo and codigo is not null`).map((f) => [f.codigo, f.id]));
  const linhas: Record<string, unknown>[] = [];
  p.itens.forEach((bruto, indice) => {
    if (indices && !indices.has(indice)) return;
    const base = { empresa_id: p.empresa_id, evento_id: p.evento_id, programacao_id: p.id, item_indice: indice };
    const lido = itemSchema.safeParse(bruto);
    if (!lido.success) { linhas.push({ ...base, item_nome: "Item ilegível", insumo: "Item ilegível", pendencia: "Item da programação em formato inválido." }); return; }
    const i = lido.data;
    const nome = (i.nome ?? i.receita ?? i.item ?? "Item").trim();
    const c = (i.cardapioItemId && porId.get(i.cardapioItemId)) || [i.nome, i.receita, i.item].map((n) => n && porNome.get(normalizarTexto(n))).find(Boolean) || undefined;
    const ficha = (c && fichas.porItem.get(c.id)) || (i.produtoId && fichas.porProduto.get(i.produtoId)) || undefined;
    const pronto = (texto: string | null | undefined) => {
      const codigo = texto ? codigoFornecedor(texto) : "";
      if (!codigo) return linhas.push({ ...base, item_nome: nome, insumo: nome, pendencia: "Item comprado pronto sem fornecedor definido no cardápio." });
      linhas.push({ ...base, item_nome: nome, insumo: nome, pronto: true, fornecedor_codigo: codigo, fornecedor_id: fornecedores.get(codigo) ?? null, quantidade: i.quantidade, unidade: i.unidade,
        pendencia: fornecedores.has(codigo) ? null : `Fornecedor ${codigo} não cadastrado em Compras.` });
    };
    if (i.compradoPronto || i.fornecedor || i.setor === "FORNECEDOR") return void pronto(i.fornecedor ?? c?.fornecedor);
    if (!ficha) {
      if (c?.fornecedor) return void pronto(c.fornecedor);
      linhas.push({ ...base, item_nome: nome, insumo: nome, pendencia: c ? "Item do cardápio sem ficha técnica." : "Item sem vínculo com o cardápio nem ficha técnica." });
      return;
    }
    const explosao = explodirNecessidade(i.quantidade, i.unidade, ficha.map((f) => ({ insumoId: f.insumo_id, unidadeItem: f.unidade_item, quantidade: f.quantidade, rendimento: rendimentoDe(f, rendimentos) })));
    if (explosao.erro) { linhas.push({ ...base, item_nome: nome, insumo: nome, pendencia: `Unidade incompatível: ${explosao.erro}` }); return; }
    explosao.linhas.forEach((n, k) => linhas.push({ ...base, item_nome: nome, insumo: ficha[k]!.insumo, insumo_id: n.insumoId, unidade: ficha[k]!.unidade, quantidade_bruta: n.bruta, rendimento: n.rendimento, quantidade: n.corrigida }));
  });
  const colunas = ["empresa_id", "evento_id", "programacao_id", "item_indice", "item_nome", "insumo", "insumo_id", "unidade", "quantidade_bruta", "rendimento", "quantidade", "pronto", "fornecedor_codigo", "fornecedor_id", "pendencia"] as const;
  const completas = linhas.map((l) => Object.fromEntries(colunas.map((k) => [k, l[k] ?? (k === "pronto" ? false : null)])));
  if (completas.length) await tx`insert into compra_demandas ${tx(completas as never, colunas as never)}`;
  return completas.length;
}

// ---------------------------------------------------------------- Estoque: saldo, FEFO

async function travarInsumo(tx: Tx, empresaId: string, insumoId: string) {
  const [i] = await tx<{ id: string; nome: string; unidade: string; custo_medio: number; saldo: number; setor: string; perecivel: boolean }[]>`
    select i.id, i.nome, i.unidade, i.custo_medio, i.setor, i.perecivel, coalesce((select sum(m.quantidade) from estoque_movimentos m where m.insumo_id = i.id), 0) saldo
    from insumos i where i.id = ${insumoId} and i.empresa_id = ${empresaId} for update of i`;
  if (!i) throw new ErroOperacao("Insumo não encontrado.", 404);
  return i;
}

interface Movimento { tipo: "BAIXA_EXPEDICAO" | "DEVOLUCAO" | "AJUSTE_INVENTARIO" | "ENTRADA"; eventoId?: string; inventarioId?: string; notaId?: string; justificativa?: string; usuarioId: string }

/** Saída consumindo primeiro o lote que vence antes (FEFO). O que faltar em lote sai sem lote (saldo negativo vira alerta). */
async function baixar(tx: Tx, empresaId: string, insumo: { id: string; custo_medio: number }, quantidade: number, m: Movimento) {
  let resta = arred(quantidade);
  const lotes = await tx<{ id: string; saldo: number }[]>`select id, saldo from estoque_lotes where insumo_id = ${insumo.id} and saldo > 0 order by validade nulls last, criado_em for update`;
  const movimentos: Array<{ lote_id: string | null; quantidade: number }> = [];
  for (const l of lotes) {
    if (resta <= 0) break;
    const q = Math.min(l.saldo, resta);
    await tx`update estoque_lotes set saldo = ${arred(l.saldo - q)} where id = ${l.id}`;
    movimentos.push({ lote_id: l.id, quantidade: q });
    resta = arred(resta - q);
  }
  if (resta > 0) movimentos.push({ lote_id: null, quantidade: resta });
  for (const mv of movimentos) await inserirMovimento(tx, empresaId, insumo.id, mv.lote_id, -mv.quantidade, insumo.custo_medio, m);
}

async function inserirMovimento(tx: Tx, empresaId: string, insumoId: string, loteId: string | null, quantidade: number, custo: number, m: Movimento) {
  await tx`insert into estoque_movimentos (empresa_id, insumo_id, lote_id, tipo, quantidade, custo_unitario, evento_id, nota_id, inventario_id, justificativa, usuario_id)
    values (${empresaId}, ${insumoId}, ${loteId}, ${m.tipo}, ${arred(quantidade)}, ${custo}, ${m.eventoId ?? null}, ${m.notaId ?? null}, ${m.inventarioId ?? null}, ${m.justificativa ?? null}, ${m.usuarioId})`;
}

/** Baixa automática na expedição: sai do estoque a necessidade corrigida (cru) das demandas do evento. Idempotente. */
export async function baixarExpedicao(tx: Tx, usuario: UsuarioAutenticado, eventoId: string) {
  const demandas = await tx<{ id: string; empresa_id: string; insumo_id: string | null; quantidade: number | null }[]>`
    select d.id, d.empresa_id, d.insumo_id, d.quantidade from compra_demandas d join programacoes p on p.id = d.programacao_id
    where d.evento_id = ${eventoId} and p.status = 'APROVADA' and d.cancelada_em is null and d.consumida_em is null and d.pendencia is null for update of d`;
  if (!demandas.length) return { baixados: 0 };
  const porInsumo = new Map<string, number>();
  for (const d of demandas) if (d.insumo_id && d.quantidade) porInsumo.set(d.insumo_id, (porInsumo.get(d.insumo_id) ?? 0) + d.quantidade);
  const empresaId = demandas[0]!.empresa_id;
  for (const [insumoId, q] of [...porInsumo].sort(([a], [b]) => a.localeCompare(b))) {
    const insumo = await travarInsumo(tx, empresaId, insumoId);
    await baixar(tx, empresaId, insumo, q, { tipo: "BAIXA_EXPEDICAO", eventoId, usuarioId: usuario.id });
  }
  await tx`update compra_demandas set consumida_em = now() where id in ${tx(demandas.map((d) => d.id))}`;
  await auditar(tx, usuario, { acao: "ESTOQUE_BAIXA_EXPEDICAO", entidade: "evento", entidadeId: eventoId, empresaId, dados: { insumos: Object.fromEntries(porInsumo) } });
  return { baixados: porInsumo.size };
}

export async function registrarDevolucao(tx: Tx, usuario: UsuarioAutenticado, empresaId: string, eventoId: string, itens: ReadonlyArray<{ insumoId: string; quantidade: number }>) {
  const [evento] = await tx`select 1 from eventos where id = ${eventoId} and empresa_id = ${empresaId}`;
  if (!evento) throw new ErroOperacao("Evento não encontrado.", 404);
  for (const item of itens) {
    const i = await travarInsumo(tx, empresaId, item.insumoId);
    await inserirMovimento(tx, empresaId, i.id, null, item.quantidade, i.custo_medio, { tipo: "DEVOLUCAO", eventoId, usuarioId: usuario.id });
  }
  await auditar(tx, usuario, { acao: "ESTOQUE_DEVOLUCAO", entidade: "evento", entidadeId: eventoId, empresaId, dados: { itens } });
}

/** Contagem por setor: compara saldo do sistema × físico e ajusta com autor, data e justificativa. */
export async function registrarInventario(tx: Tx, usuario: UsuarioAutenticado, empresaId: string, setor: string, contagens: ReadonlyArray<{ insumoId: string; contado: number; justificativa?: string }>) {
  const [inv] = await tx<{ id: string }[]>`insert into inventarios (empresa_id, setor, criado_por) values (${empresaId}, ${setor}, ${usuario.id}) returning id`;
  const ajustes: Array<{ insumo: string; sistema: number; contado: number; diferenca: number; valor: number }> = [];
  for (const c of [...contagens].sort((a, b) => a.insumoId.localeCompare(b.insumoId))) {
    const i = await travarInsumo(tx, empresaId, c.insumoId);
    if (i.setor !== setor) throw new ErroOperacao(`${i.nome} não pertence ao setor contado.`, 422);
    const diferenca = arred(c.contado - i.saldo);
    const justificativa = c.justificativa?.trim() || null;
    if (diferenca !== 0 && (!justificativa || justificativa.length < 5)) throw new ErroOperacao(`Justifique a divergência de ${i.nome}.`, 422);
    await tx`insert into inventario_contagens (inventario_id, insumo_id, saldo_sistema, contado, custo_unitario, justificativa)
      values (${inv!.id}, ${i.id}, ${i.saldo}, ${c.contado}, ${i.custo_medio}, ${justificativa})`;
    if (diferenca === 0) continue;
    const m: Movimento = { tipo: "AJUSTE_INVENTARIO", inventarioId: inv!.id, justificativa: justificativa!, usuarioId: usuario.id };
    if (diferenca < 0) await baixar(tx, empresaId, i, -diferenca, m);
    else await inserirMovimento(tx, empresaId, i.id, null, diferenca, i.custo_medio, m);
    ajustes.push({ insumo: i.nome, sistema: i.saldo, contado: c.contado, diferenca, valor: arred(diferenca * i.custo_medio, 2) });
    await auditar(tx, usuario, { acao: "ESTOQUE_AJUSTE_INVENTARIO", entidade: "insumo", entidadeId: i.id, empresaId, dados: { inventarioId: inv!.id, antes: i.saldo, depois: c.contado, justificativa } });
  }
  return { id: inv!.id, ajustes, perda: arred(ajustes.reduce((s, a) => s + Math.min(0, a.valor), 0), 2) };
}

// ---------------------------------------------------------------- Entrada por nota

export interface NotaEntrada {
  fornecedorId: string; numero: string; emitidaEm: string; fotoPath?: string | null; pedidoId?: string | null;
  itens: Array<{ insumoId: string; descricao: string; quantidade: number; fator: number; valorTotal: number; lote?: string; validade?: string | null }>;
}

/** Lote de notas: cada item entra em estoque, atualiza custo médio ponderado, histórico de preço e o apelido do fornecedor. */
export async function lancarNotas(tx: Tx, usuario: UsuarioAutenticado, empresaId: string, notas: readonly NotaEntrada[]) {
  const afetados = new Set<string>();
  const ids: string[] = [];
  for (const n of notas) {
    const [f] = await tx`select 1 from fornecedores where id = ${n.fornecedorId} and empresa_id = ${empresaId}`;
    if (!f) throw new ErroOperacao("Fornecedor não encontrado.", 404);
    if (n.fotoPath && !n.fotoPath.startsWith(`notas/${empresaId}/`)) throw new ErroOperacao("Foto da nota inválida.", 422);
    const [nota] = await tx<{ id: string }[]>`insert into notas_entrada (empresa_id, fornecedor_id, numero, emitida_em, foto_path, pedido_id, criado_por)
      values (${empresaId}, ${n.fornecedorId}, ${n.numero}, ${n.emitidaEm}, ${n.fotoPath ?? null}, ${n.pedidoId ?? null}, ${usuario.id}) returning id`;
    ids.push(nota!.id);
    for (const item of n.itens) {
      const i = await travarInsumo(tx, empresaId, item.insumoId);
      if (i.perecivel && !item.validade) throw new ErroOperacao(`${i.nome} é perecível: informe a validade.`, 422);
      const quantidade = arred(item.quantidade * item.fator);
      const custo = arred(item.valorTotal / quantidade);
      const [ni] = await tx<{ id: string }[]>`insert into nota_entrada_itens (nota_id, insumo_id, descricao, quantidade, fator, valor_total, lote, validade)
        values (${nota!.id}, ${i.id}, ${item.descricao}, ${item.quantidade}, ${item.fator}, ${item.valorTotal}, ${item.lote ?? ""}, ${item.validade ?? null}) returning id`;
      const [lote] = await tx<{ id: string }[]>`insert into estoque_lotes (empresa_id, insumo_id, lote, validade, saldo, custo_unitario, nota_item_id)
        values (${empresaId}, ${i.id}, ${item.lote ?? ""}, ${item.validade ?? null}, ${quantidade}, ${custo}, ${ni!.id}) returning id`;
      await inserirMovimento(tx, empresaId, i.id, lote!.id, quantidade, custo, { tipo: "ENTRADA", notaId: nota!.id, usuarioId: usuario.id });
      await tx`update insumos set custo_medio = ${custoMedioPonderado(i.saldo, i.custo_medio, quantidade, custo)} where id = ${i.id}`;
      await tx`insert into insumo_precos (empresa_id, insumo_id, fornecedor_id, preco_unitario, origem, usuario_id) values (${empresaId}, ${i.id}, ${n.fornecedorId}, ${custo}, 'NOTA', ${usuario.id})`;
      await tx`insert into insumo_fornecedores (empresa_id, insumo_id, fornecedor_id, embalagem, quantidade_embalagem, preco)
        values (${empresaId}, ${i.id}, ${n.fornecedorId}, '', ${item.fator}, ${arred(custo * item.fator, 4)})
        on conflict (insumo_id, fornecedor_id) do update set preco = round(${custo}::numeric * insumo_fornecedores.quantidade_embalagem, 4), atualizado_em = now()`;
      const apelido = normalizarTexto(item.descricao);
      if (apelido) await tx`insert into apelidos_fornecedor (empresa_id, fornecedor_id, apelido, insumo_id) values (${empresaId}, ${n.fornecedorId}, ${apelido}, ${i.id})
        on conflict (fornecedor_id, apelido) do update set insumo_id = excluded.insumo_id, atualizado_em = now()`;
      afetados.add(i.id);
    }
    if (n.pedidoId) await tx`update pedidos_compra set status = 'RECEBIDO', atualizado_em = now() where id = ${n.pedidoId} and empresa_id = ${empresaId} and status in ('ABERTO','ENVIADO')`;
    await auditar(tx, usuario, { acao: "ESTOQUE_ENTRADA_NOTA", entidade: "nota_entrada", entidadeId: nota!.id, empresaId, dados: { numero: n.numero, itens: n.itens.length } });
  }
  const custos = await recalcularCustosCardapio(tx, [...afetados]);
  return { notas: ids, custosAtualizados: custos.length };
}

// ---------------------------------------------------------------- CMV: ficha técnica × custo médio → cardapio_custos

/** Custo do insumo: médio do estoque; sem entrada ainda, o da melhor cotação. */
async function custosInsumos(db: Db, insumoIds?: readonly string[]) {
  const linhas = await db<{ id: string; custo_medio: number; cotacao: number | null }[]>`
    select i.id, i.custo_medio, (select min(o.preco / o.quantidade_embalagem) from insumo_fornecedores o where o.insumo_id = i.id and o.preco > 0) cotacao
    from insumos i where ${insumoIds ? db`i.id in ${db(insumoIds as string[])}` : db`true`}`;
  return new Map(linhas.map((l) => [l.id, l.custo_medio > 0 ? l.custo_medio : l.cotacao]));
}

/** Recalcula o custo dos itens do cardápio que usam os insumos e grava em cardapio_custos. Devolve os itens alterados. */
export async function recalcularCustosCardapio(tx: Tx, insumoIds: readonly string[]) {
  if (!insumoIds.length) return [];
  const { rendimentos } = await parametros(tx);
  const fichas = await tx<LinhaFichaDb[]>`select f.cardapio_item_id, f.produto_id, f.insumo_id, i.nome insumo, i.unidade, f.unidade_item, f.quantidade, f.rendimento, i.rendimento_chave
    from fichas_tecnicas f join insumos i on i.id = f.insumo_id
    where f.cardapio_item_id in (select cardapio_item_id from fichas_tecnicas where insumo_id in ${tx(insumoIds as string[])} and cardapio_item_id is not null)`;
  const custos = await custosInsumos(tx, [...new Set(fichas.map((f) => f.insumo_id))]);
  const itens = new Map<string, LinhaFichaDb[]>();
  for (const f of fichas) itens.set(f.cardapio_item_id!, [...(itens.get(f.cardapio_item_id!) ?? []), f]);
  const alterados: string[] = [];
  for (const [itemId, linhas] of itens) {
    const custo = custoPorFicha(linhas.map((l) => ({ quantidade: l.quantidade, rendimento: rendimentoDe(l, rendimentos), custo: custos.get(l.insumo_id) ?? null })));
    if (custo === null) continue;
    // Referência do aviso de CMV: o custo com que o item foi precificado (planilha), ou o primeiro custo calculado.
    await tx`insert into cardapio_custo_referencia (item_id, custo) values (${itemId}, coalesce((select custo from cardapio_custos where item_id = ${itemId} and custo > 0), ${custo}::numeric)) on conflict (item_id) do nothing`;
    await tx`insert into cardapio_custos (item_id, custo) values (${itemId}, ${custo}) on conflict (item_id) do update set custo = excluded.custo, atualizado_em = now()`;
    alterados.push(itemId);
  }
  return alterados;
}

/** Itens do cardápio que não podem fechar proposta: sem ficha técnica ou com insumo sem custo (nem estoque nem cotação). */
export async function itensSemFichaTecnica(sql: Db, itemIds?: readonly string[]) {
  const itens = await sql<{ id: string; nome: string; linhas: number; sem_custo: string[] }[]>`
    select c.id, c.nome, count(f.id)::int linhas,
      coalesce(array_agg(i.nome order by i.nome) filter (where i.id is not null and i.custo_medio = 0
        and not exists (select 1 from insumo_fornecedores o where o.insumo_id = i.id and o.preco > 0)), '{}') sem_custo
    from cardapio_itens c left join fichas_tecnicas f on f.cardapio_item_id = c.id left join insumos i on i.id = f.insumo_id
    where c.ativo and ${itemIds ? sql`c.id in ${sql(itemIds.length ? itemIds as string[] : ["00000000-0000-0000-0000-000000000000"])}` : sql`true`}
    group by c.id, c.nome order by c.nome`;
  return itens.filter((i) => !i.linhas || i.sem_custo.length)
    .map((i) => ({ id: i.id, nome: i.nome, motivo: i.linhas ? `insumo sem custo nem cotação (${i.sem_custo.join(", ")}).` : "sem ficha técnica — preço por estimativa." }));
}

/** CMV estimado dos itens cujo custo médio subiu em relação ao custo de referência do preço. */
export async function cmvItens(sql: Db, divisor: number | null) {
  if (!divisor) return [];
  const linhas = await sql<{ id: string; nome: string; custo: number; referencia: number }[]>`
    select c.id, c.nome, k.custo, r.custo referencia from cardapio_itens c join cardapio_custos k on k.item_id = c.id join cardapio_custo_referencia r on r.item_id = c.id where c.ativo`;
  return linhas.map((l) => ({ id: l.id, nome: l.nome, custo: l.custo, referencia: l.referencia, cmv: cmvEstimado(l.custo, l.referencia, divisor) ?? 0 }));
}

/** Avisos de CMV para o comercial (aviso antes da próxima proposta usar o item). */
export async function alertasCmv(sql: Db) {
  const p = await parametros(sql);
  return (await cmvItens(sql, p.cmvDivisor)).filter((c) => c.cmv >= p.cmvAlerta);
}

// ---------------------------------------------------------------- Visão semanal e pedidos

interface DemandaDb { id: string; evento: string; item_nome: string; insumo_id: string | null; insumo: string; quantidade: number | null; unidade: string | null; pronto: boolean; fornecedor_id: string | null; pendencia: string | null; pedido_id: string | null; evento_id: string; versao: number }
interface InsumoDb { id: string; nome: string; marca: string; setor: string; unidade: string; unidade_compra: string; fator_compra: number; estoque_minimo: number; perecivel: boolean; rendimento_chave: string | null; custo_medio: number; ativo: boolean; saldo: number; em_pedido: number }
interface OfertaDb { id: string; insumo_id: string; fornecedor_id: string; fornecedor: string; embalagem: string; quantidade_embalagem: number; preco: number; preferido: boolean; prazo_pagamento_dias: number; pedido_minimo: number; atualizado_em: Date }

export async function listarInsumos(db: Db, empresaId: string) {
  return db<InsumoDb[]>`select i.id, i.nome, i.marca, i.setor, i.unidade, i.unidade_compra, i.fator_compra, i.estoque_minimo, i.perecivel, i.rendimento_chave, i.custo_medio, i.ativo,
      coalesce((select sum(m.quantidade) from estoque_movimentos m where m.insumo_id = i.id), 0) saldo,
      coalesce((select sum(pi.quantidade) from pedido_compra_itens pi join pedidos_compra pc on pc.id = pi.pedido_id where pi.insumo_id = i.id and pc.status in ('ABERTO','ENVIADO')), 0) em_pedido
    from insumos i where i.empresa_id = ${empresaId} order by i.setor, i.nome`;
}

export async function listarOfertas(db: Db, empresaId: string) {
  return db<OfertaDb[]>`select o.id, o.insumo_id, o.fornecedor_id, f.nome fornecedor, o.embalagem, o.quantidade_embalagem, o.preco, o.preferido, f.prazo_pagamento_dias, f.pedido_minimo, o.atualizado_em
    from insumo_fornecedores o join fornecedores f on f.id = o.fornecedor_id where o.empresa_id = ${empresaId} and f.ativo order by f.nome`;
}

const paraOferta = (o: OfertaDb, unidade: string): Oferta => ({
  fornecedorId: o.fornecedor_id, fornecedor: o.fornecedor, preco: o.preco, quantidadeEmbalagem: o.quantidade_embalagem, unidade,
  prazoDias: o.prazo_pagamento_dias, pedidoMinimo: o.pedido_minimo, preferido: o.preferido, embalagem: o.embalagem
});

/** Cotação comparativa: todas as ofertas de cada insumo na unidade padronizada, ranqueadas. */
export async function cotacao(db: Db, empresaId: string) {
  const [{ custoFinanceiro }, insumos, ofertas, historico] = await Promise.all([parametros(db), listarInsumos(db, empresaId), listarOfertas(db, empresaId), db<{ insumo_id: string; fornecedor: string; preco_unitario: number; origem: string; registrado_em: Date }[]>`
    select p.insumo_id, f.nome fornecedor, p.preco_unitario, p.origem, p.registrado_em from insumo_precos p join fornecedores f on f.id = p.fornecedor_id
    where p.empresa_id = ${empresaId} and p.registrado_em > now() - interval '180 days' order by p.registrado_em desc`]);
  return insumos.filter((i) => i.ativo).map((i) => ({
    insumoId: i.id, nome: i.nome, setor: i.setor, unidade: i.unidade, base: unidadeBase(i.unidade),
    ofertas: ranquearCotacao(ofertas.filter((o) => o.insumo_id === i.id).map((o) => ({ ...paraOferta(o, i.unidade), id: o.id })), custoFinanceiro),
    historico: historico.filter((h) => h.insumo_id === i.id).slice(0, 20).map((h) => ({ fornecedor: h.fornecedor, preco: h.preco_unitario, origem: h.origem, em: h.registrado_em }))
  }));
}

export async function visaoSemanal(db: Db, empresaId: string, inicio: string, fim: string) {
  const [{ custoFinanceiro }, insumos, ofertas, fornecedores, demandas, canceladas, pedidosSemana] = await Promise.all([
    parametros(db), listarInsumos(db, empresaId), listarOfertas(db, empresaId),
    db<{ id: string; nome: string; codigo: string | null; prazo_pagamento_dias: number; pedido_minimo: number }[]>`select id, nome, codigo, prazo_pagamento_dias, pedido_minimo from fornecedores where empresa_id = ${empresaId}`,
    db<DemandaDb[]>`
    select d.id, e.titulo evento, d.evento_id, p.versao, d.item_nome, d.insumo_id, d.insumo, d.quantidade, d.unidade, d.pronto, d.fornecedor_id, d.pendencia, d.pedido_id
    from compra_demandas d join programacoes p on p.id = d.programacao_id join eventos e on e.id = d.evento_id
    where d.empresa_id = ${empresaId} and p.status = 'APROVADA' and d.cancelada_em is null and d.consumida_em is null and d.comprado_em is null
      and (p.saida_em at time zone 'America/Sao_Paulo')::date between ${inicio} and ${fim}
    order by e.titulo, d.item_indice`,
    db<{ evento: string; item_nome: string; fornecedor: string; pedido_id: string }[]>`
    select e.titulo evento, d.item_nome, f.nome fornecedor, d.pedido_id from compra_demandas d join eventos e on e.id = d.evento_id
    join pedidos_compra pc on pc.id = d.pedido_id join fornecedores f on f.id = pc.fornecedor_id
    where d.empresa_id = ${empresaId} and d.cancelada_em is not null and pc.status in ('ABERTO','ENVIADO')`,
    listarPedidos(db, empresaId, segundaDaSemana(inicio), fim)
  ]);
  const porInsumo = new Map(insumos.map((i) => [i.id, i]));
  const necessidade = new Map<string, number>();
  for (const d of demandas) if (d.insumo_id && !d.pendencia && d.quantidade) necessidade.set(d.insumo_id, (necessidade.get(d.insumo_id) ?? 0) + d.quantidade);
  const compra = new Map<string, InsumoCompra>();
  for (const [id, total] of necessidade) {
    const i = porInsumo.get(id);
    if (!i) continue;
    const base = unidadeBase(i.unidade);
    const qBase = base ? converter(Math.max(0, total - Math.max(0, i.saldo) - i.em_pedido), i.unidade, base) ?? 0 : 0;
    const escolhida = escolherFornecedor(ofertas.filter((o) => o.insumo_id === id).map((o) => paraOferta(o, i.unidade)), custoFinanceiro, qBase);
    compra.set(id, {
      id, nome: i.nome, unidade: i.unidade, estoque: i.saldo, emPedido: i.em_pedido, fornecedorId: escolhida?.fornecedorId ?? null,
      embalagem: escolhida?.embalagem || i.unidade_compra, quantidadeEmbalagem: escolhida?.quantidadeEmbalagem ?? i.fator_compra, precoEmbalagem: escolhida?.preco ?? null
    });
  }
  const prontos: DemandaPronta[] = demandas.filter((d) => d.pronto && !d.pendencia && !d.pedido_id && d.quantidade)
    .map((d) => ({ fornecedorId: d.fornecedor_id, descricao: d.insumo, quantidade: d.quantidade!, unidade: d.unidade ?? "UN", evento: d.evento, demandaId: d.id }));
  const pedidos = consolidarPorFornecedor(demandas.filter((d) => d.insumo_id && !d.pendencia && d.quantidade).map((d) => ({ insumoId: d.insumo_id!, corrigida: d.quantidade!, evento: d.evento })), compra, prontos);
  const nomes = new Map(fornecedores.map((f) => [f.id, f]));
  const porFornecedor = [...pedidos].map(([fornecedorId, linhas]) => {
    const f = nomes.get(fornecedorId);
    const total = arred(linhas.reduce((s, l) => s + (l.precoEstimado ?? 0), 0), 2);
    return { fornecedorId: fornecedorId || null, fornecedor: f?.nome ?? "Sem fornecedor cotado", prazoPagamentoDias: f?.prazo_pagamento_dias ?? null, pedidoMinimo: f?.pedido_minimo ?? 0,
      total, atendeMinimo: !f || total >= f.pedido_minimo, linhas };
  }).sort((a, b) => (a.fornecedorId ? 0 : 1) - (b.fornecedorId ? 0 : 1) || a.fornecedor.localeCompare(b.fornecedor));
  return {
    inicio, fim, semana: segundaDaSemana(inicio), fornecedores: porFornecedor,
    pendencias: demandas.filter((d) => d.pendencia).map((d) => ({ id: d.id, eventoId: d.evento_id, evento: d.evento, versao: d.versao, item: d.item_nome, pendencia: d.pendencia })),
    canceladasEmPedido: canceladas,
    pedidos: pedidosSemana
  };
}

export async function listarPedidos(db: Db, empresaId: string, de: string, ate: string) {
  return db<{ id: string; fornecedor: string; semana: string; status: string; criado_em: Date; itens: number; total: number | null }[]>`
    select pc.id, f.nome fornecedor, pc.semana::text semana, pc.status, pc.criado_em, count(pi.id)::int itens, sum(pi.preco_estimado) total
    from pedidos_compra pc join fornecedores f on f.id = pc.fornecedor_id left join pedido_compra_itens pi on pi.pedido_id = pc.id
    where pc.empresa_id = ${empresaId} and pc.semana between ${segundaDaSemana(de)} and ${ate}
    group by pc.id, f.nome order by pc.semana desc, f.nome`;
}

/** Um clique: gera um pedido por fornecedor com tudo o que falta comprar no período. */
export async function gerarPedidosSemana(tx: Tx, usuario: UsuarioAutenticado, empresaId: string, inicio: string, fim: string) {
  await tx`select pg_advisory_xact_lock(hashtext(${`pieggi.compras:${empresaId}`}))`;
  const visao = await visaoSemanal(tx, empresaId, inicio, fim);
  const criados: string[] = [];
  for (const f of visao.fornecedores) {
    const linhas = f.linhas.filter((l) => l.quantidade > 0);
    if (!f.fornecedorId || !linhas.length) continue;
    const [pedido] = await tx<{ id: string }[]>`insert into pedidos_compra (empresa_id, fornecedor_id, semana, criado_por) values (${empresaId}, ${f.fornecedorId}, ${visao.semana}, ${usuario.id}) returning id`;
    await tx`insert into pedido_compra_itens ${tx(linhas.map((l) => ({
      pedido_id: pedido!.id, insumo_id: l.insumoId, descricao: l.descricao, quantidade: l.quantidade, unidade: l.unidade,
      embalagens: l.embalagens, embalagem: l.embalagem, preco_estimado: l.precoEstimado, eventos: l.eventos
    })) as never)}`;
    const demandas = linhas.flatMap((l) => l.demandaIds);
    if (demandas.length) await tx`update compra_demandas set pedido_id = ${pedido!.id} where id in ${tx(demandas)}`;
    await auditar(tx, usuario, { acao: "COMPRAS_PEDIDO_GERADO", entidade: "pedido_compra", entidadeId: pedido!.id, empresaId, dados: { fornecedor: f.fornecedor, inicio, fim, linhas: linhas.length } });
    criados.push(pedido!.id);
  }
  return { pedidos: criados, semFornecedor: visao.fornecedores.filter((f) => !f.fornecedorId).flatMap((f) => f.linhas.map((l) => l.descricao)) };
}

const TRANSICOES: Record<string, readonly string[]> = { ABERTO: ["ENVIADO", "RECEBIDO", "CANCELADO"], ENVIADO: ["RECEBIDO", "CANCELADO"], RECEBIDO: [], CANCELADO: [] };

export async function mudarStatusPedido(tx: Tx, usuario: UsuarioAutenticado, empresaId: string, id: string, status: "ENVIADO" | "RECEBIDO" | "CANCELADO") {
  const [p] = await tx<{ status: string }[]>`select status from pedidos_compra where id = ${id} and empresa_id = ${empresaId} for update`;
  if (!p) throw new ErroOperacao("Pedido não encontrado.", 404);
  if (!TRANSICOES[p.status]?.includes(status)) throw new ErroOperacao(`Pedido ${p.status.toLowerCase()} não pode ir para ${status.toLowerCase()}.`, 409);
  await tx`update pedidos_compra set status = ${status}, atualizado_em = now() where id = ${id}`;
  // Cancelado: itens comprados prontos voltam para a lista da semana.
  if (status === "CANCELADO") await tx`update compra_demandas set pedido_id = null where pedido_id = ${id}`;
  await auditar(tx, usuario, { acao: "COMPRAS_PEDIDO_STATUS", entidade: "pedido_compra", entidadeId: id, empresaId, dados: { antes: p.status, depois: status } });
}

export async function dadosPedido(db: Db, empresaId: string, id: string) {
  const [p] = await db<{ fornecedor: string; semana: string; status: string; prazo_pagamento_dias: number }[]>`
    select f.nome fornecedor, pc.semana::text semana, pc.status, f.prazo_pagamento_dias from pedidos_compra pc join fornecedores f on f.id = pc.fornecedor_id where pc.id = ${id} and pc.empresa_id = ${empresaId}`;
  if (!p) throw new ErroOperacao("Pedido não encontrado.", 404);
  const itens = await db<{ descricao: string; quantidade: number; unidade: string; embalagens: number | null; embalagem: string; preco_estimado: number | null; eventos: string[] }[]>`
    select descricao, quantidade, unidade, embalagens, embalagem, preco_estimado, eventos from pedido_compra_itens where pedido_id = ${id} order by descricao`;
  const colunas = ["Item", "Quantidade", "Unidade", "Embalagens", "Embalagem", "Valor estimado (R$)", "Eventos"];
  const linhas = itens.map((i) => [i.descricao, arred(i.quantidade, 3), i.unidade, i.embalagens, i.embalagem, i.preco_estimado, i.eventos.join(", ")]);
  const total = arred(itens.reduce((s, i) => s + (i.preco_estimado ?? 0), 0), 2);
  const semana = p.semana.split("-").reverse().join("/");
  return { titulo: `Pedido de compra — ${p.fornecedor} — semana de ${semana}`, nome: `pedido-${codigoFornecedor(p.fornecedor).toLowerCase()}-${p.semana}`, colunas, linhas, totais: ["Total", null, null, null, null, total, null] };
}

/** Reprocessa itens pendentes (ficha cadastrada depois da aprovação) das programações do período. */
export async function reprocessarPendencias(tx: Tx, usuario: UsuarioAutenticado, empresaId: string, inicio: string, fim: string) {
  const pendentes = await tx<{ id: string; programacao_id: string; item_indice: number }[]>`
    delete from compra_demandas d using programacoes p where p.id = d.programacao_id and d.empresa_id = ${empresaId} and d.pendencia is not null and d.cancelada_em is null
      and p.status = 'APROVADA' and (p.saida_em at time zone 'America/Sao_Paulo')::date between ${inicio} and ${fim}
    returning d.id, d.programacao_id, d.item_indice`;
  const porProgramacao = new Map<string, Set<number>>();
  for (const d of pendentes) porProgramacao.set(d.programacao_id, (porProgramacao.get(d.programacao_id) ?? new Set()).add(d.item_indice));
  for (const [id, indices] of porProgramacao) {
    const [p] = await tx<ProgramacaoLinha[]>`select id, evento_id, empresa_id, itens from programacoes where id = ${id}`;
    await gerarDemandas(tx, p!, indices);
  }
  await auditar(tx, usuario, { acao: "COMPRAS_PENDENCIAS_REPROCESSADAS", entidade: "compras", entidadeId: empresaId, empresaId, dados: { inicio, fim, itens: pendentes.length } });
  const [{ restantes }] = await tx<[{ restantes: number }]>`select count(*)::int restantes from compra_demandas where empresa_id = ${empresaId} and pendencia is not null and cancelada_em is null
    and programacao_id in ${tx([...porProgramacao.keys(), "00000000-0000-0000-0000-000000000000"])}`;
  return { reprocessados: pendentes.length, restantes };
}

// ---------------------------------------------------------------- Cadastros

export interface InsumoEntrada {
  id?: string; nome: string; marca: string; setor: string; unidade: string; unidadeCompra: string; fatorCompra: number;
  estoqueMinimo: number; perecivel: boolean; rendimentoChave: string | null; ativo: boolean;
}

export async function salvarInsumo(tx: Tx, usuario: UsuarioAutenticado, empresaId: string, d: InsumoEntrada) {
  const valores = { nome: d.nome, marca: d.marca, setor: d.setor, unidade: d.unidade, unidade_compra: d.unidadeCompra, fator_compra: d.fatorCompra, estoque_minimo: d.estoqueMinimo, perecivel: d.perecivel, rendimento_chave: d.rendimentoChave, ativo: d.ativo };
  let id = d.id;
  if (id) {
    const [antes] = await tx`select * from insumos where id = ${id} and empresa_id = ${empresaId} for update`;
    if (!antes) throw new ErroOperacao("Insumo não encontrado.", 404);
    if (antes.unidade !== d.unidade) {
      const [mov] = await tx`select 1 from estoque_movimentos where insumo_id = ${id} limit 1`;
      if (mov) throw new ErroOperacao("Insumo com estoque movimentado não muda de unidade de uso.", 409);
    }
    await tx`update insumos set ${tx(valores)} where id = ${id}`;
    await auditar(tx, usuario, { acao: "INSUMO_ALTERADO", entidade: "insumo", entidadeId: id, empresaId, dados: { antes, depois: valores } });
  } else {
    [{ id }] = await tx<[{ id: string }]>`insert into insumos ${tx({ ...valores, empresa_id: empresaId })} returning id`;
    await auditar(tx, usuario, { acao: "INSUMO_CRIADO", entidade: "insumo", entidadeId: id, empresaId, dados: valores });
  }
  return { id: id };
}

export interface FornecedorEntrada { id?: string; nome: string; contato: string; codigo: string | null; categorias: string[]; prazoPagamentoDias: number; pedidoMinimo: number; ativo: boolean }

export async function salvarFornecedor(tx: Tx, usuario: UsuarioAutenticado, empresaId: string, d: FornecedorEntrada) {
  const valores = { nome: d.nome, contato: d.contato, codigo: d.codigo, categorias: d.categorias, prazo_pagamento_dias: d.prazoPagamentoDias, pedido_minimo: d.pedidoMinimo, ativo: d.ativo };
  let id = d.id;
  if (id) {
    const [antes] = await tx`update fornecedores set ${tx(valores)} where id = ${id} and empresa_id = ${empresaId} returning id`;
    if (!antes) throw new ErroOperacao("Fornecedor não encontrado.", 404);
  } else [{ id }] = await tx<[{ id: string }]>`insert into fornecedores ${tx({ ...valores, empresa_id: empresaId })} returning id`;
  await auditar(tx, usuario, { acao: d.id ? "FORNECEDOR_ALTERADO" : "FORNECEDOR_CRIADO", entidade: "fornecedor", entidadeId: id, empresaId, dados: valores });
  return { id: id };
}

/** Cotação de um fornecedor: embalagem informada em qualquer unidade da mesma grandeza; guarda na unidade do insumo. */
export async function salvarCotacao(tx: Tx, usuario: UsuarioAutenticado, empresaId: string, d: { insumoId: string; fornecedorId: string; embalagem: string; quantidadeEmbalagem: number; unidadeEmbalagem: string; preco: number; preferido: boolean }) {
  const i = await travarInsumo(tx, empresaId, d.insumoId);
  const [f] = await tx`select 1 from fornecedores where id = ${d.fornecedorId} and empresa_id = ${empresaId}`;
  if (!f) throw new ErroOperacao("Fornecedor não encontrado.", 404);
  const quantidade = converter(d.quantidadeEmbalagem, d.unidadeEmbalagem, i.unidade);
  if (!quantidade) throw new ErroOperacao(`Embalagem em ${d.unidadeEmbalagem} não converte para ${i.unidade} (unidade de ${i.nome}).`, 422);
  if (d.preferido) await tx`update insumo_fornecedores set preferido = false where insumo_id = ${i.id}`;
  await tx`insert into insumo_fornecedores (empresa_id, insumo_id, fornecedor_id, embalagem, quantidade_embalagem, preco, preferido)
    values (${empresaId}, ${i.id}, ${d.fornecedorId}, ${d.embalagem}, ${quantidade}, ${d.preco}, ${d.preferido})
    on conflict (insumo_id, fornecedor_id) do update set embalagem = excluded.embalagem, quantidade_embalagem = excluded.quantidade_embalagem, preco = excluded.preco, preferido = excluded.preferido, atualizado_em = now()`;
  await tx`insert into insumo_precos (empresa_id, insumo_id, fornecedor_id, preco_unitario, origem, usuario_id) values (${empresaId}, ${i.id}, ${d.fornecedorId}, ${arred(d.preco / quantidade)}, 'COTACAO', ${usuario.id})`;
  await auditar(tx, usuario, { acao: "COTACAO_REGISTRADA", entidade: "insumo", entidadeId: i.id, empresaId, dados: d });
  await recalcularCustosCardapio(tx, [i.id]);
}

/** Substitui a ficha técnica de um item do cardápio. Todas as linhas na mesma unidade do item. */
export async function salvarFicha(tx: Tx, usuario: UsuarioAutenticado, empresaId: string, itemId: string, linhas: ReadonlyArray<{ insumoId: string; unidadeItem: string; quantidade: number; rendimento: number | null }>) {
  const [item] = await tx`select id from cardapio_itens where id = ${itemId} for update`;
  if (!item) throw new ErroOperacao("Item do cardápio não encontrado.", 404);
  if (new Set(linhas.map((l) => l.unidadeItem)).size > 1) throw new ErroOperacao("Use a mesma unidade do item em todas as linhas da ficha.", 422);
  if (new Set(linhas.map((l) => l.insumoId)).size !== linhas.length) throw new ErroOperacao("Insumo repetido na ficha.", 422);
  if (linhas.length) {
    const [{ n }] = await tx<[{ n: number }]>`select count(*)::int n from insumos where empresa_id = ${empresaId} and id in ${tx(linhas.map((l) => l.insumoId))}`;
    if (n !== linhas.length) throw new ErroOperacao("Insumo não encontrado.", 404);
  }
  const antes = await tx`delete from fichas_tecnicas where cardapio_item_id = ${itemId} returning insumo_id, unidade_item, quantidade, rendimento`;
  if (linhas.length) await tx`insert into fichas_tecnicas ${tx(linhas.map((l) => ({ cardapio_item_id: itemId, insumo_id: l.insumoId, unidade_item: l.unidadeItem, quantidade: l.quantidade, rendimento: l.rendimento, atualizado_por: usuario.id })) as never)}`;
  await auditar(tx, usuario, { acao: "FICHA_TECNICA_ALTERADA", entidade: "cardapio_item", entidadeId: itemId, empresaId, dados: { antes: [...antes], depois: linhas } });
  if (linhas.length) await recalcularCustosCardapio(tx, [linhas[0]!.insumoId]);
}

/** Comercial reprecificou o item: o custo atual passa a ser a referência do aviso de CMV. */
export async function atualizarReferenciaCmv(tx: Tx, usuario: UsuarioAutenticado, itemId: string) {
  const [c] = await tx<{ custo: number }[]>`select custo from cardapio_custos where item_id = ${itemId} and custo > 0`;
  if (!c) throw new ErroOperacao("Item sem custo calculado.", 404);
  await tx`insert into cardapio_custo_referencia (item_id, custo, definido_por) values (${itemId}, ${c.custo}, ${usuario.id})
    on conflict (item_id) do update set custo = excluded.custo, definido_por = excluded.definido_por, definido_em = now()`;
  await auditar(tx, usuario, { acao: "CMV_REFERENCIA_ATUALIZADA", entidade: "cardapio_item", entidadeId: itemId, dados: { custo: c.custo } });
}

export async function fichasTecnicas(db: Db, empresaId: string) {
  const [itens, linhas, semFicha] = await Promise.all([
    db<{ id: string; nome: string; grupo: string; unidade: string; fornecedor: string | null; custo: number | null }[]>`
      select c.id, c.nome, c.grupo, c.unidade, c.fornecedor, k.custo from cardapio_itens c left join cardapio_custos k on k.item_id = c.id where c.ativo order by c.grupo, c.nome`,
    db<{ cardapio_item_id: string; insumo_id: string; unidade_item: string; quantidade: number; rendimento: number | null }[]>`
      select f.cardapio_item_id, f.insumo_id, f.unidade_item, f.quantidade, f.rendimento from fichas_tecnicas f join insumos i on i.id = f.insumo_id
      where f.cardapio_item_id is not null and i.empresa_id = ${empresaId}`,
    itensSemFichaTecnica(db)
  ]);
  const motivo = new Map(semFicha.map((s) => [s.id, s.motivo]));
  return itens.map((i) => ({ ...i, pendencia: motivo.get(i.id) ?? null, linhas: linhas.filter((l) => l.cardapio_item_id === i.id) }));
}

// ---------------------------------------------------------------- Painel de estoque e sugestões

export async function painelEstoque(db: Db, empresaId: string, comFinanceiro: boolean) {
  // Parâmetros vêm do cache de regras: o CMV já entra na mesma rodada de consultas.
  const p = await parametros(db);
  const [insumos, lotes, precos, semFicha, eventos, cmv] = await Promise.all([
    listarInsumos(db, empresaId),
    db<{ id: string; insumo_id: string; nome: string; lote: string; validade: string | null; saldo: number }[]>`
      select l.id, l.insumo_id, i.nome, l.lote, l.validade::text validade, l.saldo from estoque_lotes l join insumos i on i.id = l.insumo_id
      where l.empresa_id = ${empresaId} and l.saldo > 0 order by l.validade nulls last`,
    db<{ insumo_id: string; nome: string; precos: number[] }[]>`
      select p.insumo_id, i.nome, (array_agg(p.preco_unitario order by p.registrado_em desc))[1:2] precos
      from insumo_precos p join insumos i on i.id = p.insumo_id where p.empresa_id = ${empresaId} and p.origem = 'NOTA' group by p.insumo_id, i.nome`,
    itensSemFichaTecnica(db),
    db<{ id: string; titulo: string; data_evento: string | null }[]>`select id, titulo, data_evento::text data_evento from eventos where empresa_id = ${empresaId}
      and etapa_operacao in ('EXPEDICAO','EM_CAMPO','ENTREGUE') order by data_evento desc nulls last limit 30`,
    comFinanceiro ? cmvItens(db, p.cmvDivisor) : Promise.resolve([])
  ]);
  const alertas = calcularAlertas({
    hoje: hoje(), diasValidade: p.diasValidade, variacaoPreco: p.variacaoPreco, cmvAlerta: p.cmvAlerta,
    insumos: insumos.filter((i) => i.ativo).map((i) => ({ id: i.id, nome: i.nome, unidade: i.unidade, saldo: i.saldo, estoqueMinimo: i.estoque_minimo })),
    lotes: lotes.map((l) => ({ insumoId: l.insumo_id, nome: l.nome, lote: l.lote, validade: l.validade, saldo: l.saldo })),
    precos: precos.map((x) => ({ insumoId: x.insumo_id, nome: x.nome, precos: x.precos })),
    semFicha, cmv
  });
  return { insumos, lotes, alertas, eventos };
}

export async function sugerir(db: Db, empresaId: string, fornecedorId: string | null, texto: string) {
  const [insumos, apelidos] = await Promise.all([
    db<{ id: string; nome: string; unidade: string; fator_compra: number }[]>`select id, nome, unidade, fator_compra from insumos where empresa_id = ${empresaId} and ativo`,
    fornecedorId ? db<{ insumo_id: string; apelido: string }[]>`select insumo_id, apelido from apelidos_fornecedor where fornecedor_id = ${fornecedorId} and empresa_id = ${empresaId}` : Promise.resolve([])
  ]);
  const porId = new Map(insumos.map((i) => [i.id, i]));
  const candidatos = insumos.map((i) => ({ id: i.id, nome: i.nome, apelidos: apelidos.filter((a) => a.insumo_id === i.id).map((a) => a.apelido) }));
  return sugerirInsumos(texto, candidatos).map((s) => ({ ...s, unidade: porId.get(s.id)!.unidade, fator: porId.get(s.id)!.fator_compra }));
}

