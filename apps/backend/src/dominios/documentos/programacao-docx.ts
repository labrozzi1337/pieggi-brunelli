// Programação operacional (§6): .docx para as copeiras. Página 1 = dados do evento + CHECKLIST COPEIRAS +
// Auditório; uma tabela QUANTIDADE | RECEITA | ITEM por serviço, que nunca se divide entre páginas.
import { Document, Packer, Paragraph, TextRun } from "docx";
import type { ItemProgramacao, Programacao, ServicoProgramacao, Unidade } from "./tipos";
import { CINZA_ROTULO, ESTILOS, PAGINA, cabecalho, espaco, par, secao, tabela, tarja, type Cel, type Par } from "./docx-base";
import { dataCurta } from "./comum";

export interface TextosProgramacao {
  checklistTitulo: string;
  checklist: Array<{ titulo: string; texto?: string; itens: string[] }>;
}

/** PADRÃO — texto fixo do §6 "Checklist Copeiras". O motor sobrescreve com o que estiver nas regras. */
export const TEXTOS_PADRAO_PROGRAMACAO: TextosProgramacao = {
  checklistTitulo: "CHECKLIST COPEIRAS",
  checklist: [
    {
      titulo: "(A) Montagem/entrega, por serviço",
      texto: "Fotografar cada mesa montada e enviar ao Luiz (WhatsApp) +55 11 97603-8194; faltando algo, avisar o Luiz.",
      itens: ["Auditório montado com café e águas", "Coffee da manhã", "Almoço", "Coffee da tarde", "Refresqueiras de suco e chá abastecidas", "Acompanhamentos (açúcar, adoçante, achocolatado, sachê de chá)"]
    },
    {
      titulo: "(B) Higienização e apresentação",
      itens: ["Talheres, pratos, copos e louças sem mancha", "Álcool 70% antes de expor", "Limpar bicos", "Verrines, doces e cupcakes limpos", "Nescau limpo e seco", "Escaldar garrafas"]
    },
    {
      titulo: "(C) Lavagem para ir embora",
      itens: ["Retirar restos com papel toalha antes de lavar", "Não jogar alimento na pia do cliente"]
    }
  ]
};

const COLUNAS = [1700, 6366, 2400];
const EVENTO = [2900, 7566];
const UNIDADE: Record<Unidade, [string, string]> = {
  UN: ["un", "un"], KG: ["kg", "kg"], G: ["g", "g"], L: ["L", "L"], ML: ["ml", "ml"],
  GARRAFA: ["garrafa", "garrafas"], TRAVESSA: ["travessa", "travessas"], PACOTE: ["pacote", "pacotes"]
};
const num = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
export const textoQuantidade = (i: ItemProgramacao) =>
  i.quantidadeTexto ?? `${num(i.quantidade)} ${UNIDADE[i.unidade][i.quantidade > 1 ? 1 : 0]}`;
const horario = (a: string, b: string) => `${a} às ${b}`;

function blocoEvento(p: Programacao): Cel[][] {
  const c = p.cabecalho;
  const linha = (rotulo: string, valor: string): Cel[] => [
    { pars: [par([{ t: rotulo, b: true }])], fundo: CINZA_ROTULO },
    { pars: [par(valor)] }
  ];
  return [
    linha("CLIENTE", c.cliente),
    linha("EVENTO", c.evento),
    linha("CONTATO", c.telefoneContato ? `${c.contato} — ${c.telefoneContato}` : c.contato),
    linha("PAX", String(c.pax)),
    linha(c.datas.length > 1 ? "DATAS" : "DATA", c.datas.map(dataCurta).join(" · ")),
    linha("HORÁRIO", horario(c.horarioInicio, c.horarioFim)),
    linha("ENDEREÇO", c.endereco),
    ...(c.restricoes.length ? [linha("RESTRIÇÕES", c.restricoes.join(" · "))] : [])
  ];
}

function checklist(t: TextosProgramacao): Cel[][] {
  const linhas: Cel[][] = [[{ pars: [par([{ t: t.checklistTitulo, b: true }], { alinhar: "centro" })], fundo: CINZA_ROTULO }]];
  for (const s of t.checklist) {
    const pars: Par[] = [par([{ t: s.titulo, b: true }])];
    if (s.texto) pars.push(par(s.texto));
    s.itens.forEach((i) => pars.push(par(`☐ ${i}`, { recuo: 240 })));
    linhas.push([{ pars }]);
  }
  return linhas;
}

