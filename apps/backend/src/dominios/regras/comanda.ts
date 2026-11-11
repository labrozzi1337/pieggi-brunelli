// Comanda: roteia cada item da programação para estação/fornecedor, com materiais, estrutura e página da Adriana.
// FIDELIDADE: o texto do item é o da programação; só erro óbvio de digitação é corrigido (regra grafia.correcoes).
import { z } from "zod";
import type {
  BlocoComanda, Comanda, ItemProgramacao, LinhaComanda, PaginaComanda, Programacao, ServicoProgramacao, TipoPaginaComanda
} from "@/dominios/documentos/tipos";
import { Leitor, teto, type Regra } from "./motor";
import { contemTermo, diagnostico, formatarNumero, preencher, registro, type Diagnostico } from "./cardapio";
import { normalizar } from "./classificacao";
import { calcularVerba } from "./proposta";

export interface ExtrasComanda {
  freelancers: number | null;      // escala lançada; null → campo em branco
  locacoes: string[];
  verbaCentavos?: number;          // ou calcula de totalEventoCentavos pela regra verba.percentual
  totalEventoCentavos?: number;
}
export type ResultadoComanda = Comanda & Diagnostico;

const textos = z.array(z.string());
const PRODUCAO: TipoPaginaComanda[] = ["COZINHA_QUENTE", "COZINHA_FRIA", "CONFEITARIA"];
const regraItemSchema = z.array(z.object({
  termos: textos, estacoes: textos.optional(), detalhe: z.string().optional(), alerta: z.string().optional(), finalizarConformeImagem: z.boolean().optional(),
  contas: z.array(z.object({ multiplicador: z.number().optional(), divisor: z.number().optional(), texto: z.string() })).optional()
}));
const materiaisSchema = z.array(z.object({ rotulos: textos, textos: z.array(z.object({ texto: z.string(), porPax: z.number().optional(), porUnidade: z.number().optional() })) }));
const estruturaSchema = z.array(z.object({
  chave: z.string(), texto: z.string(), fixo: z.number().optional(), porPax: z.number().optional(), aCadaPax: z.number().optional(),
  porItensQuentes: z.number().optional(), porFreelancer: z.number().optional(), porEvento: z.boolean().optional(), linhas: textos.optional(), rotulos: textos.optional(),
  porLitros: z.object({ rotulos: textos, fator: z.number().positive() }).optional()      // n = litros do dia dessas bebidas × fator, para cima
}));
const producaoSchema = z.object({ rotulos: textos, estacao: z.enum(PRODUCAO as [TipoPaginaComanda, ...TipoPaginaComanda[]]), expedicao: z.enum(["EXPEDICAO_ALIMENTACAO", "EXPEDICAO_BEBIDAS"]), litrosPorReceita: z.number().positive(), texto: z.string() });
const textosSchema = z.object({ compradosProntos: z.string(), apoio: z.string(), estrutura: z.string(), termica: z.string(), pastaBase: z.string() });

const UNIDADES: Record<string, string> = { UN: "un", KG: "kg", G: "g", L: "L", ML: "ml", GARRAFA: "garrafa(s)", TRAVESSA: "travessa(s)", PACOTE: "pacote(s)" };
const quantidadeTexto = (i: Pick<ItemProgramacao, "quantidade" | "unidade" | "quantidadeTexto">) => i.quantidadeTexto ?? `${formatarNumero(i.quantidade)} ${UNIDADES[i.unidade] ?? i.unidade}`;
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/** Corrige só erro óbvio de digitação, palavra a palavra, sem mexer no resto ("integral" fica integral). */
export function corrigirGrafia(texto: string, correcoes: ReadonlyArray<{ de: string; para: string }>) {
  return correcoes.reduce((t, c) => t.replace(new RegExp(`(?<![\\p{L}\\d])${c.de.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\d])`, "giu"), c.para), texto);
}

