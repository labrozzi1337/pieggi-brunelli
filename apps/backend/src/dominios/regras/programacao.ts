// Programação: explode o cardápio vendido em quantidades por serviço e período.
// Cada linha de serviço é um pacote de PAPÉIS (regra "pacote"); cada papel tem um algoritmo aqui e números nas regras.
// Determinístico: mesma entrada → mesma sugestão. O usuário sobrescreve qualquer escolha (itens, quantidade, bebidas).
import { z } from "zod";
import type {
  CabecalhoEvento, ItemCatalogo, ItemProgramacao, Periodo, Programacao, Selo, SeloExtra, ServicoProgramacao, Unidade
} from "@/dominios/documentos/tipos";
import {
  acrescimoReposicao, dividir, kg, Leitor, limpar, paxDeCalculo, quantidadesAlmoco, teto, verificarListaNegra,
  type EntradaAlmoco, type LinhaServico, type Regra, type Trava
} from "./motor";
import { contemTermo, diagnostico, Dicionario, formatarNumero, registro, type Diagnostico, type ItemClassificado } from "./cardapio";
import { normalizar } from "./classificacao";

// ---------------------------------------------------------------- Entrada

export interface EscolhaItem {
  catalogoId?: string;          // item do cardápio, ou…
  nome?: string;                // …texto livre (vai como está para a RECEITA)
  item?: string;                // rótulo da coluna ITEM para texto livre
  sabor?: string;
  slot?: number;                // itens com o mesmo slot dividem a quantidade (variedades A/B)
  quantidade?: number;          // sobrescrita manual (ex.: coffee "com reforço")
  unidade?: Unidade;
  autorizado?: boolean;         // item da lista negra pedido explicitamente pelo cliente
  selosExtras?: SeloExtra[];
  observacao?: string;
}

export interface RestricaoServico { receita: string; item?: string; quantidade: number; unidade?: Unidade; selo?: Selo | null; selosExtras?: SeloExtra[] }

export interface ServicoVendido {
  id?: string; data: string; linha: LinhaServico; tier: string; periodo: Periodo;
  horarioInicio: string; horarioFim: string; pax: number; nome?: string;
  reposicao?: boolean;                 // padrão: pela duração (regra reposicao.faixas)
  itens?: EscolhaItem[];               // ausente (ou papel sem item) → o motor sugere
  cardapioVendido?: EscolhaItem[];     // cardápio travado (WTC): só aumenta quantidade
  trocas?: Record<string, string>;     // item sugerido (catalogoId) → item escolhido no lugar, mesma posição e quantidade
  bebidas?: string[];                  // sobrescreve bebidas.padrao (nomes de bebidas.cadastro)
  restricoes?: RestricaoServico[];     // linhas inline no serviço
  cortesia?: boolean; periodos?: number;              // auditório
  variantePreco?: string;                             // preço com variantes (coquetel: SEM_CERVEJA / LATA / LONG_NECK)
  tabua?: string;                                     // chave de qtd.tabua.* (padrão: tier)
  almoco?: Omit<EntradaAlmoco, "data" | "cliente" | "pax">;
}

export interface EntradaEvento { cabecalho: CabecalhoEvento; regioes?: string[]; servicos: ServicoVendido[] }
export type ResultadoProgramacao = Programacao & Diagnostico;

// ---------------------------------------------------------------- Schemas das regras

const num = z.number().nonnegative();
const textos = z.array(z.string());
const papeis = ["MINI_LANCHE", "MINI_LANCHE_VEG", "PAO_DE_QUEIJO", "ADICIONAIS", "CUPCAKE", "SALADA_FRUTAS", "BEBIDAS", "PETIT_FOUR", "VERRINE",
  "TABUAS", "LIVRE", "KIT", "AUDITORIO", "ALMOCO", "FRUTAS_LAMINADAS"] as const;
type Papel = (typeof papeis)[number];
const restricaoPeriodo = z.array(z.object({ termos: textos.optional(), grupos: textos.optional(), rotulos: textos.optional(), periodos: textos }));
const bebidaPadrao = z.array(z.object({ nome: z.string(), ml: z.union([num, registro(num)]).optional(), un: num.optional(), regra: z.string().optional(), aPartirDoTier: z.string().optional(), rodizio: z.boolean().optional() }));
const bebidaCadastro = registro(z.object({ rotulo: z.string(), termica: z.string().optional(), ml: num.optional(), un: num.optional(), baseHoras: num.optional(), compradoPronto: z.boolean().optional() }));
const tabuaSchema = z.object({ frios: z.object({ gPorPax: num, partes: registro(num) }).optional(), queijos: z.object({ gPorPax: num, partes: registro(num) }).optional() });

// ---------------------------------------------------------------- Montagem de linha

interface Contexto {
  leitor: Leitor; dic: Dicionario; s: ServicoVendido; cliente?: string; horas: number; rep: number; comReposicao: boolean;
  diaIdx: number; usadas: Set<string>; avisos: string[]; bloqueios: Trava[]; catalogo: ItemCatalogo[];
}

interface Linha { c: ItemClassificado; receita: string; quantidade: number; unidade: Unidade; quantidadeTexto?: string; escolha?: EscolhaItem; bebida?: boolean; estacaoFixa?: ItemProgramacao["estacao"]; restricao?: boolean; semCard?: boolean; compradoPronto?: boolean }

const lista = <T>(x: T | undefined): T[] => (x === undefined ? [] : [x]);
const periodoChave = (p: Periodo) => (p === "TARDE" ? "TARDE" : "MANHA");
const horasEntre = (inicio: string, fim: string) => {
  const m = (h: string) => { const [a, b] = h.split(":").map(Number); return (a ?? 0) * 60 + (b ?? 0); };
  return Math.max(0, (m(fim) - m(inicio)) / 60);
};
const capitalizar = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** RECEITA de item do catálogo: nome oficial, com o rótulo à frente quando o nome não o traz, + recipiente. */
function receitaDe(ctx: Contexto, c: ItemClassificado) {
  const categoria = ctx.dic.categorias.find((x) => x.rotulo === c.rotulo);
  const temRotulo = !!categoria?.receitaSemRotulo || [c.rotulo, ...(categoria?.prefixos ?? [])].some((p) => normalizar(c.nome).startsWith(normalizar(p)));
  const base = temRotulo || !c.catalogo ? c.nome : `${c.rotulo}${c.conector ? ` ${c.conector}` : ""} ${c.nome}`;
  const recipientes = ctx.leitor.ler("recipientes", z.array(z.object({ termos: textos, texto: z.string() })), {}, false) ?? [];
  const recipiente = recipientes.find((r) => contemTermo(base, r.termos) && !normalizar(base).includes(normalizar(r.texto)));
  return recipiente ? `${base} ${recipiente.texto}` : base;
}

