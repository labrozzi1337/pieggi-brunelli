// Cálculos puros do módulo de Compras e Estoque (especificação §9). Sem banco, sem regra fixa:
// rendimentos, percentuais e prazos chegam como parâmetro (vêm de pieggi.regras_negocio).

export const SETORES = {
  MERCEARIA: "Mercearia / secos", FRIOS_QUEIJOS: "Frios e queijos", BEBIDAS: "Bebidas", DESCARTAVEIS: "Descartáveis",
  HORTIFRUTI: "Hortifruti", EMBALAGEM: "Embalagem", PROTEINAS: "Carnes, aves e peixes", PRODUCAO_TERCEIRIZADA: "Produção terceirizada"
} as const;
export type Setor = keyof typeof SETORES;
export const setores = Object.keys(SETORES) as [Setor, ...Setor[]];

/** Roteamento de itens comprados prontos (módulo 4). */
export const FORNECEDORES_PRONTOS = ["PAD_LETICIA", "SALGADERIA_LEAL", "PADARIA_CPL", "POP_VEGAN", "MERCADO"] as const;

export const unidadesUso = ["UN", "KG", "G", "L", "ML"] as const;
export type UnidadeUso = (typeof unidadesUso)[number];
export type UnidadeBase = "KG" | "L" | "UN";

const FATORES: Record<string, { base: UnidadeBase; fator: number }> = {
  KG: { base: "KG", fator: 1 }, G: { base: "KG", fator: 0.001 }, L: { base: "L", fator: 1 }, ML: { base: "L", fator: 0.001 }, UN: { base: "UN", fator: 1 }
};

/** 6 casas: limpa o ruído de ponto flutuante (5,46 ÷ 2,3 etc.) sem perder precisão de grama. */
export const arred = (x: number, casas = 6) => Math.round(x * 10 ** casas) / 10 ** casas;

/** Converte entre unidades da mesma grandeza (G↔KG, ML↔L). Unidades iguais sempre convertem; grandezas diferentes → null. */
export function converter(quantidade: number, de: string, para: string): number | null {
  if (de === para) return quantidade;
  const a = FATORES[de], b = FATORES[para];
  if (!a || !b || a.base !== b.base) return null;
  return arred(quantidade * a.fator / b.fator, 9);
}

export const unidadeBase = (u: string): UnidadeBase | null => FATORES[u]?.base ?? null;

/** Preço por kg / L / un a partir do preço de uma embalagem com `quantidade` na `unidade`. */
export function precoNormalizado(precoEmbalagem: number, quantidade: number, unidade: string): { preco: number; base: UnidadeBase } | null {
  const base = unidadeBase(unidade);
  const q = base && converter(quantidade, unidade, base);
  return base && q ? { preco: arred(precoEmbalagem / q, 4), base } : null;
}

// ---------------------------------------------------------------- Explosão de necessidade

export interface LinhaFicha { insumoId: string; unidadeItem: string; quantidade: number; rendimento: number }
export interface Necessidade { insumoId: string; bruta: number; rendimento: number; corrigida: number }

/**
 * 1. bruta = quantidade produzida × ficha técnica; 2. corrigida = bruta ÷ rendimento (pronto por cru).
 * Devolve `erro` quando a unidade do item não converte para a unidade da ficha.
 */
export function explodirNecessidade(quantidade: number, unidade: string, ficha: readonly LinhaFicha[]): { linhas: Necessidade[]; erro?: string } {
  const linhas: Necessidade[] = [];
  for (const l of ficha) {
    const q = converter(quantidade, unidade, l.unidadeItem);
    if (q === null) return { linhas: [], erro: `Item em ${unidade}, ficha técnica em ${l.unidadeItem}.` };
    const bruta = arred(q * l.quantidade);
    linhas.push({ insumoId: l.insumoId, bruta, rendimento: l.rendimento, corrigida: arred(bruta / l.rendimento) });
  }
  return { linhas };
}

/** 3. A comprar = corrigida − estoque disponível − pedidos em aberto (nunca negativo). */
export const aComprar = (corrigida: number, estoque: number, emPedido: number) => arred(Math.max(0, corrigida - Math.max(0, estoque) - emPedido));

