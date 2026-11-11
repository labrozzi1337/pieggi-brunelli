import { z } from "zod";
import { normalizar } from "./classificacao";

// Motor de regras da Pieggi. Nenhum valor de negócio mora aqui: todo número, preço e lista vem de
// pieggi.regras_negocio, resolvido pela data do evento e pelo escopo mais específico.

export const escoposTipo = ["GLOBAL", "REGIAO", "LINHA", "CLIENTE", "ITEM"] as const;
export type EscopoTipo = (typeof escoposTipo)[number];
export type StatusRegra = "APROVADA" | "PENDENTE";
export const linhasServico = ["COFFEE_BREAK", "WELCOME", "BRUNCH", "COQUETEL", "ALMOCO", "JANTAR", "AUDITORIO", "LUNCH_BOX"] as const;
export type LinhaServico = (typeof linhasServico)[number];

export interface Regra {
  codigo: string; escopoTipo: EscopoTipo; escopoChave: string; valor: unknown;
  vigenteDesde: string; versao: number; status: StatusRegra; titulo?: string;
}
export interface Contexto { data: string; cliente?: string; regioes?: readonly string[]; linha?: string; item?: string }
export interface Trava { codigo: string; mensagem: string; autoriza: "DIRETORIA" | "COMERCIAL" }

const PRECEDENCIA: readonly EscopoTipo[] = ["ITEM", "CLIENTE", "LINHA", "REGIAO", "GLOBAL"];

function chavesDoEscopo(tipo: EscopoTipo, ctx: Contexto): readonly string[] {
  if (tipo === "GLOBAL") return [""];
  if (tipo === "REGIAO") return ctx.regioes ?? [];
  const chave = tipo === "LINHA" ? ctx.linha : tipo === "CLIENTE" ? ctx.cliente : ctx.item;
  return chave ? [chave] : [];
}

/** Regra vigente na data do evento; o escopo mais específico vence o mais genérico. */
export function resolverRegra(regras: readonly Regra[], codigo: string, ctx: Contexto): Regra | undefined {
  const candidatas = regras.filter((r) => r.codigo === codigo && r.vigenteDesde <= ctx.data);
  for (const tipo of PRECEDENCIA) {
    for (const chave of chavesDoEscopo(tipo, ctx)) {
      const [vigente] = candidatas
        .filter((r) => r.escopoTipo === tipo && r.escopoChave === chave)
        .sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde) || b.versao - a.versao);
      if (vigente) return vigente;
    }
  }
  return undefined;
}

export class Leitor {
  readonly faltando = new Set<string>();
  readonly pendentes = new Map<string, string>();
  constructor(private readonly regras: readonly Regra[], private readonly base: Contexto) {}

  ler<T>(codigo: string, schema: z.ZodType<T>, extra: Partial<Contexto> = {}, obrigatoria = true): T | undefined {
    const regra = resolverRegra(this.regras, codigo, { ...this.base, ...extra });
    if (!regra) {
      if (obrigatoria) this.faltando.add(codigo);
      return undefined;
    }
    const valor = schema.safeParse(regra.valor);
    if (!valor.success) {
      this.faltando.add(`${codigo} (valor inválido)`);
      return undefined;
    }
    if (regra.status === "PENDENTE") this.pendentes.set(codigo, regra.titulo ?? codigo);
    return valor.data;
  }

  diagnostico() {
    return { regrasFaltando: [...this.faltando], regrasPendentes: [...this.pendentes].map(([codigo, titulo]) => ({ codigo, titulo })) };
  }
}

// Ponto flutuante: 50 × 1,1 = 55,000000000000007. Limpa antes de arredondar para cima.
export const limpar = (x: number) => Math.round(x * 1e6) / 1e6;
export const teto = (x: number) => Math.ceil(limpar(x));
const gramasParaKg = (x: number) => Math.round(x) / 1000;
export const kg = (x: number) => Math.round(limpar(x) * 1000) / 1000;
export const paraCentavos = (reais: number) => Math.round(limpar(reais * 100));