/** Tier do cardápio que o serviço pode usar (sugestao.tier_catalogo; padrão: o tier contratado). */
const tierCatalogo = (ctx: Contexto) => ctx.leitor.ler("sugestao.tier_catalogo", registro(z.string()), {}, false)?.[ctx.s.tier] ?? ctx.s.tier;

function resolverEscolha(ctx: Contexto, e: EscolhaItem): ItemClassificado | undefined {
  if (e.catalogoId) {
    const item = ctx.catalogo.find((i) => i.id === e.catalogoId);
    if (!item) { ctx.avisos.push(`Item ${e.catalogoId} não está no cardápio — ignorado.`); return undefined; }
    if (!ctx.dic.tierPermitido(item.tier, tierCatalogo(ctx))) {
      ctx.bloqueios.push({ codigo: "TIER", mensagem: `${item.nome} é ${item.tier}, acima do ${ctx.s.tier} contratado. Sinalize ao comercial antes de gerar documento.`, autoriza: "COMERCIAL" });
    }
    return ctx.dic.doCatalogo(item);
  }
  if (!e.nome) return undefined;
  const c = ctx.dic.classificar(e.nome);
  return { ...c, rotulo: e.item ?? c.rotulo, sabor: e.sabor ?? c.sabor };
}

function linhaDeEscolha(ctx: Contexto, e: EscolhaItem, quantidade: number, unidade: Unidade = "UN"): Linha | undefined {
  const c = resolverEscolha(ctx, e);
  if (!c) return undefined;
  return { c, receita: e.catalogoId ? receitaDe(ctx, c) : e.nome!, quantidade: e.quantidade ?? quantidade, unidade: e.unidade ?? unidade, escolha: e };
}

// ---------------------------------------------------------------- Sugestão

interface Filtro { rotulos?: string[]; grupos?: string[]; tipo?: string; selo?: (s: Selo | null) => boolean; papel: string; excluirBases?: Set<string> }

/** Candidatos do catálogo em ordem estável: tier contratado primeiro, depois os de baixo; nome. */
function candidatos(ctx: Contexto, f: Filtro): ItemClassificado[] {
  const periodo = periodoChave(ctx.s.periodo);
  const restricoes = ctx.leitor.ler("sugestao.restricao_periodo", restricaoPeriodo, {}, false) ?? [];
  const excluidos = ctx.leitor.ler("sugestao.excluir_por_tier", registro(textos), {}, false)?.[ctx.s.tier] ?? [];
  const rank = (t: string) => ctx.dic.tiers.indexOf(t);
  return ctx.catalogo
    .filter((i) => i.ativo && ctx.dic.tierPermitido(i.tier, tierCatalogo(ctx)) && !excluidos.includes(i.categoria))
    .map((i) => ctx.dic.doCatalogo(i))
    .filter((c) => (!f.rotulos || f.rotulos.includes(c.rotulo)) && (!f.grupos || f.grupos.includes(c.catalogo!.categoria))
      && (!f.tipo || c.tipo === f.tipo) && (!f.selo || f.selo(c.selo)))
    .filter((c) => restricoes.every((r) => r.periodos.includes(periodo)
      || !((r.termos && contemTermo(c.nome, r.termos)) || r.grupos?.includes(c.catalogo!.categoria) || r.rotulos?.includes(c.rotulo))))
    .filter((c) => verificarListaNegra(ctx.leitor, [`${c.rotulo} ${c.nome}`], "PROPOSTA").length === 0)
    .sort((a, b) => rank(b.catalogo!.tier) - rank(a.catalogo!.tier) || a.nome.localeCompare(b.nome, "pt-BR"));
}

function chaveBase(c: ItemClassificado, papel: string) {
  return papel === "CUPCAKE" ? `cupcake:${normalizar(c.nome)}` : c.base;
}

/** Escolhe n itens sem repetir base já usada no evento; esgotou → repete o primeiro e avisa. */
function escolher(ctx: Contexto, lista: ItemClassificado[], n: number, papel: string, rotuloAviso: string, ignorar?: string): ItemClassificado[] {
  const repetir = (ctx.leitor.ler("sugestao.repetir_permitido", textos, {}, false) ?? []).includes(papel);
  const escolhidos: ItemClassificado[] = [];
  for (const c of lista) {
    if (escolhidos.length === n) break;
    const base = chaveBase(c, papel);
    if (escolhidos.some((e) => chaveBase(e, papel) === base) || (!repetir && base !== ignorar && ctx.usadas.has(base))) continue;
    escolhidos.push(c);
  }
  if (escolhidos.length < n && lista.length) {
    ctx.avisos.push(`${rotuloAviso}: opções sem repetir base esgotadas em ${ctx.s.data} — sabor repetido; revise.`);
    for (const c of lista) { if (escolhidos.length === n) break; if (!escolhidos.includes(c)) escolhidos.push(c); }
  }
  if (!lista.length) ctx.avisos.push(`${rotuloAviso}: nenhum item do cardápio disponível para ${ctx.s.linha} ${ctx.s.tier}.`);
  if (!repetir) escolhidos.forEach((c) => ctx.usadas.add(chaveBase(c, papel)));
  return escolhidos.map((c) => trocar(ctx, c));
}

/** Troca pedida pelo usuário sobre a sugestão: o item novo ocupa a posição (e a quantidade) do sugerido. */
function trocar(ctx: Contexto, c: ItemClassificado): ItemClassificado {
  const id = c.catalogo && ctx.s.trocas?.[c.catalogo.id];
  return (id && resolverEscolha(ctx, { catalogoId: id })) || c;
}

/** Itens escolhidos pelo usuário para um papel (pelo rótulo → pacote.papel_por_rotulo). */
function escolhasDoPapel(ctx: Contexto, papel: Papel, pacote: readonly Papel[]): EscolhaItem[] {
  const porRotulo = ctx.leitor.ler("pacote.papel_por_rotulo", registro(z.string()), {}, false) ?? {};
  const fallback: Papel | undefined = pacote.includes("ADICIONAIS") ? "ADICIONAIS" : pacote.includes("LIVRE") ? "LIVRE" : undefined;
  return (ctx.s.itens ?? []).filter((e) => {
    const c = resolverEscolha({ ...ctx, avisos: [], bloqueios: [] }, e);
    if (!c) return papel === fallback;
    const p = porRotulo[c.rotulo] as Papel | undefined;
    const destino = p && pacote.includes(p) ? p : c.tipo === "BEBIDA" ? "BEBIDAS" : fallback;
    return destino === papel;
  });
}

