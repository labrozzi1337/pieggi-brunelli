// Plaquinha: extrai da programação os itens servidos, deduplica por dia, agrupa, traduz e aplica selos.
// Falta de tradução bloqueia a geração (lista em faltandoTraducao).
import { z } from "zod";
import type { CardPlaquinha, ItemProgramacao, Plaquinhas, Programacao, Selo, SeloExtra } from "@/dominios/documentos/tipos";
import { Leitor, type Regra, type Trava } from "./motor";
import { contemTermo, diagnostico, Dicionario, registro, type Diagnostico } from "./cardapio";
import { normalizar } from "./classificacao";

export type ResultadoPlaquinhas = Plaquinhas & Diagnostico & { faltandoTraducao: string[] };

const textos = z.array(z.string());
const trio = z.tuple([z.string(), z.string(), z.string()]);
const bebidaSchema = registro(z.object({ titulo: z.string(), en: z.string(), es: z.string(), sabor: trio, selo: z.enum(["VEGANO", "VEGETARIANO"]).nullable(), saborFixo: z.boolean().optional() }));
const decisaoSchema = z.array(z.object({ termos: textos, titulo: z.string().optional(), subtitulo: z.string().nullable().optional(), sabor: z.string().optional(), en: z.string().optional(), es: z.string().optional() }));
const extraSchema = registro(z.array(z.object({ titulo: z.string(), subtitulo: z.string().nullable(), en: z.string(), es: z.string(), selos: textos })));

const caixaAlta = (s: string) => s.toLocaleUpperCase("pt-BR");
const juntar = (partes: string[], e: string) => (partes.length > 1 ? `${partes.slice(0, -1).join(", ")} ${e} ${partes.at(-1)}` : partes[0] ?? "");
const semDieta = (s: string) => s.replace(/\s*\((vegano|vegetariano)\)\s*/gi, " ").trim();