/** Segunda-feira da semana (ISO AAAA-MM-DD) — todos os eventos da semana viram um pedido por fornecedor. */
export function segundaDaSemana(data: string): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- Cotação

export interface Oferta {
  fornecedorId: string; fornecedor: string; preco: number; quantidadeEmbalagem: number; unidade: string;
  prazoDias: number; pedidoMinimo: number; preferido?: boolean; embalagem?: string;
}
export interface OfertaRanqueada extends Oferta { precoBase: number | null; base: UnidadeBase | null; precoAVista: number | null; atendeMinimo: boolean; posicao: number }

/**
 * Ranking da cotação: compara pelo preço na unidade padronizada (kg/L/un) trazido a valor à vista pelo
 * custo financeiro do prazo — o mais barato com prazo pior nem sempre ganha. Quem não atinge o pedido
 * mínimo com a quantidade desta compra vai para o fim. `quantidadeCompra` está na unidade padronizada.
 */
export function ranquearCotacao(ofertas: readonly Oferta[], custoFinanceiroMensal: number, quantidadeCompra = 0): OfertaRanqueada[] {
  return ofertas
    .map((o) => {
      const n = precoNormalizado(o.preco, o.quantidadeEmbalagem, o.unidade);
      const precoAVista = n ? arred(n.preco / (1 + custoFinanceiroMensal) ** (o.prazoDias / 30), 4) : null;
      const atendeMinimo = !n || quantidadeCompra <= 0 || n.preco * quantidadeCompra >= o.pedidoMinimo;
      return { ...o, precoBase: n?.preco ?? null, base: n?.base ?? null, precoAVista, atendeMinimo, posicao: 0 };
    })
    .sort((a, b) => Number(b.atendeMinimo) - Number(a.atendeMinimo) || (a.precoAVista ?? Infinity) - (b.precoAVista ?? Infinity))
    .map((o, i) => ({ ...o, posicao: i + 1 }));
}

/** Fornecedor da compra: o marcado como preferido; senão o 1º do ranking. */
export function escolherFornecedor(ofertas: readonly Oferta[], custoFinanceiroMensal: number, quantidadeCompra = 0) {
  return ofertas.find((o) => o.preferido) ?? ranquearCotacao(ofertas, custoFinanceiroMensal, quantidadeCompra)[0];
}

// ---------------------------------------------------------------- Consolidação semanal

export interface DemandaInsumo { insumoId: string; corrigida: number; evento: string }
export interface InsumoCompra {
  id: string; nome: string; unidade: string; estoque: number; emPedido: number;
  /** Unidades de uso por embalagem e preço por embalagem do fornecedor escolhido. */
  fornecedorId: string | null; embalagem: string; quantidadeEmbalagem: number; precoEmbalagem: number | null;
}
export interface DemandaPronta { fornecedorId: string | null; descricao: string; quantidade: number; unidade: string; evento: string; demandaId: string }
export interface LinhaPedido {
  insumoId: string | null; descricao: string; unidade: string; necessidade: number; estoque: number; emPedido: number;
  quantidade: number; embalagens: number | null; embalagem: string; precoEstimado: number | null; eventos: string[]; demandaIds: string[];
}

/**
 * Soma a necessidade de todos os eventos do período por insumo, desconta estoque e pedidos em aberto e
 * agrupa num pedido por fornecedor (compra dividida: cada insumo vai para o seu fornecedor). Itens comprados
 * prontos entram direto no pedido do fornecedor roteado. Sem fornecedor → chave "".
 */