/** Itens com o mesmo slot dividem a quantidade; sem slot, cada item é um slot. */
function porSlot(escolhas: EscolhaItem[]) {
  const grupos = new Map<string, EscolhaItem[]>();
  escolhas.forEach((e, i) => { const k = e.slot !== undefined ? `s${e.slot}` : `i${i}`; grupos.set(k, [...(grupos.get(k) ?? []), e]); });
  return [...grupos.values()];
}

// ---------------------------------------------------------------- Papéis

function miniLanche(ctx: Contexto, escolhas: EscolhaItem[]): Linha[] {
  const { leitor, s } = ctx;
  const fator = leitor.ler(`qtd.coffee.fator.${s.tier}`, z.number().positive()) ?? 0;
  const total = teto(s.pax * fator * ctx.rep);
  const veg = teto(total * (leitor.ler("qtd.mini_lanche.vegetariano", z.number().min(0).max(1)) ?? 0));
  const paxPorSabor = leitor.ler("qtd.mini_lanche.pax_por_sabor", z.number().positive()) ?? Number.POSITIVE_INFINITY;
  const sabores = Math.floor((s.pax - 1) / paxPorSabor) + 1;
  const pao = leitor.ler("mini_lanche.pao", z.object({ CARNE: z.string(), VEGETARIANO: z.string() }));
  const ehVeg = (selo: Selo | null) => selo !== null;
  const grupo = (vegetariano: boolean, quantidade: number): Linha[] => {
    const proprias = escolhas.filter((e) => { const c = resolverEscolha({ ...ctx, avisos: [], bloqueios: [] }, e); return c && ehVeg(c.selo) === vegetariano; });
    const itens = proprias.length
      ? proprias.flatMap((e) => resolverEscolha(ctx, e) ?? []).map((c, i) => ({ c, e: proprias[i] }))
      : escolher(ctx, candidatos(ctx, { rotulos: ["Mini lanche"], selo: (x) => ehVeg(x) === vegetariano, papel: vegetariano ? "MINI_LANCHE_VEG" : "MINI_LANCHE" }),
        sabores, vegetariano ? "MINI_LANCHE_VEG" : "MINI_LANCHE", vegetariano ? "Mini lanche vegetariano" : "Mini lanche").map((c) => ({ c, e: undefined }));
    const partes = dividir(quantidade, Math.max(itens.length, 1));
    return itens.map(({ c, e }, i) => {
      const nome = e?.nome ?? receitaDe(ctx, c);
      const comPao = pao && !e?.nome ? `${nome} — ${vegetariano ? pao.VEGETARIANO : pao.CARNE}` : nome;
      return { c, receita: comPao, quantidade: e?.quantidade ?? partes[i] ?? 0, unidade: "UN" as const, escolha: e };
    });
  };
  return [...grupo(false, total - veg), ...grupo(true, veg)];
}

function porPax(ctx: Contexto, escolhas: EscolhaItem[]): Linha[] {
  const mapa = ctx.leitor.ler("qtd.pao_de_queijo.por_pax", registro(num), { linha: ctx.s.linha }) ?? {};
  const entradas = Object.entries(mapa);
  if (escolhas.length && escolhas.length !== entradas.length) ctx.avisos.push(`${ctx.s.data} ${ctx.s.linha}: ${escolhas.length} pães de queijo escolhidos para ${entradas.length} proporções da regra.`);
  return entradas.flatMap(([nome, fator], i) => {
    const quantidade = teto(ctx.s.pax * fator * ctx.rep);
    const e = escolhas[i];
    if (e) return lista(linhaDeEscolha(ctx, e, quantidade));
    return [{ c: ctx.dic.classificar(nome), receita: nome, quantidade, unidade: "UN" as const }];
  });
}

function adicionais(ctx: Contexto, escolhas: EscolhaItem[], fatorRegra = "qtd.adicional.fator", aplicaRep = true): Linha[] {
  const { leitor, s } = ctx;
  const fator = leitor.ler(fatorRegra, z.number().positive()) ?? 0;
  const total = teto(s.pax * fator * (aplicaRep ? ctx.rep : 1));
  if (escolhas.length) {
    return porSlot(escolhas).flatMap((slot) => {
      const partes = dividir(total, slot.length);
      return slot.flatMap((e, i) => lista(linhaDeEscolha(ctx, e, partes[i] ?? 0)));
    });
  }
  if (fatorRegra !== "qtd.adicional.fator") return sugerirLivre(ctx, total);
  const n = leitor.ler("qtd.adicionais", registro(num))?.[s.tier] ?? 0;
  const porPeriodo = leitor.ler("composicao.adicionais_periodo", registro(registro(textos)))?.[s.tier]?.[periodoChave(s.periodo)] ?? [];
  const grupos = leitor.ler("sugestao.categorias_adicionais", textos) ?? [];
  const naoDividir = leitor.ler("qtd.adicional.nao_dividir", textos) ?? [];
  const dividirAPartir = leitor.ler("qtd.adicional.dividir_a_partir_pax", z.number().positive()) ?? Number.POSITIVE_INFINITY;
  const segundaVegana = leitor.ler("qtd.adicional.segunda_variedade_vegana", z.boolean()) ?? false;
  const gruposUsados = new Set<string>();
  const linhas: Linha[] = [];
  for (let i = 0; i < n; i++) {
    const tipo = porPeriodo[Math.min(i, porPeriodo.length - 1)];
    const todos = candidatos(ctx, { grupos, tipo, papel: "ADICIONAIS" });
    // Preferência: grupo ainda não usado no serviço e, se vai dividir, com 2 variedades de base inédita.
    const livresPorGrupo = new Map<string, number>();
    todos.filter((c) => !ctx.usadas.has(c.base)).forEach((c) => livresPorGrupo.set(c.catalogo!.categoria, (livresPorGrupo.get(c.catalogo!.categoria) ?? 0) + 1));
    const nota = (c: ItemClassificado) => (gruposUsados.has(c.catalogo!.categoria) ? 2 : 0)
      + (s.pax >= dividirAPartir && !naoDividir.includes(c.rotulo) && (livresPorGrupo.get(c.catalogo!.categoria) ?? 0) < 2 ? 1 : 0);
    const lista = todos.map((c, k) => [c, k] as const).sort((a, b) => nota(a[0]) - nota(b[0]) || a[1] - b[1]).map(([c]) => c);
    const [primeiro] = escolher(ctx, lista, 1, "ADICIONAIS", `Adicional ${i + 1} (${tipo ?? "?"})`);
    if (!primeiro) continue;
    gruposUsados.add(primeiro.catalogo!.categoria);
    let itens = [primeiro];
    if (s.pax >= dividirAPartir && !naoDividir.includes(primeiro.rotulo)) {
      const mesmos = lista.filter((c) => c !== primeiro && c.catalogo!.categoria === primeiro.catalogo!.categoria);
      const preferidos = segundaVegana ? [...mesmos.filter((c) => c.selo === "VEGANO"), ...todos.filter((c) => c.selo === "VEGANO" && c !== primeiro)] : mesmos;
      if (segundaVegana && !preferidos.length) ctx.avisos.push(`Adicional ${i + 1}: sem variedade vegana no cardápio — segunda variedade não vegana.`);
      const [segundo] = escolher(ctx, preferidos.length ? preferidos : mesmos, 1, "ADICIONAIS", `Adicional ${i + 1} variedade B`, primeiro.base);
      if (segundo) itens = [primeiro, segundo];
    }
    const partes = dividir(total, itens.length);
    itens.forEach((c, k) => linhas.push({ c, receita: receitaDe(ctx, c), quantidade: partes[k] ?? 0, unidade: "UN" }));
  }
  return linhas;
}