const num = z.number().finite();
const positivo = z.number().positive();
const registroNum = z.record(z.string(), z.number().nonnegative());
const faixasSchema = z.array(z.object({ ateHoras: positivo, acrescimo: z.number().min(0) })).min(1);
// Preço: valor único, faixas por duração (chave = horas máximas) ou variantes (coquetel: SEM_CERVEJA / LATA / LONG_NECK).
const precoSchema = z.union([positivo, z.record(z.string(), positivo)]);
const ehFaixaDeHoras = (chaves: string[]) => chaves.every((k) => /^\d+(\.\d+)?$/.test(k));

/** Preço sugerido pela regra de CMV: custo ÷ divisor, arredondado para cima no múltiplo de R$ 0,50. */
export function precoSugerido(custo: number, divisor: number): number {
  return teto(custo / divisor / 0.5) * 0.5;
}

export type Documento = "PROPOSTA" | "PROGRAMACAO" | "COMANDA" | "PLAQUINHA";
const listaNegraSchema = z.array(z.object({ termo: z.string().min(1), motivo: z.string(), apenas: z.array(z.string()).optional() }));

/** Lista negra global: o item pula e é sinalizado. "apenas" restringe a entrada a alguns documentos (tramezzino só em proposta). */
export function verificarListaNegra(leitor: Leitor, nomes: readonly string[], documento: Documento = "PROGRAMACAO"): Trava[] {
  const lista = (leitor.ler("lista_negra", listaNegraSchema, {}, false) ?? []).filter((l) => !l.apenas || l.apenas.includes(documento));
  return nomes.flatMap((nome) => lista
    .filter(({ termo }) => normalizar(nome).includes(normalizar(termo)))
    .map(({ motivo }) => ({ codigo: "LISTA_NEGRA", mensagem: `${nome}: ${motivo}`, autoriza: "COMERCIAL" as const })));
}

export function acrescimoReposicao(leitor: Leitor, linha: string, horas: number) {
  const faixas = leitor.ler("reposicao.faixas", faixasSchema, { linha }, false);
  if (!faixas) return 0;
  const faixa = faixas.find((f) => horas <= f.ateHoras) ?? faixas[faixas.length - 1];
  return faixa?.acrescimo ?? 0;
}

// ---------------------------------------------------------------- Precificação

export interface ServicoPreco { linha: LinhaServico; tier: string; pax: number; horas: number; variante?: string }
export interface EntradaPreco {
  data: string; tabela: string; cliente?: string; regioes?: string[];
  servicos: ServicoPreco[]; descontoPercentual: number; custoEstimado?: number;
}