export function gerarComanda(regras: readonly Regra[], programacao: Programacao, extras: ExtrasComanda): ResultadoComanda {
  const { cabecalho } = programacao;
  const datas = [...new Set(programacao.servicos.map((s) => s.data))].sort();
  const leitor = new Leitor(regras, { data: datas[0] ?? cabecalho.datas[0] ?? "", cliente: cabecalho.clienteChave ?? undefined });
  const avisosDiag: string[] = [];
  const correcoes = leitor.ler("grafia.correcoes", z.array(z.object({ de: z.string(), para: z.string() }))) ?? [];
  const regrasItem = leitor.ler("comanda.regras_item", regraItemSchema) ?? [];
  const materiais = leitor.ler("comanda.materiais", materiaisSchema) ?? [];
  const estrutura = leitor.ler("comanda.estrutura", estruturaSchema) ?? [];
  const naoEnviar = leitor.ler("comanda.ponto_fixo.nao_enviar", textos) ?? [];
  const apoio = leitor.ler("comanda.apoio_identificacao", textos) ?? [];
  const t = leitor.ler("comanda.textos", textosSchema) ?? { compradosProntos: "", apoio: "", estrutura: "", termica: "", pastaBase: "" };
  const avisosPagina = leitor.ler("comanda.avisos", registro(textos)) ?? {};
  const avisosAlmoco = leitor.ler("comanda.avisos_almoco", registro(textos)) ?? {};
  const avisosCliente = leitor.ler("comanda.avisos_cliente", registro(textos), {}, false) ?? {};
  const horasAmostra = leitor.ler("almoco.amostra_vigilancia_horas", z.number().positive());
  const pastaBase = leitor.ler("comanda.pasta_base", z.object({ gPorUnidade: z.number(), rotulos: textos, receita: z.string() }));
  const nomesFornecedor = leitor.ler("fornecedores.nomes", registro(z.string())) ?? {};
  const fornecedoresAdriana = leitor.ler("comanda.adriana.fornecedores", textos) ?? [];
  const cadastroBebidas = leitor.ler("bebidas.cadastro", registro(z.object({ rotulo: z.string(), termica: z.string().optional() }).passthrough())) ?? {};
  const producao = leitor.ler("comanda.bebidas_producao", producaoSchema, {}, false);
  /** Bebida produzida na cozinha (suco): sai da Expedição — Bebidas e vai para a página de produção + a expedição da regra. */
  const produzida = (i: ItemProgramacao) => !!producao && !!i.bebida && !i.compradoPronto && producao.rotulos.includes(i.item);
  const rotulosTermicos = new Set(Object.values(cadastroBebidas).filter((b) => b.termica).map((b) => b.rotulo));

  const nome = (i: ItemProgramacao) => corrigirGrafia(i.receita, correcoes);

  function linha(i: ItemProgramacao, pagina: TipoPaginaComanda, s: ServicoProgramacao): LinhaComanda {
    const item = nome(i);
    const casadas = regrasItem.filter((r) => contemTermo(`${i.item} ${item}`, r.termos) && (!r.estacoes || r.estacoes.includes(pagina)));
    const detalhes = [
      ...casadas.flatMap((r) => (r.detalhe ? [r.detalhe] : [])),
      ...casadas.flatMap((r) => r.contas ?? []).map((c) => preencher(c.texto, { n: teto(i.quantidade * (c.multiplicador ?? 1) / (c.divisor ?? 1)) })),
      ...(i.observacao ? [i.observacao] : [])
    ];
    const alertas = casadas.flatMap((r) => (r.alerta ? [r.alerta] : []));
    const l: LinhaComanda = { quantidade: quantidadeTexto(i), item };
    if (detalhes.length) l.detalhe = detalhes.join(" ");
    if (alertas.length) l.alerta = alertas.join(" ");
    if (casadas.some((r) => r.finalizarConformeImagem)) l.finalizarConformeImagem = true;
    if (pagina === "EXPEDICAO_ALIMENTACAO") {
      const regra = materiais.find((m) => m.rotulos.includes(i.item)) ?? materiais.find((m) => m.rotulos.includes("*"));
      const subs = (regra?.textos ?? []).map((m) => (m.porPax ? `${m.texto}: ${teto(s.pax * m.porPax)}` : m.porUnidade ? `${m.texto}: ${teto(i.quantidade * m.porUnidade)}` : m.texto));
      if (subs.length) l.materiais = subs;
    }
    if (rotulosTermicos.has(i.item) && (pagina === "EXPEDICAO_BEBIDAS" || (produzida(i) && pagina === producao?.expedicao))) l.materiais = [t.termica];
    if (produzida(i) && pagina === producao?.estacao && i.unidade === "L") l.detalhe = [preencher(producao.texto, { n: teto(i.quantidade / producao.litrosPorReceita) }), l.detalhe].filter(Boolean).join(" ");
    return l;
  }

  /** Comprados prontos somados por dia (não por serviço). */
  function somados(itens: ItemProgramacao[]): LinhaComanda[] {
    const mapa = new Map<string, ItemProgramacao>();
    for (const i of itens) {
      const k = `${normalizar(nome(i))}|${i.unidade}`;
      const atual = mapa.get(k);
      mapa.set(k, atual ? { ...atual, quantidade: atual.quantidade + i.quantidade, quantidadeTexto: undefined } : i);
    }
    return [...mapa.values()].map((i) => ({ quantidade: quantidadeTexto(i), item: nome(i) }));
  }

  const paginas: PaginaComanda[] = [];
  datas.forEach((data, diaIdx) => {
    const servicos = programacao.servicos.filter((s) => s.data === data).sort((a, b) => a.horarioInicio.localeCompare(b.horarioInicio));
    const itensDia = servicos.flatMap((s) => s.itens.map((i) => ({ i, s })));
    const temAlmoco = servicos.some((s) => s.linha === "ALMOCO" || s.linha === "JANTAR");
    const avisos = (tipo: TipoPaginaComanda) => [
      ...(avisosPagina["*"] ?? []), ...(avisosPagina[tipo] ?? []), ...(avisosCliente[tipo] ?? []),
      ...(temAlmoco ? (avisosAlmoco[tipo] ?? []).map((a) => preencher(a, { horas: horasAmostra ?? "____" })) : [])
    ];
    const titulo = (s: ServicoProgramacao) => `${s.nome} — ${s.horarioInicio}`;
    const blocosPorServico = (filtro: (i: ItemProgramacao) => boolean, tipo: TipoPaginaComanda, extra?: (s: ServicoProgramacao, itens: ItemProgramacao[]) => LinhaComanda[]) =>
      servicos.map((s): BlocoComanda => {
        const itens = s.itens.filter(filtro);
        return { titulo: titulo(s), linhas: [...itens.map((i) => linha(i, tipo, s)), ...(extra?.(s, itens) ?? [])] };
      }).filter((b) => b.linhas.length);

    for (const tipo of PRODUCAO) {
      const pasta = tipo === "COZINHA_FRIA" && pastaBase ? (s: ServicoProgramacao, itens: ItemProgramacao[]) => {
        const unidades = itens.filter((i) => pastaBase.rotulos.includes(i.item)).reduce((a, i) => a + i.quantidade, 0);
        return unidades ? [{ quantidade: `${formatarNumero(unidades * pastaBase.gPorUnidade / 1000)} kg`, item: t.pastaBase, detalhe: `${unidades} un × ${pastaBase.gPorUnidade} g. ${pastaBase.receita}` }] : [];
      } : undefined;
      const blocos = blocosPorServico((i) => (i.bebida ? produzida(i) && producao?.estacao === tipo : i.estacao === tipo && !i.compradoPronto), tipo, pasta);
      if (blocos.length) paginas.push({ tipo, data, avisos: avisos(tipo), blocos });
    }

    const comprados = itensDia.filter(({ i }) => i.compradoPronto);
    const naExpedicao = (i: ItemProgramacao, pagina: "EXPEDICAO_ALIMENTACAO" | "EXPEDICAO_BEBIDAS") => (produzida(i) ? producao!.expedicao === pagina : (pagina === "EXPEDICAO_BEBIDAS") === !!i.bebida);
    const alimentacao = blocosPorServico((i) => naExpedicao(i, "EXPEDICAO_ALIMENTACAO") && !i.compradoPronto, "EXPEDICAO_ALIMENTACAO");
    const prontosComida = somados(comprados.filter(({ i }) => !i.bebida).map(({ i }) => i));
    if (prontosComida.length) alimentacao.push({ titulo: t.compradosProntos, destaque: "AMBAR", linhas: prontosComida });
    if (alimentacao.length) paginas.push({ tipo: "EXPEDICAO_ALIMENTACAO", data, avisos: avisos("EXPEDICAO_ALIMENTACAO"), blocos: alimentacao });

    const bebidas = blocosPorServico((i) => naExpedicao(i, "EXPEDICAO_BEBIDAS") && !i.compradoPronto, "EXPEDICAO_BEBIDAS");
    const prontosBebida = somados(comprados.filter(({ i }) => i.bebida).map(({ i }) => i));
    if (prontosBebida.length) bebidas.push({ titulo: t.compradosProntos, destaque: "AMBAR", linhas: prontosBebida });
    const pax = Math.max(0, ...servicos.map((s) => s.pax));
    const rotulos = new Set(itensDia.map(({ i }) => i.item));
    const linhas = new Set<string>(servicos.map((s) => s.linha));
    const quentes = itensDia.filter(({ i }) => i.quente).length;
    const estruturaLinhas = estrutura
      .filter((e) => !naoEnviar.includes(e.chave) && (!e.porEvento || diaIdx === 0) && (!e.linhas || e.linhas.some((l) => linhas.has(l))) && (!e.rotulos || e.rotulos.some((r) => rotulos.has(r))))
      .flatMap((e): LinhaComanda[] => {
        if (e.porFreelancer !== undefined) return [{ quantidade: extras.freelancers === null ? "____" : String(teto(extras.freelancers * e.porFreelancer)), item: e.texto }];
        const litros = e.porLitros ? itensDia.filter(({ i }) => i.unidade === "L" && e.porLitros!.rotulos.includes(i.item)).reduce((a, { i }) => a + i.quantidade, 0) : 0;
        const n = e.porLitros ? teto(litros * e.porLitros.fator) : e.fixo ?? (e.porPax ? teto(pax * e.porPax) : e.aCadaPax ? teto(pax / e.aCadaPax) : e.porItensQuentes ? teto(quentes * e.porItensQuentes) : 0);
        return n > 0 ? [{ quantidade: String(n), item: e.texto }] : [];
      });
    if (estruturaLinhas.length) bebidas.push({ titulo: t.estrutura, linhas: estruturaLinhas });
    const valores = { cliente: cabecalho.cliente, evento: cabecalho.evento, data: dataBr(data) };
    if (apoio.length) bebidas.push({ titulo: t.apoio, linhas: apoio.map((a) => ({ quantidade: "", item: preencher(a, valores) })) });
    if (bebidas.length) paginas.push({ tipo: "EXPEDICAO_BEBIDAS", data, avisos: avisos("EXPEDICAO_BEBIDAS"), blocos: bebidas });
  });

  // Página da Adriana: uma só para o evento inteiro; fornecedores rotulados por dia.
  const porFornecedor = new Map<string, { data: string; fornecedor: string; item: string; quantidade: number; base: ItemProgramacao }>();
  for (const s of programacao.servicos) {
    for (const i of s.itens.filter((x) => x.fornecedor && fornecedoresAdriana.includes(x.fornecedor))) {
      const k = `${s.data}|${i.fornecedor}|${normalizar(nome(i))}|${i.unidade}`;
      const atual = porFornecedor.get(k);
      porFornecedor.set(k, { data: s.data, fornecedor: nomesFornecedor[i.fornecedor!] ?? i.fornecedor!, item: nome(i), quantidade: (atual?.quantidade ?? 0) + i.quantidade, base: i });
    }
  }
  const verbaCentavos = extras.verbaCentavos ?? (extras.totalEventoCentavos !== undefined ? calcularVerba(regras, datas[0] ?? "", extras.totalEventoCentavos, cabecalho.clienteChave) : 0);
  return {
    cabecalho, paginas,
    adriana: {
      locacoes: extras.locacoes,
      fornecedores: [...porFornecedor.values()].sort((a, b) => a.data.localeCompare(b.data))
        .map((f) => ({ data: f.data, fornecedor: f.fornecedor, item: f.item, quantidade: quantidadeTexto({ ...f.base, quantidade: f.quantidade, quantidadeTexto: f.quantidade === f.base.quantidade ? f.base.quantidadeTexto : undefined }) })),
      freelancers: extras.freelancers, verbaCentavos
    },
    ...diagnostico([leitor], avisosDiag, [])
  };
}