export function gerarPlaquinhas(regras: readonly Regra[], programacao: Programacao): ResultadoPlaquinhas {
  const datas = [...new Set(programacao.servicos.map((s) => s.data))].sort();
  const leitor = new Leitor(regras, { data: datas[0] ?? programacao.cabecalho.datas[0] ?? "", cliente: programacao.cabecalho.clienteChave ?? undefined });
  const dic = new Dicionario(leitor);
  const semCard = leitor.ler("plaquinha.sem_card", z.object({ rotulos: textos, termos: textos })) ?? { rotulos: [], termos: [] };
  const bebidas = leitor.ler("plaquinha.bebidas_padrao", bebidaSchema) ?? {};
  const excecao = leitor.ler("plaquinha.excecao_vegetariano", z.object({ rotulo: z.string(), titulo: z.string() }));
  const juntarRotulos = leitor.ler("plaquinha.juntar_sabores", textos) ?? [];
  const nuncaSemGluten = leitor.ler("plaquinha.nunca_sem_gluten", textos) ?? [];
  const semSubtitulo = leitor.ler("plaquinha.sem_subtitulo", textos) ?? [];
  const extras = leitor.ler("plaquinha.cards_extras", extraSchema) ?? {};
  const decisoes = leitor.ler("plaquinha.decisoes", decisaoSchema) ?? [];
  const faltando = new Set<string>();

  const traduzir = (pt: string, catalogo?: [string | null | undefined, string | null | undefined]): [string, string] => {
    const t = catalogo?.[0] && catalogo[1] ? [catalogo[0], catalogo[1]] as [string, string] : dic.traduzir(pt);
    if (!t) { faltando.add(pt); return ["", ""]; }
    return t;
  };
  const selos = (itens: ItemProgramacao[]): Array<Selo | SeloExtra> => {
    const todos = itens.flatMap((i) => [...(i.selo ? [i.selo] : []), ...(i.selosExtras ?? [])])
      .filter((s) => !(s === "SEM_GLUTEN" && itens.some((i) => nuncaSemGluten.includes(i.item))));
    const unicos = [...new Set(todos)];
    return unicos.includes("VEGANO") ? unicos.filter((s) => s !== "VEGETARIANO") : unicos;
  };

  function card(i: ItemProgramacao): CardPlaquinha {
    const texto = `${i.item} ${i.receita}`;
    const bebida = bebidas[i.item];
    if (bebida) {
      const padrao = bebida.saborFixo || !i.sabor || normalizar(i.sabor) === normalizar(bebida.sabor[0]);
      const [pt, en, es] = padrao ? bebida.sabor : [caixaAlta(i.sabor!), ...traduzir(i.sabor!)];
      return { titulo: bebida.titulo, subtitulo: pt, en: `${bebida.en} / ${en}`, es: `${bebida.es} / ${es}`, selos: bebida.selo ? [bebida.selo] : [] };
    }
    const decisao = decisoes.find((d) => contemTermo(texto, d.termos));
    const sabor = semDieta(decisao?.sabor ?? i.sabor ?? "") || null;
    const [catEn, catEs] = traduzir(caixaAlta(i.item));
    const [sabEn, sabEs] = sabor ? traduzir(sabor, sabor === i.sabor ? [i.nomeEn, i.nomeEs] : undefined) : ["", ""];
    let c: CardPlaquinha;
    if (excecao && i.item === excecao.rotulo && i.selo && sabor) {
      c = { titulo: excecao.titulo, subtitulo: caixaAlta(sabor), en: `${catEn} / ${sabEn}`, es: `${catEs} / ${sabEs}`, selos: [] };
    } else if (semSubtitulo.includes(i.item) || !sabor) {
      const titulo = sabor ?? i.item;
      const [en, es] = sabor ? [sabEn, sabEs] : [catEn, catEs];
      c = { titulo: caixaAlta(titulo), subtitulo: null, en, es, selos: [] };
    } else {
      c = { titulo: caixaAlta(sabor), subtitulo: caixaAlta(i.item), en: `${catEn} / ${sabEn}`, es: `${catEs} / ${sabEs}`, selos: [] };
    }
    if (decisao?.titulo !== undefined) c.titulo = decisao.titulo;
    if (decisao?.subtitulo !== undefined) c.subtitulo = decisao.subtitulo;
    if (decisao?.en) c.en = decisao.en;
    if (decisao?.es) c.es = decisao.es;
    c.titulo = c.titulo.replace(/ACOMPANHAMENTOS/g, "ADICIONAIS");
    c.selos = selos([i]);
    return c;
  }

  const dias = datas.map((data) => {
    const itens = programacao.servicos.filter((s) => s.data === data).sort((a, b) => a.horarioInicio.localeCompare(b.horarioInicio))
      .flatMap((s) => s.itens)
      .filter((i) => !semCard.rotulos.includes(i.item) && !contemTermo(`${i.item} ${i.receita}`, semCard.termos));
    const cards: CardPlaquinha[] = [];
    const vistos = new Set<string>();
    for (const i of itens) {
      if (juntarRotulos.includes(i.item)) {
        if (vistos.has(`juntar:${i.item}`)) continue;
        vistos.add(`juntar:${i.item}`);
        const grupo = itens.filter((x) => x.item === i.item);
        const sabores = [...new Map(grupo.filter((x) => x.sabor).map((x) => [normalizar(x.sabor!), x])).values()];
        const [catEn, catEs] = traduzir(caixaAlta(i.item));
        const trad = sabores.map((x) => traduzir(x.sabor!, [x.nomeEn, x.nomeEs]));
        cards.push({
          titulo: caixaAlta(juntar(sabores.map((x) => x.sabor!), "e")), subtitulo: caixaAlta(i.item),
          en: `${catEn} / ${juntar(trad.map((t) => t[0]), "&")}`, es: `${catEs} / ${juntar(trad.map((t) => t[1]), "y")}`, selos: selos(grupo)
        });
        continue;
      }
      const chave = i.chaveDedup ?? normalizar(`${i.item}|${i.sabor ?? i.receita}`);
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      cards.push(card(i));
      if (extras[i.item] && !vistos.has(`extra:${i.item}`)) {
        vistos.add(`extra:${i.item}`);
        cards.push(...extras[i.item]!.map((e) => ({ titulo: e.titulo, subtitulo: e.subtitulo, en: e.en, es: e.es, selos: e.selos as Array<Selo | SeloExtra> })));
      }
    }
    return { data, cards };
  });

  const faltandoTraducao = [...faltando];
  const bloqueios: Trava[] = faltandoTraducao.length
    ? [{ codigo: "TRADUCAO", mensagem: `Plaquinha bloqueada: falta tradução EN/ES de ${faltandoTraducao.join(", ")}. Cadastre no item ou no glossário.`, autoriza: "COMERCIAL" }] : [];
  return { cabecalho: programacao.cabecalho, dias, faltandoTraducao, ...diagnostico([leitor], [], bloqueios) };
}