const quantidadeLivre = z.object({ minimo: num.optional(), porPax: num.optional(), aPartirDePax: num.optional(), unidade: z.enum(["UN", "KG"]).optional() });
const pacoteLivreSchema = registro(z.array(z.object({
  grupos: textos.optional(), rotulos: textos.optional(), termos: textos.optional(), tipo: z.string().optional(), n: z.number().int().positive(), quantidade: quantidadeLivre.optional()
})));

/** Linha montada por escolha (coquetel, brunch…) sem item escolhido: sugere a composição do tier (regra sugestao.pacote_livre). */
function sugerirLivre(ctx: Contexto, totalPadrao: number): Linha[] {
  const { s } = ctx;
  const regra = ctx.leitor.ler("sugestao.pacote_livre", pacoteLivreSchema, {}, false) ?? {};
  const entradas = regra[s.tier] ?? regra["*"];
  if (!entradas?.length) { ctx.avisos.push(`${s.data} ${s.linha}: nenhum item escolhido — o cardápio desta linha é montado pelo comercial.`); return []; }
  return entradas.flatMap((e, k) => {
    const lista = candidatos(ctx, { grupos: e.grupos, rotulos: e.rotulos, tipo: e.tipo, papel: "LIVRE" }).filter((c) => !e.termos || contemTermo(c.nome, e.termos));
    const q = e.quantidade;
    const unidade: Unidade = q?.unidade ?? "UN";
    const bruto = q ? (q.minimo ?? 0) + (q.porPax ?? 0) * Math.max(0, s.pax - (q.aPartirDePax ?? 0)) : totalPadrao;
    const quantidade = unidade === "KG" ? kg(bruto) : teto(bruto);
    return escolher(ctx, lista, e.n, "LIVRE", `Sugestão ${k + 1} (${[...(e.termos ?? []), ...(e.grupos ?? []), ...(e.rotulos ?? [])].join("/")})`)
      .map((c): Linha => ({ c, receita: receitaDe(ctx, c), quantidade, unidade, quantidadeTexto: unidade === "KG" ? `${formatarNumero(quantidade)} kg` : undefined }));
  });
}

function cupcake(ctx: Contexto, escolhas: EscolhaItem[]): Linha[] {
  const { leitor, s } = ctx;
  const total = teto(s.pax * (leitor.ler("qtd.cupcake.fator", z.number().positive()) ?? 0) * ctx.rep);
  const split = s.tier === "MASTER" ? leitor.ler("qtd.cupcake.split_master", registro(num)) : undefined;
  const chocolate = leitor.ler("cupcake.termos_chocolate", textos) ?? [];
  const ehChocolate = (c: ItemClassificado) => contemTermo(c.nome, chocolate);
  const qtdCupcake = split ? teto(total * (split["Cup cake"] ?? 0)) : total;
  const linhas: Linha[] = [];
  const doUsuario = escolhas.flatMap((e) => { const c = resolverEscolha(ctx, e); return c ? [{ c, e }] : []; });
  const cupcakesUsuario = doUsuario.filter((x) => x.c.rotulo === "Cup cake");
  let sabores: Array<{ c: ItemClassificado; e?: EscolhaItem }>;
  if (cupcakesUsuario.length) {
    sabores = cupcakesUsuario;
    if (sabores.filter((x) => ehChocolate(x.c)).length > 1) ctx.avisos.push(`${s.data} ${s.periodo}: dois cup cakes com chocolate no mesmo período.`);
  } else {
    const todos = candidatos(ctx, { rotulos: ["Cup cake"], papel: "CUPCAKE" });
    const semChoc = todos.filter((c) => !ehChocolate(c));
    const comChoc = todos.filter(ehChocolate);
    const livres = (l: ItemClassificado[]) => l.filter((c) => !ctx.usadas.has(chaveBase(c, "CUPCAKE")));
    if (!livres(semChoc).length) ctx.avisos.push(`Cup cake: as opções sem chocolate (${semChoc.map((c) => c.sabor).join(", ")}) acabaram em ${s.data} — evento longo; revise os sabores.`);
    const [choc] = escolher(ctx, livres(comChoc).length ? comChoc : semChoc, 1, "CUPCAKE", "Cup cake");
    const [outro] = escolher(ctx, semChoc.filter((c) => c !== choc), 1, "CUPCAKE", "Cup cake sem chocolate");
    sabores = [choc, outro].flatMap((c) => (c ? [{ c }] : []));
  }
  const partes = dividir(qtdCupcake, Math.max(sabores.length, 1));
  sabores.forEach(({ c, e }, i) => linhas.push({ c, receita: e?.nome ?? receitaDe(ctx, c), quantidade: e?.quantidade ?? partes[i] ?? 0, unidade: "UN", escolha: e }));
  for (const [rotulo, parte] of Object.entries(split ?? {}).filter(([r]) => r !== "Cup cake")) {
    const e = doUsuario.find((x) => x.c.rotulo === rotulo);
    const c = e?.c ?? candidatos(ctx, { rotulos: [rotulo], papel: "CUPCAKE" })[0];
    if (!c) { ctx.avisos.push(`${rotulo}: não está no cardápio.`); continue; }
    linhas.push({ c, receita: e?.e.nome ?? receitaDe(ctx, c), quantidade: e?.e.quantidade ?? teto(total * parte), unidade: "UN", escolha: e?.e });
  }
  return linhas;
}

