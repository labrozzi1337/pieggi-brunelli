// Fluxo guiado do evento (§2): cadastro único → sugestão do motor → proposta aprovada (descritivo vendido travado)
// → programação gerada → documentos. Toda regra vem do motor (dominios/regras); aqui só se monta entrada e se persiste.
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { PapelUsuario, UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import type { CabecalhoEvento, ItemCatalogo, Programacao } from "@/dominios/documentos/tipos";
import { Dicionario } from "@/dominios/regras/cardapio";
import { Leitor, linhasServico, precificar, verificarListaNegra, type Regra, type Trava } from "@/dominios/regras/motor";
import { gerarProgramacao, type ServicoVendido } from "@/dominios/regras/programacao";
import { gerarPropostaDoc } from "@/dominios/regras/proposta";
import { carregarRegras } from "@/dominios/regras/repositorio";
import type { Tx } from "@/integrations/banco";
import { fixosDoCliente, type FixosCliente } from "./clientes";
import {
  hojeSaoPaulo, PAPEIS_COMERCIAIS, pendenciasEvento, podeAcessar, propostasDoEvento, snapshotProposta, travarEvento, veValores,
  type Leitura, type Linha
} from "./eventos";
import { ErroOperacao } from "./http";
import { itensLegados } from "./estrutura";
import { operarEvento } from "./programacao";
import { aprovarProposta, salvarProposta, servicoVendidoSchema, type DadosProposta } from "./propostas";

export const PAPEIS_PROGRAMAR: PapelUsuario[] = ["ADMIN", "PROGRAMACAO"];

/** Problemas que impedem gerar algo: a mensagem resume, `problemas` lista um a um (409). */
export class ErroBloqueio extends ErroOperacao {
  constructor(titulo: string, readonly problemas: string[]) { super(`${titulo}: ${problemas.join(" · ")}`, 409); }
}

// ---------------------------------------------------------------- Contexto do evento

export interface ContextoEvento {
  evento: Linha & { id: string; empresa_id: string; revisao: number; titulo: string; data_evento: string | null; pax: number | null };
  cliente: Linha & { nome: string; chave_regras: string | null };
  regras: Regra[]; catalogo: ItemCatalogo[]; fixos: FixosCliente; cabecalho: CabecalhoEvento;
  tabela: string; regioes: string[]; data: string; comValores: boolean;
}

const chaveRegiao = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().trim().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
const hhmm = (h: unknown) => (typeof h === "string" ? h.slice(0, 5) : "");
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/** Cardápio como o motor o enxerga; custo só para quem vê valores. */
export async function carregarCatalogo(sql: Leitura, comCusto: boolean): Promise<ItemCatalogo[]> {
  const itens = await sql<Array<{ id: string; nome: string; grupo: string; categoria: string; tier: string; ingredientes: string; unidade: string; nome_en: string | null; nome_es: string | null; selo: ItemCatalogo["selo"]; estacao: string | null; fornecedor: string | null; ativo: boolean; custo: number | null }>>`
    select i.id, i.nome, i.grupo, i.categoria, i.tier, i.ingredientes, i.unidade, i.nome_en, i.nome_es, i.selo, i.estacao, i.fornecedor, i.ativo,
      ${comCusto ? sql`k.custo` : sql`null::numeric`} custo
    from cardapio_itens i left join cardapio_custos k on k.item_id = i.id order by i.grupo, i.nome, i.id`;
  return itens.map((i) => ({ id: i.id, nome: i.nome, grupo: i.grupo, categoria: i.categoria, tier: i.tier, ingredientes: i.ingredientes, unidade: i.unidade,
    nomeEn: i.nome_en, nomeEs: i.nome_es, selo: i.selo, estacao: i.estacao, fornecedor: i.fornecedor, ativo: i.ativo, custo: i.custo }));
}

export function enderecoDoEvento(e: Linha, fixos: FixosCliente) {
  if (fixos.endereco) return [fixos.endereco, e.complemento].filter(Boolean).join(" — ");
  const rua = [e.logradouro, e.numero_endereco].filter(Boolean).join(", ");
  const cidade = [e.cidade, e.uf].filter(Boolean).join("/");
  return [[rua, e.complemento].filter(Boolean).join(" — "), e.bairro, cidade, e.cep].filter(Boolean).join(", ");
}

/**
 * Evento + cliente + regras + cardápio. O motor roda sempre com TODAS as regras (reposição e verba são financeiras,
 * mas mudam quantidade); o que volta para a tela é filtrado por perfil em quem chama.
 */
export async function contextoDoEvento(sql: Leitura, usuario: UsuarioAutenticado, eventoId: string, papeis: readonly PapelUsuario[]): Promise<ContextoEvento> {
  const [r] = await sql<{ e: ContextoEvento["evento"]; c: ContextoEvento["cliente"] }[]>`
    select to_jsonb(e) e, to_jsonb(c) c from eventos e join clientes c on c.id = e.cliente_id where e.id = ${eventoId}`;
  if (!r) throw new ErroOperacao("Evento não encontrado.", 404);
  if (!podeAcessar(usuario, r.e.empresa_id, papeis)) throw new ErroOperacao("Perfil sem permissão para esta operação.", 403);
  const comValores = veValores(usuario);
  const [regras, catalogo] = await Promise.all([carregarRegras(sql, { papeis: ["ADMIN"] }), carregarCatalogo(sql, comValores)]);
  const data = r.e.data_evento ?? hojeSaoPaulo();
  const fixos = fixosDoCliente(regras, r.c.chave_regras, data);
  const e = r.e;
  const cabecalho: CabecalhoEvento = {
    eventoId: e.id, contratante: r.c.nome, cliente: r.c.nome, clienteChave: r.c.chave_regras, evento: e.titulo,
    contato: typeof e.contato_local_nome === "string" ? e.contato_local_nome : fixos.contato ?? "", telefoneContato: (e.contato_local_telefone as string | null) ?? null,
    pax: e.pax ?? 0, datas: e.data_evento ? [e.data_evento] : [], horarioInicio: hhmm(e.horario_inicio), horarioFim: hhmm(e.horario_fim),
    endereco: enderecoDoEvento(e, fixos), restricoes: []
  };
  const regioes = [e.bairro, e.cidade].filter((x): x is string => typeof x === "string" && !!x.trim()).map(chaveRegiao).filter(Boolean);
  return { evento: e, cliente: r.c, regras, catalogo, fixos, cabecalho, tabela: typeof e.tabela_preco === "string" ? e.tabela_preco : fixos.tabela ?? "", regioes, data, comValores };
}

// ---------------------------------------------------------------- Restrições (gate 2)

const TIPOS_RESTRICAO = { VEGANO: "vegano", VEGETARIANO: "vegetariano", SEM_GLUTEN: "sem glúten", SEM_LACTOSE: "sem lactose", SEM_ACUCAR: "sem açúcar", OUTRA: "outra restrição" } as const;
export const restricoesSchema = z.object({
  itens: z.array(z.object({ tipo: z.enum(Object.keys(TIPOS_RESTRICAO) as [keyof typeof TIPOS_RESTRICAO]), quantidade: z.number().int().positive().max(100000), descricao: z.string().trim().max(200).optional() }).strict()).max(10),
  cobranca: z.enum(["PAGO", "CORTESIA"]).optional()
}).strict();
export type Restricoes = z.infer<typeof restricoesSchema>;
const textoRestricoes = (r: Restricoes) => r.itens.map((i) => `${i.quantidade} ${i.descricao || TIPOS_RESTRICAO[i.tipo]}`);

// ---------------------------------------------------------------- Cálculo (motor) — puro

const horasEntre = (inicio: string, fim: string) => {
  const m = (h: string) => { const [a = 0, b = 0] = h.split(":").map(Number); return a * 60 + b; };
  return Math.max(0, m(fim) - m(inicio)) / 60;
};
const comIds = (servicos: readonly ServicoVendido[]) => servicos.map((s, i) => ({ ...s, id: s.id ?? `s${i + 1}` }));

/** Custo estimado (reais) dos itens do cardápio com custo cadastrado na mesma unidade; o resto entra em `semCusto`. */
export function custoEstimado(p: Programacao, catalogo: readonly ItemCatalogo[]) {
  const porId = new Map(catalogo.map((c) => [c.id, c]));
  let total = 0, algum = false;
  const semCusto = new Set<string>();
  for (const i of p.servicos.flatMap((s) => s.itens)) {
    const c = i.cardapioItemId ? porId.get(i.cardapioItemId) : undefined;
    if (!c) continue;
    if (c.custo === null || c.custo === undefined || i.unidade !== "UN" || !/^unidade$/i.test(c.unidade)) { semCusto.add(c.nome); continue; }
    total += i.quantidade * c.custo; algum = true;
  }
  return { valor: algum ? Math.round(total * 100) / 100 : undefined, semCusto: [...semCusto] };
}

export interface OpcoesCalculo { descontoPercentual?: number; restricoes?: Restricoes; validade?: string | null }

/** Programação sugerida + preço + CMV + travas para um conjunto de serviços. Determinístico. */
export function calcular(ctx: Pick<ContextoEvento, "regras" | "catalogo" | "cabecalho" | "tabela" | "regioes" | "data" | "comValores">, entrada: readonly ServicoVendido[], o: OpcoesCalculo = {}) {
  const servicos = comIds(entrada);
  const restricoes = o.restricoes ?? { itens: [] };
  const datas = [...new Set(servicos.map((s) => s.data))].sort();
  const cabecalho = { ...ctx.cabecalho, datas: datas.length ? datas : ctx.cabecalho.datas, restricoes: textoRestricoes(restricoes) };
  const prog = gerarProgramacao(ctx.regras, ctx.catalogo, { cabecalho, regioes: ctx.regioes, servicos });
  const porId = new Map(prog.servicos.map((s) => [s.id, s]));
  const avisos = [...prog.avisos];
  const bloqueios: Trava[] = [...prog.bloqueios];
  const faltando = new Set(prog.regrasFaltando);
  const pendentes = new Map(prog.regrasPendentes.map((p) => [p.codigo, p.titulo]));
  let valores: { preco: ReturnType<typeof precificar>; documento: ReturnType<typeof gerarPropostaDoc>; custo: ReturnType<typeof custoEstimado> } | undefined;
  if (ctx.comValores) {
    if (!ctx.tabela) faltando.add("tabela de preço do evento");
    const precoServicos = servicos.map((s) => ({ linha: s.linha, tier: s.tier, pax: s.pax, horas: horasEntre(s.horarioInicio, s.horarioFim), variante: s.variantePreco }));
    const custo = custoEstimado(prog, ctx.catalogo);
    const preco = precificar(ctx.regras, { data: ctx.data, tabela: ctx.tabela, cliente: cabecalho.clienteChave ?? undefined, regioes: ctx.regioes, servicos: precoServicos, descontoPercentual: o.descontoPercentual ?? 0, custoEstimado: custo.valor });
    const total = restricoes.itens.reduce((a, i) => a + i.quantidade, 0);
    const documento = gerarPropostaDoc(ctx.regras, {
      cabecalho, data: ctx.data, tabela: ctx.tabela, regioes: ctx.regioes, descontoPercentual: o.descontoPercentual ?? 0, validade: o.validade ?? null,
      opcoes: [{ servicos: servicos.map((s, i) => ({ ...precoServicos[i]!, descritivo: descritivo(s, porId.get(s.id)?.nome), cardapio: porId.get(s.id) })) }],
      restricoes: total ? [{ descritivo: `Restrições alimentares${restricoes.cobranca === "PAGO" ? " (incluídas no total)" : ""}: ${textoRestricoes(restricoes).join(", ")}`, pax: total, cortesia: restricoes.cobranca !== "PAGO", ...(restricoes.cobranca === "PAGO" ? { valorCentavos: 0 } : {}) }] : []
    }, ctx.catalogo);
    for (const d of [preco, documento]) {
      avisos.push(...d.avisos);
      d.regrasFaltando.forEach((f) => faltando.add(f));
      d.regrasPendentes.forEach((p) => pendentes.set(p.codigo, p.titulo));
    }
    // Precificação e documento repetem as mesmas travas comerciais: uma de cada.
    for (const b of [...preco.bloqueios, ...documento.bloqueios]) if (!bloqueios.some((x) => x.codigo === b.codigo && x.mensagem === b.mensagem)) bloqueios.push(b);
    if (custo.semCusto.length) avisos.push(`CMV estimado sem o custo de ${custo.semCusto.length} item(ns): ${custo.semCusto.slice(0, 8).join(", ")}${custo.semCusto.length > 8 ? "…" : ""}.`);
    if (custo.valor === undefined) avisos.push("Sem custo cadastrado para os itens sugeridos: CMV não calculado.");
    valores = { preco, documento, custo };
  }
  return {
    servicos, programacao: prog, cabecalho, valores, restricoes,
    avisos: [...new Set(avisos)], bloqueios, regrasFaltando: [...faltando], regrasPendentes: [...pendentes].map(([codigo, titulo]) => ({ codigo, titulo }))
  };
}
export type Calculo = ReturnType<typeof calcular>;

/** Redação do serviço no orçamento: a do comercial; senão o nome do serviço com o tier. */
const descritivo = (s: ServicoVendido & { descritivo?: string }, nome?: string) => s.descritivo?.trim() || `${nome ?? s.linha} ${s.tier.charAt(0)}${s.tier.slice(1).toLowerCase()}`;

/** Itens que podem ocupar o lugar de cada rótulo sugerido: tier permitido, ativos e fora da lista negra. */
function alternativas(ctx: Pick<ContextoEvento, "regras" | "catalogo">, s: ServicoVendido, cliente: string | null, rotulos: ReadonlySet<string>) {
  const leitor = new Leitor(ctx.regras, { data: s.data, cliente: cliente ?? undefined, linha: s.linha });
  const dic = new Dicionario(leitor);
  const saida: Record<string, Array<{ id: string; nome: string; tier: string }>> = {};
  for (const item of ctx.catalogo) {
    if (!item.ativo || !dic.tierPermitido(item.tier, s.tier)) continue;
    const c = dic.doCatalogo(item);
    if (!rotulos.has(c.rotulo) || verificarListaNegra(leitor, [`${c.rotulo} ${c.nome}`], "PROPOSTA").length) continue;
    (saida[c.rotulo] ??= []).push({ id: item.id, nome: c.nome, tier: item.tier });
  }
  return saida;
}

/** Resposta da sugestão para a tela (sem custo/CMV para quem não vê valores). */
export function sugestao(ctx: ContextoEvento, calc: Calculo) {
  const leitor = new Leitor(ctx.regras, { data: ctx.data, cliente: ctx.cliente.chave_regras ?? undefined });
  const travado = leitor.ler("cardapio.travado", z.boolean(), {}, false) ?? false;
  const cadastro = Object.keys(leitor.ler("bebidas.cadastro", z.record(z.string(), z.unknown()), {}, false) ?? {});
  const nomes = leitor.ler("programacao.nome_servico", z.record(z.string(), z.string()), {}, false) ?? {};
  const tiersOrdem = leitor.ler("tiers.ordem", z.array(z.string()), {}, false) ?? [];
  const tiersDaTabela = (linha: string) => [...new Set(ctx.regras.filter((r) => r.codigo.startsWith(`preco.${ctx.tabela}.${linha}.`)).map((r) => r.codigo.split(".")[3]!))];
  const v = calc.valores;
  return {
    cabecalho: { endereco: calc.cabecalho.endereco, contato: calc.cabecalho.contato, clienteChave: calc.cabecalho.clienteChave, tabela: ctx.tabela, enderecoFixo: !!ctx.fixos.endereco },
    servicos: calc.servicos.map((s) => {
      const p = calc.programacao.servicos.find((x) => x.id === s.id);
      const rotulos = new Set((p?.itens ?? []).filter((i) => i.cardapioItemId && !i.bebida).map((i) => i.item));
      const padrao = new Leitor(ctx.regras, { data: s.data, cliente: ctx.cliente.chave_regras ?? undefined, linha: s.linha })
        .ler("bebidas.padrao", z.array(z.object({ nome: z.string() }).passthrough()), {}, false) ?? [];
      return {
        id: s.id, nome: p?.nome ?? s.linha, comReposicao: p?.comReposicao ?? false, bebidas: s.bebidas ?? padrao.map((b) => b.nome),
        itens: (p?.itens ?? []).map((i) => ({ receita: i.receita, item: i.item, quantidade: i.quantidade, unidade: i.unidade, quantidadeTexto: i.quantidadeTexto ?? null,
          cardapioItemId: i.cardapioItemId ?? null, bebida: !!i.bebida, selo: i.selo ?? null, restricao: !!i.restricao })),
        alternativas: travado ? {} : alternativas(ctx, s, ctx.cliente.chave_regras, rotulos)
      };
    }),
    orcamento: v ? {
      linhas: v.documento.orcamento, totalCentavos: v.preco.totalCentavos, alimentacaoCentavos: v.preco.alimentacaoCentavos,
      cmv: v.preco.cmv ?? null, custoEstimado: v.custo.valor ?? null, opcionais: v.documento.opcionais
    } : null,
    avisos: calc.avisos, bloqueios: calc.bloqueios, regrasFaltando: calc.regrasFaltando, regrasPendentes: calc.regrasPendentes,
    opcoes: {
      travado, bebidas: cadastro, tabela: ctx.tabela,
      linhas: linhasServico.map((linha) => ({ linha, nome: nomes[linha] ?? linha, tiers: (ctx.comValores && tiersDaTabela(linha).length ? tiersDaTabela(linha) : tiersOrdem) }))
    }
  };
}

export const sugestaoSchema = z.object({
  servicos: z.array(servicoVendidoSchema).max(30), descontoPercentual: z.number().min(0).max(1).default(0),
  restricoes: restricoesSchema.default({ itens: [] })
}).strict();

export async function sugerirParaEvento(sql: Leitura, usuario: UsuarioAutenticado, eventoId: string, entrada: z.infer<typeof sugestaoSchema>) {
  const ctx = await contextoDoEvento(sql, usuario, eventoId, ["ADMIN", "COMERCIAL", "ATENDIMENTO", "FINANCEIRO", "PROGRAMACAO"]);
  return sugestao(ctx, calcular(ctx, entrada.servicos, { descontoPercentual: entrada.descontoPercentual, restricoes: entrada.restricoes }));
}

// ---------------------------------------------------------------- Proposta guiada (gates §5)

export const propostaGuiadaSchema = sugestaoSchema.extend({
  revisao: z.number().int().positive(), chave: z.string().uuid(), servicos: z.array(servicoVendidoSchema).min(1).max(30), confirmado: z.literal(true)
}).strict();

const categoriaDaTabela = (tabela: string): DadosProposta["briefing"]["categoria"] =>
  tabela.startsWith("STARTSE") ? "STARTSE_INTELI" : tabela === "WTC" ? "WTC" : tabela.includes("NEGOCIA") ? "NEGOCIACAO" : "EXTERNOS";
const reais = (centavos: number) => Math.round(centavos) / 100;

/**
 * "Confirmar e gerar proposta": confere os gates, calcula com as regras da data do evento, salva a versão (com os serviços
 * estruturados no briefing — o descritivo vendido) e aprova, tudo na mesma transação.
 */
export async function gerarPropostaGuiada(tx: Tx, usuario: UsuarioAutenticado, eventoId: string, entrada: z.infer<typeof propostaGuiadaSchema>) {
  if (!(await travarEvento(tx, eventoId))) throw new ErroOperacao("Evento não encontrado.", 404);
  const ctx = await contextoDoEvento(tx, usuario, eventoId, PAPEIS_COMERCIAIS);
  const faltam = pendenciasEvento(ctx.evento, !!ctx.fixos.endereco);
  if (faltam.length) throw new ErroBloqueio("Complete o evento antes de gerar a proposta", faltam);
  const validade = [ctx.data, hojeSaoPaulo()].sort()[1]!;
  const calc = calcular(ctx, entrada.servicos, { descontoPercentual: entrada.descontoPercentual, restricoes: entrada.restricoes, validade });
  if (calc.regrasFaltando.length) throw new ErroBloqueio("Regras não cadastradas", calc.regrasFaltando);
  if (calc.bloqueios.length && !usuario.papeis.includes("ADMIN")) throw new ErroBloqueio("Bloqueado (peça à diretoria)", calc.bloqueios.map((b) => b.mensagem));
  const { preco, custo } = calc.valores!;
  const nomeServico = (id: string) => calc.programacao.servicos.find((s) => s.id === id)?.nome ?? "Serviço";
  const itens = preco.servicos.map((p, i) => {
    const s = calc.servicos[i]!;
    const nome = descritivo(s, nomeServico(s.id)).slice(0, 200);
    const servico = `${nomeServico(s.id)} ${dataBr(s.data).slice(0, 5)}`.slice(0, 100);
    return p.valorCentavos % p.paxCobrado === 0
      ? { nome, servico, quantidade: p.paxCobrado, unidade: "PAX" as const, preco: reais(p.valorCentavos / p.paxCobrado) }
      : { nome, servico, quantidade: 1, unidade: "SERVICO" as const, preco: reais(p.valorCentavos) };
  });
  const restritos = entrada.restricoes.itens.reduce((a, i) => a + i.quantidade, 0);
  // Reposição fica explícita no descritivo vendido: a programação gerada depois não depende de regra financeira.
  const servicos = calc.servicos.map((s) => ({ ...s, reposicao: s.reposicao ?? calc.programacao.servicos.find((x) => x.id === s.id)?.comReposicao ?? false }));
  const versoes = await propostasDoEvento(tx, eventoId);
  const dados: DadosProposta = {
    briefing: {
      startse: ctx.cliente.chave_regras === "STARTSE", categoria: categoriaDaTabela(ctx.tabela), restricoesConfirmadas: true,
      restricoes: textoRestricoes(entrada.restricoes).join(", "), restritos, cobrancaRestritos: restritos ? entrada.restricoes.cobranca ?? "CORTESIA" : "SEM_RESTRICOES",
      escopo: servicos.map((s) => `${descritivo(s, nomeServico(s.id))} · ${dataBr(s.data)} ${s.horarioInicio}–${s.horarioFim} · ${s.pax} pax`).join("\n").slice(0, 5000),
      tabela: ctx.tabela, servicos
    },
    itens, desconto: reais(preco.descontoCentavos), taxas: reais(preco.taxaCentavos + preco.logisticaCentavos), custoEstimado: custo.valor ?? null,
    fontePreco: `Tabela ${ctx.tabela} vigente em ${dataBr(ctx.data)} (motor de regras)`,
    alteracoes: versoes.length ? `Versão ${versoes.length + 1} gerada pelo fluxo guiado` : "Primeira versão gerada pelo fluxo guiado", validade
  };
  const { id } = await salvarProposta(tx, usuario, { eventoId, revisao: entrada.revisao, chave: entrada.chave, dados });
  const atual = await travarEvento(tx, eventoId);
  await aprovarProposta(tx, usuario, { eventoId, revisao: atual!.revisao, propostaId: id, confirmado: true });
  // Contrato já assinado: a proposta refeita gera a nova programação na hora (rascunho, para conferir e aprovar).
  const programacao = await gerarProgramacaoAutomatica(tx, usuario, eventoId);
  return { propostaId: id, totalCentavos: preco.totalCentavos, avisos: calc.avisos, programacao };
}

// ---------------------------------------------------------------- Programação gerada

const padroesSchema = z.object({
  saidaAntesMin: z.number().min(0),
  roteiro: z.array(z.object({ tipo: z.enum(["MONTAGEM", "REPOSICAO", "DESMONTAGEM"]), titulo: z.string().min(2), orientacao: z.string().min(5), base: z.enum(["INICIO", "MEIO", "FIM"]), minutos: z.number() })).min(1)
});
/** Instante (ISO) de um horário local de São Paulo (UTC−3, sem horário de verão desde 2019). */
const instante = (data: string, hora: string, minutos = 0) => new Date(Date.parse(`${data}T${hora}:00-03:00`) + minutos * 60000).toISOString();

/** Gera a programação a partir da proposta APROVADA com as regras da data do evento e salva como nova versão (rascunho). */
export async function gerarProgramacaoDoEvento(tx: Tx, usuario: UsuarioAutenticado, eventoId: string, revisao: number) {
  const ctx = await contextoDoEvento(tx, usuario, eventoId, PAPEIS_PROGRAMAR);
  const [p] = await tx<{ briefing: { servicos?: ServicoVendido[]; restricoes?: string }; snapshot: unknown; versao: number }[]>`
    select briefing, snapshot, versao from propostas where evento_id = ${eventoId} and status = 'APROVADA'`;
  if (!p) throw new ErroOperacao("Aprove a proposta antes de gerar a programação.", 409);
  if (!isDeepStrictEqual(p.snapshot, await snapshotProposta(tx, eventoId))) throw new ErroOperacao("Os dados do evento mudaram depois da aprovação. Gere e aprove uma nova proposta.", 409);
  const servicos = p.briefing.servicos;
  if (!servicos?.length) throw new ErroOperacao("A proposta aprovada não tem os serviços estruturados. Gere a proposta pelo fluxo do evento.", 409);
  const datas = [...new Set(servicos.map((s) => s.data))].sort();
  const cabecalho = { ...ctx.cabecalho, datas, restricoes: p.briefing.restricoes ? p.briefing.restricoes.split(", ").filter(Boolean) : [] };
  const r = gerarProgramacao(ctx.regras, ctx.catalogo, { cabecalho, regioes: ctx.regioes, servicos });
  if (r.bloqueios.length || r.regrasFaltando.length) throw new ErroBloqueio("Programação bloqueada", [...r.bloqueios.map((b) => b.mensagem), ...r.regrasFaltando.map((f) => `Regra não cadastrada: ${f}`)]);
  const leitor = new Leitor(ctx.regras, { data: datas[0]!, cliente: ctx.cliente.chave_regras ?? undefined });
  const padroes = leitor.ler("programacao.padroes", padroesSchema);
  if (!padroes) throw new ErroBloqueio("Regras não cadastradas", ["programacao.padroes"]);
  const primeiro = r.servicos[0]!, ultimo = r.servicos.at(-1)!;
  const meio = (Date.parse(instante(primeiro.data, primeiro.horarioInicio)) + Date.parse(instante(ultimo.data, ultimo.horarioFim))) / 2;
  const roteiroCampo = padroes.roteiro.map((e) => ({
    tipo: e.tipo, titulo: e.titulo, orientacao: e.orientacao,
    previstoEm: e.base === "INICIO" ? instante(primeiro.data, primeiro.horarioInicio, e.minutos) : e.base === "FIM" ? instante(ultimo.data, ultimo.horarioFim, e.minutos) : new Date(meio + e.minutos * 60000).toISOString()
  }));
  const estrutura: Programacao = { cabecalho: r.cabecalho, servicos: r.servicos, avisos: r.avisos };
  const itens = itensLegados(estrutura);
  if (!itens.length) throw new ErroOperacao("A programação gerada não tem itens.", 409);
  const { id } = await operarEvento(tx, usuario, eventoId, revisao, {
    acao: "PROGRAMACAO_SALVAR",
    dados: { saidaEm: instante(primeiro.data, primeiro.horarioInicio, -padroes.saidaAntesMin), alteracoes: `Gerada pelo motor a partir da proposta v${p.versao}.`, itens, rotulos: [], roteiroCampo }
  }, { estrutura });
  const [v] = await tx<{ versao: number }[]>`select versao from programacoes where id = ${id}`;
  return { id, versao: v?.versao ?? 1, avisos: r.avisos, regrasPendentes: [...r.regrasPendentes, ...leitor.diagnostico().regrasPendentes] };
}

/**
 * Geração automática (sem clique): roda quando o contrato é registrado ou quando a proposta é refeita com contrato
 * já assinado. É uma ação do sistema disparada por quem fechou o contrato, por isso recebe o papel de programação só
 * para este passo (o autor auditado continua sendo o usuário). Nunca derruba a operação que a disparou: se o motor
 * bloquear, a programação fica para gerar à mão pelo botão e o motivo vira notificação do evento.
 */
export async function gerarProgramacaoAutomatica(tx: Tx, usuario: UsuarioAutenticado, eventoId: string): Promise<{ gerada: boolean; motivo?: string }> {
  const [e] = await tx<{ revisao: number; empresa_id: string; contrato: boolean }[]>`
    select revisao, empresa_id, (contrato_assinado_em is not null or nullif(trim(liberacao_excepcional_motivo), '') is not null) contrato from eventos where id = ${eventoId}`;
  const [proposta] = await tx`select 1 from propostas where evento_id = ${eventoId} and status = 'APROVADA' and jsonb_array_length(coalesce(briefing->'servicos', '[]'::jsonb)) > 0`;
  if (!e?.contrato || !proposta) return { gerada: false };
  const sistema: UsuarioAutenticado = { ...usuario, papeis: [...new Set([...usuario.papeis, "PROGRAMACAO" as const])] };
  try {
    await tx.savepoint((sp) => gerarProgramacaoDoEvento(sp, sistema, eventoId, e.revisao));
    return { gerada: true };
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : "erro desconhecido";
    await tx`insert into operacao_notificacoes (id, empresa_id, evento_id, mensagem)
      values (gen_random_uuid(), ${e.empresa_id}, ${eventoId}, ${`Programação automática não gerada: ${motivo}`.slice(0, 1000)})`;
    return { gerada: false, motivo };
  }
}

// ---------------------------------------------------------------- Simulação (calculadora, sem evento)

export const simulacaoSchema = sugestaoSchema.extend({
  data: z.string().date(), tabela: z.string().regex(/^[A-Z0-9_]{2,40}$/), cliente: z.string().regex(/^[A-Z0-9_]{2,40}$/).optional(),
  regioes: z.array(z.string().max(100)).max(5).default([]), pax: z.number().int().positive().max(100000).optional()
}).strict();

/** Mesmo motor do evento, com o contexto informado na tela (data, tabela, cliente de regras, região). */
export async function simular(sql: Leitura, usuario: UsuarioAutenticado, e: z.infer<typeof simulacaoSchema>) {
  const comValores = veValores(usuario);
  const [regras, catalogo] = await Promise.all([carregarRegras(sql, { papeis: ["ADMIN"] }), carregarCatalogo(sql, comValores)]);
  const fixos = fixosDoCliente(regras, e.cliente ?? null, e.data);
  const primeiro = e.servicos[0];
  const ctx: ContextoEvento = {
    evento: { id: "simulacao", empresa_id: "", revisao: 0, titulo: "Simulação", data_evento: e.data, pax: e.pax ?? primeiro?.pax ?? null },
    cliente: { nome: e.cliente ?? "Simulação", chave_regras: e.cliente ?? null }, regras, catalogo, fixos, tabela: e.tabela, data: e.data, comValores,
    regioes: e.regioes.map(chaveRegiao).filter(Boolean),
    cabecalho: { eventoId: "simulacao", contratante: "Simulação", cliente: "Simulação", clienteChave: e.cliente ?? null, evento: "Simulação", contato: fixos.contato ?? "",
      telefoneContato: null, pax: e.pax ?? primeiro?.pax ?? 0, datas: [e.data], horarioInicio: primeiro?.horarioInicio ?? "", horarioFim: primeiro?.horarioFim ?? "", endereco: fixos.endereco ?? "", restricoes: [] }
  };
  return sugestao(ctx, calcular(ctx, e.servicos, { descontoPercentual: e.descontoPercentual, restricoes: e.restricoes }));
}