export function consolidarPorFornecedor(demandas: readonly DemandaInsumo[], insumos: ReadonlyMap<string, InsumoCompra>, prontos: readonly DemandaPronta[] = []) {
  const porInsumo = new Map<string, { total: number; eventos: Set<string> }>();
  for (const d of demandas) {
    const acc = porInsumo.get(d.insumoId) ?? { total: 0, eventos: new Set<string>() };
    acc.total += d.corrigida; acc.eventos.add(d.evento);
    porInsumo.set(d.insumoId, acc);
  }
  const pedidos = new Map<string, LinhaPedido[]>();
  const add = (fornecedor: string | null, l: LinhaPedido) => pedidos.set(fornecedor ?? "", [...(pedidos.get(fornecedor ?? "") ?? []), l]);
  for (const [insumoId, { total, eventos }] of porInsumo) {
    const i = insumos.get(insumoId);
    if (!i) continue;
    const quantidade = aComprar(total, i.estoque, i.emPedido);
    const embalagens = quantidade > 0 ? Math.ceil(arred(quantidade / i.quantidadeEmbalagem)) : 0;
    add(i.fornecedorId, {
      insumoId, descricao: i.nome, unidade: i.unidade, necessidade: arred(total), estoque: i.estoque, emPedido: i.emPedido, quantidade, embalagens,
      embalagem: i.embalagem, precoEstimado: i.precoEmbalagem === null ? null : arred(embalagens * i.precoEmbalagem, 2), eventos: [...eventos].sort(), demandaIds: []
    });
  }
  const chave = (p: DemandaPronta) => `${p.fornecedorId ?? ""}|${p.descricao.trim().toLowerCase()}|${p.unidade}`;
  const agrupados = new Map<string, LinhaPedido & { fornecedorId: string | null }>();
  for (const p of prontos) {
    const g = agrupados.get(chave(p)) ?? { fornecedorId: p.fornecedorId, insumoId: null, descricao: p.descricao.trim(), unidade: p.unidade, necessidade: 0, estoque: 0, emPedido: 0, quantidade: 0, embalagens: null, embalagem: "", precoEstimado: null, eventos: [], demandaIds: [] };
    g.necessidade = arred(g.necessidade + p.quantidade); g.quantidade = g.necessidade;
    if (!g.eventos.includes(p.evento)) g.eventos.push(p.evento);
    g.demandaIds.push(p.demandaId);
    agrupados.set(chave(p), g);
  }
  for (const { fornecedorId, ...l } of agrupados.values()) add(fornecedorId, l);
  return pedidos;
}

// ---------------------------------------------------------------- Custo

/** Custo médio ponderado após uma entrada. Saldo negativo/zero não pondera (vale o custo da entrada). */
export function custoMedioPonderado(saldo: number, custoMedio: number, quantidade: number, custoUnitario: number): number {
  if (saldo <= 0 || custoMedio <= 0) return arred(custoUnitario);
  return arred((saldo * custoMedio + quantidade * custoUnitario) / (saldo + quantidade));
}

/** Custo de 1 unidade do item do cardápio pela ficha técnica: Σ quantidade ÷ rendimento × custo do insumo. null se faltar custo. */
export function custoPorFicha(linhas: ReadonlyArray<{ quantidade: number; rendimento: number; custo: number | null }>): number | null {
  if (!linhas.length || linhas.some((l) => !l.custo)) return null;
  return arred(linhas.reduce((s, l) => s + l.quantidade / l.rendimento * (l.custo ?? 0), 0), 4);
}

/** CMV estimado do item quando o custo sobe: o preço foi formado com o custo de referência ao divisor da regra cmv.divisor_preco. */
export const cmvEstimado = (custoAtual: number, custoReferencia: number, divisor: number) => custoReferencia > 0 ? arred(divisor * custoAtual / custoReferencia, 4) : null;

// ---------------------------------------------------------------- Sugestão de insumo pelo nome da nota

export const normalizarTexto = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function bigramas(t: string) {
  const s = ` ${t} `;
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1);
  return m;
}