function saladaFrutas(ctx: Contexto, escolhas: EscolhaItem[]): Linha[] {
  const ml = ctx.leitor.ler("qtd.salada_frutas.ml_por_pax", z.number().positive()) ?? 0;
  const rep = ctx.comReposicao && ctx.leitor.ler("qtd.salada_frutas.aplica_reposicao", z.boolean()) ? ctx.rep : 1;
  const litros = limpar(ctx.s.pax * ml * rep / 1000);
  const [e] = escolhas;
  if (e) return lista(linhaDeEscolha(ctx, e, litros, "L"));
  const c = candidatos(ctx, { rotulos: ["Salada de frutas"], papel: "SALADA_FRUTAS" })[0] ?? ctx.dic.classificar("Salada de frutas");
  return [{ c, receita: c.catalogo ? receitaDe(ctx, c) : c.nome, quantidade: litros, unidade: "L", quantidadeTexto: `${formatarNumero(litros)} L (${formatarNumero(ml)} ml × ${ctx.s.pax} pax)` }];
}

function bebidas(ctx: Contexto, escolhas: EscolhaItem[], datas: string[], fixa?: z.infer<typeof bebidaPadrao>): Linha[] {
  const { leitor, s } = ctx;
  const cadastro = leitor.ler("bebidas.cadastro", bebidaCadastro) ?? {};
  const escolhidas: z.infer<typeof bebidaPadrao> | undefined = s.bebidas?.map((nome) => ({ nome }));
  const padrao = fixa ?? escolhidas ?? leitor.ler("bebidas.padrao", bebidaPadrao) ?? [];
  const termicas = leitor.ler("qtd.garrafa_termica.litros", registro(num)) ?? {};
  const marcas = leitor.ler("bebidas.marcas", registro(z.string()), {}, false) ?? {};
  const rep = ctx.comReposicao && leitor.ler("qtd.bebidas.aplica_reposicao", z.boolean()) ? ctx.rep : 1;
  const tierOk = (t?: string) => !t || ctx.dic.tierPermitido(t, s.tier);
  const linhas: Linha[] = [];
  for (const b of padrao.filter((x) => tierOk(x.aPartirDoTier))) {
    const cad = cadastro[b.nome];
    if (!cad) ctx.avisos.push(`Bebida "${b.nome}" sem cadastro (bebidas.cadastro) — quantidade não calculada.`);
    const mlRegra = b.regra ? leitor.ler(b.regra, z.number().positive()) : undefined;
    const ml = typeof b.ml === "number" ? b.ml : b.ml ? b.ml[s.tier] ?? b.ml["*"] : mlRegra ?? (b.un === undefined ? cad?.ml : undefined);
    const un = ml === undefined ? b.un ?? cad?.un : undefined;
    let sabor: string | null = null;
    let receita = marcas[b.nome] ?? b.nome;
    if (cad?.rotulo === "Suco") {
      const rodizio = leitor.ler("bebidas.suco_rodizio_tarde", textos) ?? [];
      sabor = (b.rodizio && s.periodo === "TARDE" && datas.length > 1 ? rodizio[ctx.diaIdx % rodizio.length] : undefined) ?? leitor.ler("bebidas.suco_manha", z.string()) ?? null;
      receita = sabor ? `Suco de ${sabor.toLowerCase()}` : receita;
    }
    const c = { ...ctx.dic.classificar(receita), rotulo: cad?.rotulo ?? ctx.dic.classificar(receita).rotulo, sabor, tipo: "BEBIDA" as const };
    if (ml !== undefined) {
      const litros = limpar(s.pax * ml * rep / 1000);
      const porGarrafa = cad?.termica ? termicas[cad.termica] : undefined;
      const garrafas = porGarrafa ? teto(litros / porGarrafa) : undefined;
      linhas.push({ c, receita, quantidade: litros, unidade: "L", bebida: true, compradoPronto: cad?.compradoPronto,
        quantidadeTexto: `${formatarNumero(litros)} L${garrafas ? ` · ${garrafas} garrafa${garrafas > 1 ? "s" : ""} térmica${garrafas > 1 ? "s" : ""}` : ""}` });
    } else if (un !== undefined && un > 0) {
      const fatorHoras = cad?.baseHoras ? Math.max(1, ctx.horas / cad.baseHoras) : 1;
      linhas.push({ c, receita, quantidade: teto(s.pax * un * fatorHoras), unidade: "UN", bebida: true, compradoPronto: cad?.compradoPronto });
    }
  }
  for (const e of escolhas) linhas.push(...lista(linhaDeEscolha(ctx, e, 0)).map((l) => ({ ...l, bebida: true })));
  const extra = fixa ? 0 : leitor.ler("qtd.refresqueira_agua_extra", z.number().int().min(0), {}, false) ?? 0;
  if (extra > 0) linhas.push({ c: { ...ctx.dic.classificar("Refresqueira de água extra"), rotulo: "Água" }, receita: "Refresqueira de água extra", quantidade: extra, unidade: "UN", bebida: true });
  if (s.linha === "COFFEE_BREAK") {
    const dupla = leitor.ler("bebidas.dupla_rotulos", textos) ?? [];
    const faltam = dupla.filter((r) => !linhas.some((l) => l.c.rotulo === r));
    if (faltam.length) ctx.bloqueios.push({ codigo: "DUPLA_BEBIDAS", mensagem: `${dupla.join(" + ")} são dupla indivisível no coffee break. Falta: ${faltam.join(", ")}. Escale à diretoria com justificativa de CMV.`, autoriza: "DIRETORIA" });
  }
  return linhas;
}