export function precificar(regras: readonly Regra[], entrada: EntradaPreco) {
  const leitor = new Leitor(regras, { data: entrada.data, cliente: entrada.cliente, regioes: entrada.regioes });
  const bloqueios: Trava[] = [];
  const avisos: string[] = [];
  const minimo = leitor.ler("pedido_minimo.pax", positivo) ?? 0;

  const servicos = entrada.servicos.map((s) => {
    const tetoHoras = leitor.ler("duracao.teto_horas", positivo, { linha: s.linha }, false);
    if (tetoHoras !== undefined && s.horas > tetoHoras) {
      bloqueios.push({ codigo: "DURACAO", mensagem: `${s.linha}: ${s.horas}h passa do teto de ${tetoHoras}h. Só a diretoria libera.`, autoriza: "DIRETORIA" });
    }
    const tabelaPreco = leitor.ler(`preco.${entrada.tabela}.${s.linha}.${s.tier}`, precoSchema, { linha: s.linha });
    let precoPax = 0;
    if (typeof tabelaPreco === "number") precoPax = tabelaPreco;
    else if (tabelaPreco && !ehFaixaDeHoras(Object.keys(tabelaPreco))) {
      const variante = s.variante ?? Object.keys(tabelaPreco)[0]!;
      if (tabelaPreco[variante] === undefined) bloqueios.push({ codigo: "PRECO", mensagem: `${s.linha} ${s.tier}: variante "${variante}" não existe na tabela (${Object.keys(tabelaPreco).join(", ")}).`, autoriza: "DIRETORIA" });
      precoPax = tabelaPreco[variante] ?? 0;
    } else if (tabelaPreco) {
      const faixas = Object.entries(tabelaPreco).map(([h, v]) => [Number(h), v] as const).sort((a, b) => a[0] - b[0]);
      const faixa = faixas.find(([h]) => s.horas <= h) ?? faixas[faixas.length - 1];
      if (faixa && s.horas > faixa[0]) bloqueios.push({ codigo: "DURACAO", mensagem: `${s.linha}: ${s.horas}h passa da maior faixa da tabela (${faixa[0]}h).`, autoriza: "DIRETORIA" });
      precoPax = faixa?.[1] ?? 0;
    }
    let acrescimo = acrescimoReposicao(leitor, s.linha, s.horas);
    if (acrescimo > 0) acrescimo = leitor.ler("reposicao.acrescimo_fixo", z.number().min(0), {}, false) ?? acrescimo;
    const paxCobrado = Math.max(s.pax, minimo);
    if (paxCobrado > s.pax) avisos.push(`${s.linha}: ${s.pax} pax cobra o pedido mínimo de ${minimo} pax.`);
    return { ...s, paxCobrado, precoPax, acrescimo, valorCentavos: paraCentavos(precoPax * paxCobrado * (1 + acrescimo)) };
  });

  const alimentacaoCentavos = servicos.reduce((soma, s) => soma + s.valorCentavos, 0);
  const isento = leitor.ler("isencao.logistica_e_taxa", z.boolean()) ?? false;
  const taxa = isento ? 0 : leitor.ler("taxa_servico.percentual", z.number().min(0).max(1)) ?? 0;
  const logistica = isento ? 0 : leitor.ler("logistica.valor", z.number().min(0)) ?? 0;
  const descontoCentavos = Math.round(alimentacaoCentavos * entrada.descontoPercentual);
  const taxaCentavos = Math.round(alimentacaoCentavos * taxa);
  const logisticaCentavos = paraCentavos(logistica);
  const comercial = travasComerciais(leitor, alimentacaoCentavos, descontoCentavos, entrada.custoEstimado);

  return {
    servicos, alimentacaoCentavos, descontoCentavos, taxaCentavos, logisticaCentavos, isento, cmv: comercial.cmv,
    totalCentavos: alimentacaoCentavos - descontoCentavos + taxaCentavos + logisticaCentavos,
    avisos: [...avisos, ...comercial.avisos], bloqueios: [...bloqueios, ...comercial.bloqueios], ...leitor.diagnostico()
  };
}

/** Travas de desconto e CMV: aviso a partir de cmv.aviso, bloqueio acima de cmv.bloqueio (só diretoria libera). */
export function travasComerciais(leitor: Leitor, brutoCentavos: number, descontoCentavos: number, custoEstimado?: number) {
  const bloqueios: Trava[] = [];
  const avisos: string[] = [];
  const percentual = brutoCentavos > 0 ? descontoCentavos / brutoCentavos : 0;
  const descontoMaximo = leitor.ler("desconto.maximo_sem_diretoria", z.number().min(0).max(1)) ?? 0;
  if (percentual > descontoMaximo + 1e-9) {
    bloqueios.push({ codigo: "DESCONTO", mensagem: `Desconto de ${(percentual * 100).toFixed(1)}% passa do limite de ${(descontoMaximo * 100).toFixed(1)}%.`, autoriza: "DIRETORIA" });
  }
  const liquidoCentavos = brutoCentavos - descontoCentavos;
  let cmv: number | undefined;
  if (custoEstimado !== undefined && liquidoCentavos > 0) {
    cmv = paraCentavos(custoEstimado) / liquidoCentavos;
    const aviso = leitor.ler("cmv.aviso", num) ?? 0;
    const bloqueio = leitor.ler("cmv.bloqueio", num) ?? 1;
    if (cmv > bloqueio) bloqueios.push({ codigo: "CMV", mensagem: `CMV de ${(cmv * 100).toFixed(1)}% passa do bloqueio de ${(bloqueio * 100).toFixed(1)}%. Só a diretoria libera, com justificativa.`, autoriza: "DIRETORIA" });
    else if (cmv >= aviso) avisos.push(`CMV de ${(cmv * 100).toFixed(1)}% acima do alvo (aviso a partir de ${(aviso * 100).toFixed(1)}%).`);
  }
  return { bloqueios, avisos, cmv };
}