/** Similaridade 0..1: coeficiente de Dice nos bigramas, reforçado quando as palavras do cadastro aparecem na nota. */
export function similaridade(a: string, b: string): number {
  const x = normalizarTexto(a), y = normalizarTexto(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const bx = bigramas(x), by = bigramas(y);
  let comum = 0, total = 0;
  for (const [k, n] of bx) { comum += Math.min(n, by.get(k) ?? 0); total += n; }
  for (const n of by.values()) total += n;
  const dice = (2 * comum) / total;
  const palavras = y.split(" ").filter((p) => p.length > 2);
  const cobertura = palavras.length ? palavras.filter((p) => x.split(" ").some((q) => q.startsWith(p) || p.startsWith(q))).length / palavras.length : 0;
  return arred(Math.max(dice, 0.5 * dice + 0.5 * cobertura), 3);
}

export interface Candidato { id: string; nome: string; apelidos?: readonly string[] }
/** Sugere insumos para a descrição da nota: apelido aprendido do fornecedor vence; depois os mais parecidos. */
export function sugerirInsumos(descricao: string, candidatos: readonly Candidato[], limite = 5, minimo = 0.35) {
  const alvo = normalizarTexto(descricao);
  return candidatos
    .map((c) => ({ id: c.id, nome: c.nome, apelido: c.apelidos?.includes(alvo) ?? false, score: c.apelidos?.includes(alvo) ? 1 : similaridade(descricao, c.nome) }))
    .filter((c) => c.score >= minimo)
    .sort((a, b) => Number(b.apelido) - Number(a.apelido) || b.score - a.score)
    .slice(0, limite);
}

// ---------------------------------------------------------------- Alertas

export type TipoAlerta = "ESTOQUE_MINIMO" | "VALIDADE" | "VARIACAO_PRECO" | "SEM_FICHA" | "CMV";
export interface Alerta { tipo: TipoAlerta; mensagem: string; referenciaId: string }

export interface EntradaAlertas {
  hoje: string;
  insumos: ReadonlyArray<{ id: string; nome: string; unidade: string; saldo: number; estoqueMinimo: number }>;
  lotes: ReadonlyArray<{ insumoId: string; nome: string; lote: string; validade: string | null; saldo: number }>;
  /** Preços de compra (nota) mais recentes primeiro, por insumo. */
  precos: ReadonlyArray<{ insumoId: string; nome: string; precos: number[] }>;
  semFicha: ReadonlyArray<{ id: string; nome: string; motivo: string }>;
  cmv: ReadonlyArray<{ id: string; nome: string; cmv: number }>;
  diasValidade: number; variacaoPreco: number; cmvAlerta: number;
}

const pct = (x: number) => `${(x * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const somarDias = (data: string, dias: number) => { const d = new Date(`${data}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); };

/** Alertas obrigatórios do §9. */
export function calcularAlertas(e: EntradaAlertas): Alerta[] {
  const alertas: Alerta[] = [];
  for (const i of e.insumos) {
    if (i.estoqueMinimo > 0 && i.saldo < i.estoqueMinimo) alertas.push({ tipo: "ESTOQUE_MINIMO", referenciaId: i.id, mensagem: `${i.nome}: saldo ${arred(i.saldo, 3)} ${i.unidade} abaixo do mínimo de ${i.estoqueMinimo} ${i.unidade}.` });
  }
  const limite = somarDias(e.hoje, e.diasValidade);
  for (const l of e.lotes) {
    if (l.saldo > 0 && l.validade && l.validade <= limite) alertas.push({ tipo: "VALIDADE", referenciaId: l.insumoId, mensagem: `${l.nome}${l.lote ? ` (lote ${l.lote})` : ""}: ${l.validade < e.hoje ? "vencido em" : "vence em"} ${l.validade.split("-").reverse().join("/")}.` });
  }
  for (const p of e.precos) {
    const [atual, anterior] = p.precos;
    if (atual === undefined || !anterior) continue;
    const variacao = (atual - anterior) / anterior;
    if (Math.abs(variacao) > e.variacaoPreco) alertas.push({ tipo: "VARIACAO_PRECO", referenciaId: p.insumoId, mensagem: `${p.nome}: preço ${variacao > 0 ? "subiu" : "caiu"} ${pct(Math.abs(variacao))} em relação à última compra.` });
  }
  for (const s of e.semFicha) alertas.push({ tipo: "SEM_FICHA", referenciaId: s.id, mensagem: `${s.nome}: ${s.motivo}` });
  for (const c of e.cmv) {
    if (c.cmv >= e.cmvAlerta) alertas.push({ tipo: "CMV", referenciaId: c.id, mensagem: `${c.nome}: custo médio leva o CMV estimado a ${pct(c.cmv)} (teto 33,3%). Revise o preço antes da próxima proposta.` });
  }
  return alertas;
}