function auditorio(ctx: Contexto): Linha[] {
  const { leitor, s } = ctx;
  const regra = leitor.ler("qtd.auditorio", z.object({ CONTRATADO: z.object({ cafeMl: num, aguaSemGas: num, aguaComGas: num }), CORTESIA: z.object({ cafeMl: num, aguaRefresqueiraMl: num }) }));
  if (!regra) return [];
  const nPeriodos = Math.max(1, s.periodos ?? teto(ctx.horas / (leitor.ler("auditorio.horas_por_periodo", z.number().positive()) ?? Number.POSITIVE_INFINITY)));
  const lista = s.cortesia
    ? [{ nome: "Café", ml: regra.CORTESIA.cafeMl * nPeriodos }, { nome: "Água na refresqueira", ml: regra.CORTESIA.aguaRefresqueiraMl * nPeriodos }]
    : [{ nome: "Café", ml: regra.CONTRATADO.cafeMl * nPeriodos }, { nome: "Água sem gás", un: regra.CONTRATADO.aguaSemGas * nPeriodos }, { nome: "Água com gás", un: regra.CONTRATADO.aguaComGas * nPeriodos }];
  return bebidas(ctx, [], [], lista);
}

function petitFour(ctx: Contexto, escolhas: EscolhaItem[], comPaoDeQueijo: boolean): Linha[] {
  const { leitor, s } = ctx;
  const regra = leitor.ler("qtd.welcome.petit_four", z.object({ salgadoPorPax: num, doces: z.number().int(), docePorPax: num, docePorPaxComPaoDeQueijo: num }));
  const sabores = leitor.ler("sabores.petit_four", z.object({ SALGADO: textos, DOCE: textos }));
  if (!regra || !sabores) return [];
  const doce = comPaoDeQueijo ? regra.docePorPaxComPaoDeQueijo : regra.docePorPax;
  const ehSalgado = (sabor: string) => sabores.SALGADO.some((x) => normalizar(x) === normalizar(sabor));
  const item = (sabor: string, salgado: boolean, e?: EscolhaItem): Linha => ({
    c: { ...ctx.dic.classificar(`Petit four ${sabor}`), rotulo: "Petit four", sabor: capitalizar(sabor), tipo: salgado ? "SALGADO" : "DOCE" },
    receita: e?.nome ?? `Petit four ${salgado ? "salgado" : "doce"} — ${sabor.toLowerCase()}`, unidade: "UN",
    quantidade: e?.quantidade ?? teto(s.pax * (salgado ? regra.salgadoPorPax : doce)), escolha: e
  });
  if (escolhas.length) {
    const linhas = escolhas.map((e) => { const sabor = e.sabor ?? (e.nome ?? "").replace(/^petit four( salgado| doce)?\s*[—-]?\s*/i, ""); return item(sabor, ehSalgado(sabor), e); });
    if (linhas.filter((l) => l.c.tipo === "SALGADO").length > 1) ctx.avisos.push(`${s.data} Welcome: nunca 2 petit fours salgados no Welcome.`);
    return linhas;
  }
  const pick = (lista: string[], n: number) => {
    const livres = lista.filter((x) => !ctx.usadas.has(`petit:${normalizar(x)}`));
    const escolhidos = [...livres, ...lista].filter((x, i, a) => a.indexOf(x) === i).slice(0, n);
    escolhidos.forEach((x) => ctx.usadas.add(`petit:${normalizar(x)}`));
    return escolhidos;
  };
  return [...pick(sabores.SALGADO, 1).map((x) => item(x, true)), ...pick(sabores.DOCE, regra.doces).map((x) => item(x, false))];
}

function verrine(ctx: Contexto, escolhas: EscolhaItem[]): Linha[] {
  const regra = ctx.leitor.ler("qtd.verrine", z.object({ porPax: num, sabores: z.number().int().positive(), sugerirLinhas: textos }));
  if (!regra) return [];
  const total = teto(ctx.s.pax * regra.porPax);
  if (escolhas.length) {
    const partes = dividir(total, escolhas.length);
    return escolhas.flatMap((e, i) => lista(linhaDeEscolha(ctx, e, partes[i] ?? 0)));
  }
  if (!regra.sugerirLinhas.includes(ctx.s.linha)) return [];
  const itens = escolher(ctx, candidatos(ctx, { rotulos: ["Verrine"], tipo: "DOCE", papel: "VERRINE" }), regra.sabores, "VERRINE", "Verrine");
  const partes = dividir(total, Math.max(itens.length, 1));
  return itens.map((c, i) => ({ c, receita: receitaDe(ctx, c), quantidade: partes[i] ?? 0, unidade: "UN" }));
}