// ---------------------------------------------------------------- Quantidades

export interface LinhaQuantidade { item: string; quantidade: number; unidade: "UN" | "L" | "KG" | "GARRAFA"; compraKg?: number; detalhe?: string }

function dividirMeio(total: number) {
  return [Math.ceil(total / 2), Math.floor(total / 2)] as const;
}

/** Divide o total em n partes inteiras; as primeiras levam a sobra (55 em 2 = 28 + 27). */
export function dividir(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => base + (i < total - base * n ? 1 : 0));
}

export interface EntradaCoffee { data: string; cliente?: string; tier: string; pax: number; horas: number; bebidas: string[] }

export function quantidadesCoffee(regras: readonly Regra[], e: EntradaCoffee) {
  const linha = "COFFEE_BREAK";
  const leitor = new Leitor(regras, { data: e.data, cliente: e.cliente, linha });
  const linhas: LinhaQuantidade[] = [];
  const bloqueios: Trava[] = [];
  const comReposicao = acrescimoReposicao(leitor, linha, e.horas) > 0;
  const rep = comReposicao ? leitor.ler("qtd.reposicao.fator", positivo) ?? 1 : 1;

  const fator = leitor.ler(`qtd.coffee.fator.${e.tier}`, positivo) ?? 0;
  const lanches = teto(e.pax * fator * rep);
  const parteVegetariana = leitor.ler("qtd.mini_lanche.vegetariano", z.number().min(0).max(1)) ?? 0;
  const paxPorSabor = leitor.ler("qtd.mini_lanche.pax_por_sabor", positivo) ?? Number.POSITIVE_INFINITY;
  const vegetarianos = teto(lanches * parteVegetariana);
  const sabores = Math.floor((e.pax - 1) / paxPorSabor) + 1;
  const textoSabores = `${sabores} sabor${sabores > 1 ? "es" : ""}`;
  linhas.push({ item: "Mini lanche de proteína animal — Brioche", quantidade: lanches - vegetarianos, unidade: "UN", detalhe: textoSabores },
    { item: "Mini lanche vegetariano — Brioche de cenoura", quantidade: vegetarianos, unidade: "UN", detalhe: textoSabores });

  for (const [item, porPax] of Object.entries(leitor.ler("qtd.pao_de_queijo.por_pax", registroNum) ?? {})) {
    linhas.push({ item, quantidade: teto(e.pax * porPax * rep), unidade: "UN" });
  }

  const adicionais = leitor.ler("qtd.adicionais", registroNum)?.[e.tier] ?? 0;
  const fatorAdicional = leitor.ler("qtd.adicional.fator", positivo) ?? 0;
  const dividirAPartir = leitor.ler("qtd.adicional.dividir_a_partir_pax", positivo) ?? Number.POSITIVE_INFINITY;
  for (let i = 1; i <= adicionais; i++) {
    const total = teto(e.pax * fatorAdicional * rep);
    if (e.pax >= dividirAPartir) {
      const [a, b] = dividirMeio(total);
      linhas.push({ item: `Adicional ${i} — variedade A`, quantidade: a, unidade: "UN" }, { item: `Adicional ${i} — variedade B`, quantidade: b, unidade: "UN" });
    } else linhas.push({ item: `Adicional ${i}`, quantidade: total, unidade: "UN" });
  }

  const cupcakes = teto(e.pax * (leitor.ler("qtd.cupcake.fator", positivo) ?? 0) * rep);
  const splitMaster = e.tier === "MASTER" ? leitor.ler("qtd.cupcake.split_master", registroNum) : undefined;
  if (splitMaster) {
    for (const [item, parte] of Object.entries(splitMaster)) linhas.push({ item, quantidade: teto(cupcakes * parte), unidade: "UN" });
  } else {
    const [a, b] = dividirMeio(cupcakes);
    linhas.push({ item: "Cup cake — sabor 1", quantidade: a, unidade: "UN", detalhe: "Nunca dois sabores com chocolate no mesmo período" },
      { item: "Cup cake — sabor 2", quantidade: b, unidade: "UN", detalhe: "Nunca dois sabores com chocolate no mesmo período" });
  }

  const salada = leitor.ler("qtd.salada_frutas.aplica_reposicao", z.boolean()) && comReposicao ? rep : 1;
  linhas.push({ item: "Salada de frutas", quantidade: limpar(e.pax * (leitor.ler("qtd.salada_frutas.ml_por_pax", positivo) ?? 0) * salada / 1000), unidade: "L" });

  const bebidasRep = comReposicao && leitor.ler("qtd.bebidas.aplica_reposicao", z.boolean()) ? rep : 1;
  const litrosCafe = limpar(e.pax * (leitor.ler("qtd.cafe.ml_por_pax", positivo) ?? 0) * bebidasRep / 1000);
  const porGarrafa = leitor.ler("qtd.garrafa_termica.litros", registroNum)?.CAFE;
  linhas.push({ item: "Café", quantidade: litrosCafe, unidade: "L", detalhe: porGarrafa ? `${teto(litrosCafe / porGarrafa)} garrafas térmicas` : undefined });

  const dupla = leitor.ler("qtd.bebidas.dupla_obrigatoria", z.array(z.string())) ?? [];
  const faltantes = dupla.filter((b) => !e.bebidas.some((x) => normalizar(x) === normalizar(b)));
  if (faltantes.length) bloqueios.push({ codigo: "DUPLA_BEBIDAS", mensagem: `${dupla.join(" + ")} são dupla indivisível. Falta: ${faltantes.join(", ")}. Escale à diretoria com justificativa de CMV.`, autoriza: "DIRETORIA" });

  const refresqueiras = leitor.ler("qtd.refresqueira_agua_extra", z.number().int().min(0)) ?? 0;
  if (refresqueiras > 0) linhas.push({ item: "Refresqueira de água extra", quantidade: refresqueiras, unidade: "UN", detalhe: "por período de serviço" });

  return { linhas, comReposicao, bloqueios, avisos: [] as string[], ...leitor.diagnostico() };
}