// ponytail: altura estimada por contagem de caracteres (Arial ~53 car./linha na RECEITA a 12 pt). Sem render real,
// só reduz a fonte do serviço que claramente não cabe numa página; a validação por PDF exigiria LibreOffice.
const ALTURA_UTIL_PT = 690;
function tamanhoFonte(s: ServicoProgramacao): number {
  const linhasDe = (t: string, cpl: number) => Math.max(1, Math.ceil(t.length / cpl));
  const est = 2 * 20 + s.itens.reduce((a, i) => a + 4 + 14.5 * Math.max(
    linhasDe(textoQuantidade(i), 13), linhasDe(i.receita, 53) + (i.observacao ? linhasDe(i.observacao, 53) : 0), linhasDe(i.item, 19)), 0);
  if (est <= ALTURA_UTIL_PT) return 24;
  return Math.max(18, Math.floor((24 * ALTURA_UTIL_PT) / est));
}

function tabelaServico(s: ServicoProgramacao) {
  const titulo = [s.nome.toLocaleUpperCase("pt-BR"), s.tier, horario(s.horarioInicio, s.horarioFim), `${s.pax} PAX`, dataCurta(s.data)]
    .filter(Boolean).join(" · ") + (s.comReposicao ? " · COM REPOSIÇÃO" : "");
  const linhas: Cel[][] = [
    [{ pars: [par([{ t: titulo, b: true }])], fundo: CINZA_ROTULO, span: 3 }],
    ["QUANTIDADE", "RECEITA", "ITEM"].map((t) => ({ pars: [par([{ t, b: true, size: 20 }], { alinhar: "centro" })], fundo: CINZA_ROTULO })),
    ...s.itens.map((i): Cel[] => {
      const enfase = { i: i.restricao, b: i.restricao };
      const receita: Par[] = [par([{ t: i.receita, ...enfase }])];
      if (i.observacao) receita.push(par([{ t: i.observacao, i: true }]));
      return [
        { pars: [par([{ t: textoQuantidade(i), ...enfase }], { alinhar: "centro" })] },
        { pars: receita },
        { pars: [par([{ t: i.item, ...enfase }])] }
      ];
    })
  ];
  return tabela(linhas, COLUNAS, { size: tamanhoFonte(s) });
}

/** Auditório do primeiro dia sobe para a página 1; o resto segue a ordem do motor, agrupado por dia. */
export function ordenarServicos(servicos: ServicoProgramacao[]): Array<{ data: string; servicos: ServicoProgramacao[] }> {
  const datas = [...new Set(servicos.map((s) => s.data))].sort();
  return datas.map((data, k) => {
    const doDia = servicos.filter((s) => s.data === data);
    if (k === 0) {
      const aud = doDia.findIndex((s) => s.linha === "AUDITORIO");
      if (aud > 0) doDia.unshift(...doDia.splice(aud, 1));
    }
    return { data, servicos: doDia };
  });
}

export async function renderizarProgramacao(p: Programacao, textos: TextosProgramacao = TEXTOS_PADRAO_PROGRAMACAO): Promise<Buffer> {
  const c = p.cabecalho;
  const corpo: Array<Paragraph | ReturnType<typeof tabela>> = [tabela(blocoEvento(p), EVENTO), espaco()];
  if (p.avisos.length) corpo.push(tarja([par([{ t: "OBS", b: true }]), ...p.avisos.map((a) => par(a))], { fundo: "FFF200", corBorda: "000000", espessura: 6 }), espaco());
  corpo.push(tabela(checklist(textos), [PAGINA.util]), espaco());
  const dias = ordenarServicos(p.servicos);
  dias.forEach((d, k) => {
    if (dias.length > 1) corpo.push(new Paragraph({
      pageBreakBefore: k > 0, keepNext: true, spacing: { before: 0, after: 120 },
      children: [new TextRun({ text: `DIA ${k + 1} — ${dataCurta(d.data)}`, bold: true, size: 28, font: "Arial" })]
    }));
    for (const s of d.servicos) corpo.push(tabelaServico(s), espaco());
  });
  const doc = new Document({
    creator: "Pieggi", title: `Programação - ${c.evento}`, styles: ESTILOS,
    sections: [secao(cabecalho("PROGRAMAÇÃO OPERACIONAL — COPEIRAS", `${c.cliente} · ${c.evento} · ${c.datas.map(dataCurta).join(", ")}`), corpo)]
  });
  return Packer.toBuffer(doc);
}