function tabuas(ctx: Contexto, estado: { frutasTabua: boolean }): Linha[] {
  const { leitor, s, dic } = ctx;
  const chaves = s.tabua ? [s.tabua] : dic.tiers.slice(0, dic.tiers.indexOf(s.tier) + 1).reverse();
  let regra: z.infer<typeof tabuaSchema> | undefined;
  for (const k of chaves) { regra = leitor.ler(`qtd.tabua.${k}`, tabuaSchema, {}, false); if (regra) break; }
  if (!regra) { ctx.avisos.push(`Tábuas: sem composição para ${s.tabua ?? s.tier}.`); return []; }
  const dezena = leitor.ler("qtd.tabua.arredondar_g", z.number().positive()) ?? 1;
  const linhas: Linha[] = [];
  for (const [rotulo, t] of [["Tábua de frios", regra.frios], ["Tábua de queijos", regra.queijos]] as const) {
    if (!t) continue;
    const partes = Object.entries(t.partes).map(([nome, p]) => [nome, teto(s.pax * t.gPorPax * p / dezena) * dezena] as const);
    const totalG = partes.reduce((a, [, g]) => a + g, 0);
    const nomes = partes.map(([n]) => n);
    const sabor = nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}` : nomes[0] ?? null;
    linhas.push({ c: { ...dic.classificar(rotulo), rotulo, sabor }, receita: `${rotulo} — ${partes.map(([n, g]) => `${n.toLowerCase()} ${g} g`).join(" · ")}`,
      quantidade: kg(totalG / 1000), unidade: "KG", quantidadeTexto: `${partes.map(([n, g]) => `${n} ${g} g`).join(" · ")} = ${formatarNumero(kg(totalG / 1000))} kg` });
  }
  const frutas = leitor.ler("qtd.tabua.frutas", textos) ?? [];
  if (frutas.length && !estado.frutasTabua) {
    estado.frutasTabua = true;
    linhas.push({ c: { ...dic.classificar("Frutas da tábua"), rotulo: "Frutas da tábua", sabor: null }, receita: `Frutas da tábua (só enfeite): ${frutas.join(" · ")}`, quantidade: 1, unidade: "UN", semCard: true });
  }
  return linhas;
}

function kit(ctx: Contexto, escolhas: EscolhaItem[]): Linha[] {
  const kitRegra = ctx.leitor.ler("qtd.lunch_box.kit", registro(z.array(z.object({ rotulo: z.string(), receita: z.string(), bebida: z.boolean().optional() }))));
  const componentes = kitRegra?.[ctx.s.tier] ?? kitRegra?.["*"] ?? [];
  const usadas = new Set<EscolhaItem>();
  return componentes.map((comp) => {
    const e = escolhas.find((x) => !usadas.has(x) && resolverEscolha({ ...ctx, avisos: [], bloqueios: [] }, x)?.rotulo === comp.rotulo);
    if (e) { usadas.add(e); return linhaDeEscolha(ctx, e, ctx.s.pax)!; }
    if (/escolher/i.test(comp.receita)) ctx.avisos.push(`Lunch Box ${ctx.s.data}: ${comp.rotulo} sem sabor escolhido.`);
    return { c: { ...ctx.dic.classificar(comp.receita), rotulo: comp.rotulo }, receita: comp.receita, quantidade: ctx.s.pax, unidade: "UN" as const, bebida: comp.bebida };
  });
}

function almoco(ctx: Contexto, regras: readonly Regra[]): Linha[] {
  const { s } = ctx;
  if (!s.almoco) { ctx.avisos.push(`${s.linha} ${s.data}: cardápio do buffet não informado.`); return []; }
  const r = quantidadesAlmoco(regras, { ...s.almoco, data: s.data, cliente: ctx.cliente, pax: s.pax });
  ctx.avisos.push(...r.avisos);
  ctx.bloqueios.push(...r.bloqueios);
  const papelDe = new Map<string, string>();
  const a = s.almoco;
  a.proteinas.forEach((p) => papelDe.set(p.nome, "PROTEINA"));
  a.acompanhamentos.forEach((p) => papelDe.set(p.nome, "ACOMPANHAMENTO"));
  if (a.massa) papelDe.set(a.massa.nome, "MASSA");
  if (a.vegetariano) papelDe.set(a.vegetariano.nome, "VEGETARIANO");
  if (a.folhas) papelDe.set(a.folhas.nome, "FOLHAS");
  if (a.saladaComposta) papelDe.set(a.saladaComposta.nome, "SALADA_COMPOSTA");
  if (a.vegetais) papelDe.set(a.vegetais.nome, "VEGETAIS");
  a.sobremesas.forEach((p) => papelDe.set(p.nome, "SOBREMESA"));
  const config = ctx.leitor.ler("programacao.almoco", registro(z.object({ rotulo: z.string(), estacao: z.string() }))) ?? {};
  return r.linhas.map((l) => {
    const papel = l.item.startsWith("Molho — ") ? "MOLHO" : papelDe.get(l.item) ?? "PROTEINA";
    const cfg = config[papel];
    const c = { ...ctx.dic.classificar(l.item), rotulo: cfg?.rotulo ?? papel, sabor: l.item };
    const texto = `${formatarNumero(l.quantidade)} kg`;
    return { c, receita: l.item, quantidade: l.quantidade, unidade: "KG" as const, quantidadeTexto: papel === "SOBREMESA" ? l.detalhe : texto,
      estacaoFixa: cfg?.estacao as ItemProgramacao["estacao"], semCard: papel === "MOLHO" };
  });
}

function frutasLaminadas(ctx: Contexto): Linha[] {
  const regra = ctx.leitor.ler("qtd.frutas_laminadas", z.object({ gPorPax: num, tiers: textos }));
  if (!regra?.tiers.includes(ctx.s.tier)) return [];
  const pax = paxDeCalculo(ctx.leitor, ctx.s.pax);
  const quilos = kg(pax * regra.gPorPax / 1000);
  return [{ c: ctx.dic.classificar("Frutas laminadas"), receita: "Frutas laminadas", quantidade: quilos, unidade: "KG", quantidadeTexto: `${pax} pax × ${regra.gPorPax} g = ${formatarNumero(quilos)} kg` }];
}

// ---------------------------------------------------------------- Serviço → itens

function itemProgramacao(ctx: Contexto, l: Linha): ItemProgramacao | undefined {
  const receita = ctx.dic.limpar(l.receita);
  const negra = verificarListaNegra(ctx.leitor, [`${l.c.rotulo} ${receita}`]);
  if (negra.length) {
    if (!l.escolha?.autorizado) { ctx.avisos.push(...negra.map((t) => `Lista negra — pulado: ${t.mensagem}`)); return undefined; }
    ctx.avisos.push(...negra.map((t) => `Lista negra autorizada pelo cliente: ${t.mensagem}`));
  }
  const rota = ctx.dic.rota(l.c, receita, ctx.s.linha);
  const estacao = l.estacaoFixa ?? rota.estacao;
  const [en, es] = [l.c.catalogo?.nomeEn ?? ctx.dic.traduzir(l.c.sabor)?.[0] ?? null, l.c.catalogo?.nomeEs ?? ctx.dic.traduzir(l.c.sabor)?.[1] ?? null];
  return {
    quantidade: l.quantidade, unidade: l.unidade, quantidadeTexto: l.quantidadeTexto, receita, item: l.c.rotulo,
    cardapioItemId: l.c.catalogo?.id ?? null, sabor: l.c.sabor, selo: l.c.selo, selosExtras: l.escolha?.selosExtras,
    nomeEn: en, nomeEs: es, estacao, fornecedor: rota.fornecedor, compradoPronto: l.compradoPronto ?? rota.compradoPronto,
    quente: estacao === "COZINHA_QUENTE", bebida: l.bebida ?? l.c.tipo === "BEBIDA", restricao: l.restricao,
    chaveDedup: l.semCard ? undefined : normalizar(`${l.c.rotulo}|${l.c.sabor ?? receita}`), observacao: l.escolha?.observacao ?? null
  };
}

function verificarTravado(ctx: Contexto) {
  const { s } = ctx;
  const travado = ctx.leitor.ler("cardapio.travado", z.boolean());
  if (travado && Object.keys(s.trocas ?? {}).length) ctx.bloqueios.push({ codigo: "CARDAPIO_TRAVADO", mensagem: `Cardápio travado (${s.data} ${s.linha}): não é permitido trocar item ou sabor. Só aumentar quantidade.`, autoriza: "DIRETORIA" });
  if (!s.cardapioVendido || !travado) return;
  const chave = (e: EscolhaItem) => e.catalogoId ?? normalizar(e.nome ?? "");
  const vendido = new Map(s.cardapioVendido.map((e) => [chave(e), e]));
  const atual = s.itens ?? [];
  const trocados = [...atual.filter((e) => !vendido.has(chave(e))).map((e) => e.nome ?? e.catalogoId), ...[...vendido.keys()].filter((k) => !atual.some((e) => chave(e) === k))];
  const reduzidos = atual.filter((e) => { const v = vendido.get(chave(e)); return v?.quantidade !== undefined && (e.quantidade ?? v.quantidade) < v.quantidade; });
  if (trocados.length) ctx.bloqueios.push({ codigo: "CARDAPIO_TRAVADO", mensagem: `Cardápio travado (${s.data} ${s.linha}): não é permitido trocar item ou sabor (${trocados.join(", ")}). Só aumentar quantidade.`, autoriza: "DIRETORIA" });
  if (reduzidos.length) ctx.bloqueios.push({ codigo: "CARDAPIO_TRAVADO", mensagem: `Cardápio travado (${s.data} ${s.linha}): quantidade só pode aumentar.`, autoriza: "DIRETORIA" });
}

// ---------------------------------------------------------------- Gerador

/** Programação do evento: cabeçalho (endereço/contato fixos do cliente) + serviços com quantidades exatas. */
export function gerarProgramacao(regras: readonly Regra[], catalogo: readonly ItemCatalogo[], entrada: EntradaEvento): ResultadoProgramacao {
  const cliente = entrada.cabecalho.clienteChave ?? undefined;
  const avisos: string[] = [];
  const bloqueios: Trava[] = [];
  const leitores: Leitor[] = [];
  const usadas = new Set<string>();
  const estado = { frutasTabua: false };
  const servicos = [...entrada.servicos].sort((a, b) => a.data.localeCompare(b.data) || a.horarioInicio.localeCompare(b.horarioInicio));
  const datas = [...new Set(servicos.map((s) => s.data))];
  const base = new Leitor(regras, { data: datas[0] ?? entrada.cabecalho.datas[0] ?? "", cliente, regioes: entrada.regioes });
  leitores.push(base);
  const cabecalho: CabecalhoEvento = {
    ...entrada.cabecalho,
    endereco: entrada.cabecalho.endereco || (base.ler("endereco.fixo", z.string(), {}, false) ?? ""),
    contato: entrada.cabecalho.contato || (base.ler("contato.fixo", z.string(), {}, false) ?? ""),
    datas: entrada.cabecalho.datas.length ? entrada.cabecalho.datas : datas
  };
  if (!cabecalho.endereco) avisos.push("Endereço completo é obrigatório e não pode ser deduzido.");

  const saida: ServicoProgramacao[] = servicos.map((s, n) => {
    const leitor = new Leitor(regras, { data: s.data, cliente, regioes: entrada.regioes, linha: s.linha });
    leitores.push(leitor);
    const dic = new Dicionario(leitor);
    const horas = horasEntre(s.horarioInicio, s.horarioFim);
    const comReposicao = s.reposicao ?? acrescimoReposicao(leitor, s.linha, horas) > 0;
    const rep = comReposicao ? leitor.ler("qtd.reposicao.fator", z.number().positive()) ?? 1 : 1;
    const ctx: Contexto = { leitor, dic, s, horas, rep, comReposicao, cliente, diaIdx: datas.indexOf(s.data), usadas, avisos, bloqueios, catalogo: [...catalogo] };
    verificarTravado(ctx);
    const pacotes = leitor.ler("pacote", registro(z.array(z.enum(papeis))));
    const pacote = pacotes?.[s.tier] ?? pacotes?.["*"] ?? [];
    const de = (p: Papel) => escolhasDoPapel(ctx, p, pacote);
    const linhas: Linha[] = [];
    for (const papel of pacote) {
      if (papel === "MINI_LANCHE") linhas.push(...miniLanche(ctx, de("MINI_LANCHE")));
      else if (papel === "PAO_DE_QUEIJO") linhas.push(...porPax(ctx, de("PAO_DE_QUEIJO")));
      else if (papel === "ADICIONAIS") linhas.push(...adicionais(ctx, de("ADICIONAIS")));
      else if (papel === "LIVRE") linhas.push(...adicionais(ctx, de("LIVRE"), "qtd.item_livre.fator", s.linha !== "COQUETEL"));
      else if (papel === "CUPCAKE") linhas.push(...cupcake(ctx, de("CUPCAKE")));
      else if (papel === "SALADA_FRUTAS") linhas.push(...saladaFrutas(ctx, de("SALADA_FRUTAS")));
      else if (papel === "BEBIDAS") linhas.push(...bebidas(ctx, de("BEBIDAS"), datas));
      else if (papel === "PETIT_FOUR") linhas.push(...petitFour(ctx, de("PETIT_FOUR"), pacote.includes("PAO_DE_QUEIJO")));
      else if (papel === "VERRINE") linhas.push(...verrine(ctx, de("VERRINE")));
      else if (papel === "TABUAS") linhas.push(...tabuas(ctx, estado));
      else if (papel === "KIT") linhas.push(...kit(ctx, s.itens ?? []));
      else if (papel === "AUDITORIO") linhas.push(...auditorio(ctx));
      else if (papel === "ALMOCO") linhas.push(...almoco(ctx, regras));
      else if (papel === "FRUTAS_LAMINADAS") linhas.push(...frutasLaminadas(ctx));
    }
    for (const r of s.restricoes ?? []) {
      const c = ctx.dic.classificar(r.receita);
      linhas.push({ c: { ...c, rotulo: r.item ?? c.rotulo, selo: r.selo === undefined ? c.selo : r.selo }, receita: r.receita, quantidade: r.quantidade, unidade: r.unidade ?? "UN",
        restricao: true, escolha: { selosExtras: r.selosExtras } });
    }
    const nomes = leitor.ler("programacao.nome_servico", registro(z.string())) ?? {};
    return {
      id: s.id ?? `${s.data}-${n + 1}`, data: s.data, linha: s.linha, tier: s.tier,
      nome: s.nome ?? nomes[`${s.linha}.${s.periodo}`] ?? nomes[s.linha] ?? s.linha,
      periodo: s.periodo, horarioInicio: s.horarioInicio, horarioFim: s.horarioFim, pax: s.pax, comReposicao,
      itens: linhas.flatMap((l) => itemProgramacao(ctx, l) ?? [])
    };
  });
  const d = diagnostico(leitores, avisos, bloqueios);
  return { cabecalho, servicos: saida, ...d };
}