export interface Componente { nome: string; insumo?: string }
export interface EntradaAlmoco {
  data: string; cliente?: string; pax: number;
  proteinas: Componente[]; acompanhamentos: Componente[]; massa?: Componente; vegetariano?: Componente;
  folhas?: Componente; saladaComposta?: Componente; vegetais?: Componente; sobremesas: Array<{ nome: string; pudim: boolean }>;
}
export type Composicao = "COMPLETO" | "INTERMEDIARIO" | "REDUZIDO";

export function composicaoAlmoco(e: Pick<EntradaAlmoco, "massa" | "vegetariano">): Composicao {
  if (e.massa && e.vegetariano) return "COMPLETO";
  return e.massa || e.vegetariano ? "INTERMEDIARIO" : "REDUZIDO";
}

export function paxDeCalculo(leitor: Leitor, pax: number) {
  const folga = leitor.ler("almoco.folga", z.object({ aCada: positivo, minimo: z.number().int().min(0) }));
  if (!folga) return pax;
  const modo = leitor.ler("almoco.folga_arredondamento", z.enum(["CIMA", "BAIXO"])) ?? "CIMA";
  const razao = limpar(pax / folga.aCada);
  return pax + Math.max(folga.minimo, modo === "CIMA" ? Math.ceil(razao) : Math.floor(razao));
}

export function quantidadesAlmoco(regras: readonly Regra[], e: EntradaAlmoco) {
  const leitor = new Leitor(regras, { data: e.data, cliente: e.cliente });
  const avisos: string[] = [];
  const linhas: LinhaQuantidade[] = [];
  const pax = paxDeCalculo(leitor, e.pax);
  const composicao = composicaoAlmoco(e);
  const porComposicao = z.object({ COMPLETO: positivo, INTERMEDIARIO: positivo, REDUZIDO: positivo });
  const gramaturas = leitor.ler("almoco.gramaturas_g", registroNum) ?? {};
  const molho = leitor.ler("almoco.molho", registroNum) ?? {};
  const rendimentos = leitor.ler("rendimento", registroNum) ?? {};

  const adicionar = (item: string, prontoKg: number, insumo?: string, detalhe?: string) => {
    const rendimento = insumo ? rendimentos[insumo] : undefined;
    if (insumo && !rendimento) avisos.push(`${item}: rendimento de ${insumo} não cadastrado — compra sem correção.`);
    linhas.push({ item, quantidade: kg(prontoKg), unidade: "KG", compraKg: rendimento ? kg(prontoKg / rendimento) : undefined, detalhe });
  };
  const porPax = (gramas: number | undefined) => gramasParaKg((gramas ?? 0) * pax);

  const proteinaG = leitor.ler("almoco.proteina_g", porComposicao)?.[composicao];
  const minimoReduzido = leitor.ler("almoco.proteina_minimo_reduzido", z.object({ atePax: positivo, kg: positivo }));
  for (const p of e.proteinas) {
    let pronto = porPax(proteinaG);
    if (composicao === "REDUZIDO" && minimoReduzido && e.pax <= minimoReduzido.atePax) pronto = Math.max(pronto, minimoReduzido.kg);
    adicionar(p.nome, pronto, p.insumo, "Peso pronto, sem molho");
    if (molho.PROTEINA) adicionar(`Molho — ${p.nome}`, pronto * molho.PROTEINA, undefined, "Linha própria; pesar separado da carne");
  }
  const acompanhamentoG = leitor.ler("almoco.acompanhamento_g", porComposicao)?.[composicao];
  for (const a of e.acompanhamentos) adicionar(a.nome, porPax(acompanhamentoG), a.insumo);
  if (e.massa) {
    const pronto = porPax(gramaturas.MASSA);
    adicionar(e.massa.nome, pronto, e.massa.insumo);
    if (molho.MASSA) adicionar(`Molho — ${e.massa.nome}`, pronto * molho.MASSA);
  }
  if (e.vegetariano) adicionar(e.vegetariano.nome, porPax(gramaturas.VEGETARIANO), e.vegetariano.insumo);
  if (e.folhas) adicionar(e.folhas.nome, porPax(gramaturas.FOLHAS), e.folhas.insumo ?? "FOLHAS");
  if (e.saladaComposta) adicionar(e.saladaComposta.nome, porPax(gramaturas.SALADA_COMPOSTA), e.saladaComposta.insumo);
  if (e.vegetais) adicionar(e.vegetais.nome, porPax(gramaturas.VEGETAIS), e.vegetais.insumo);

  const pudimEspecial = e.sobremesas.length === 2 && e.sobremesas.some((s) => s.pudim);
  for (const s of e.sobremesas) {
    const gramas = s.pudim && pudimEspecial ? gramaturas.PUDIM : gramaturas.SOBREMESA;
    const pronto = porPax(gramas);
    let detalhe = `1 travessa · ${pax} pax × ${gramas ?? 0} g = ${pronto.toLocaleString("pt-BR")} kg`;
    if (s.pudim) {
      const porForma = leitor.ler("almoco.pudim_pax_por_forma", positivo) ?? pax;
      const base = leitor.ler("almoco.pudim_base_pax", z.enum(["REAL", "CALCULO"])) === "REAL" ? e.pax : pax;
      detalhe += ` · ${teto(base / porForma)} forma(s): dividir o peso total entre as formas`;
    }
    adicionar(s.nome, pronto, undefined, detalhe);
  }

  const nomes = [...e.proteinas, ...e.acompanhamentos, e.massa, e.vegetariano, e.saladaComposta, e.vegetais, ...e.sobremesas]
    .flatMap((c) => (c ? [c.nome] : []));
  return { paxCalculo: pax, composicao, linhas, avisos, bloqueios: verificarListaNegra(leitor, nomes), ...leitor.diagnostico() };
}
