// Comanda (§7): produção e expedição por dia + uma página da Adriana. Cada página é uma seção própria
// (começa em página nova e tem a borda na cor do setor). Fundo branco; cor só em borda e texto, exceto tarjas.
import { Document, Packer, type Table } from "docx";
import type { BlocoComanda, Comanda, PaginaComanda, TipoPaginaComanda } from "./tipos";
import { ESTILOS, PAGINA, cabecalho, espaco, par, secao, tabela, tarja, type Cel, type Par } from "./docx-base";
import { dataLonga, moeda } from "./comum";

export const PAGINAS_COMANDA: Record<TipoPaginaComanda | "ADRIANA", { titulo: string; cor: string }> = {
  COZINHA_QUENTE: { titulo: "COMANDA DE PRODUÇÃO — COZINHA QUENTE", cor: "800020" },
  COZINHA_FRIA: { titulo: "COMANDA DE PRODUÇÃO — COZINHA FRIA / GARDE MANGER", cor: "B45309" },
  CONFEITARIA: { titulo: "COMANDA DE PRODUÇÃO — CONFEITARIA", cor: "1F4E79" },
  EXPEDICAO_ALIMENTACAO: { titulo: "COMANDA DE EXPEDIÇÃO — ALIMENTAÇÃO", cor: "595959" },
  EXPEDICAO_BEBIDAS: { titulo: "COMANDA DE EXPEDIÇÃO — BEBIDAS, ESTRUTURA E MATERIAIS", cor: "595959" },
  ADRIANA: { titulo: "LOCAÇÕES EXTRAS, FORNECEDORES E PESSOAL FREELANCER", cor: "2E7D32" }
};

export const TEXTOS_COMANDA = { finalizar: "FINALIZAR CONFORME IMAGEM" } as const;

const AMARELO = "FFF200", VERMELHO = "C00000", AMBAR = "FFC000", AMBAR_CLARO = "FFF2CC";
const PRODUCAO = [2300, PAGINA.util - 2300];
const EXPEDICAO = [1800, PAGINA.util - 1800 - 2 * 1500, 1500, 1500];

const ehExpedicao = (t: TipoPaginaComanda) => t === "EXPEDICAO_ALIMENTACAO" || t === "EXPEDICAO_BEBIDAS";
const tarjaVermelha = (t: string) => tarja([par([{ t, b: true, cor: VERMELHO }])], { corBorda: VERMELHO, espessura: 18 });
const tarjaAmarela = (t: string) => tarja([par([{ t, b: true, size: 26 }])], { fundo: AMARELO, corBorda: "000000" });
// As tarjas vêm das regras (PaginaComanda.avisos); o gerador só escolhe o estilo: campo a preencher ou texto todo em
// maiúsculas = tarja amarela; o resto, vermelha.
const tarjaDoAviso = (t: string) => (/_{3,}/.test(t) || t === t.toLocaleUpperCase("pt-BR") ? tarjaAmarela(t) : tarjaVermelha(t));

function tabelaBloco(b: BlocoComanda, tipo: TipoPaginaComanda): Table {
  const cor = PAGINAS_COMANDA[tipo].cor;
  const exp = ehExpedicao(tipo);
  const larg = exp ? EXPEDICAO : PRODUCAO;
  const ambar = b.destaque === "AMBAR";
  const fundo = ambar ? AMBAR_CLARO : undefined;
  const cel = (pars: Par[], extra: Partial<Cel> = {}): Cel => ({ pars, fundo, ...extra });
  const tique = () => cel([par("☐", { alinhar: "centro" })]);
  const linhas: Cel[][] = [
    [{ pars: [par([{ t: b.titulo, b: true, cor: ambar ? "000000" : cor, size: 26 }])], span: larg.length, fundo: ambar ? AMBAR : undefined }],
    (exp ? ["QUANTIDADE", "ITEM", "EXP ☐", "COPEIRAS ☐"] : ["QUANTIDADE", "ITEM"]).map((t) => cel([par([{ t, b: true, size: 20 }], { alinhar: "centro" })]))
  ];
  for (const l of b.linhas) {
    const item: Par[] = [par([{ t: l.item, b: true }])];
    if (l.detalhe) item.push(par([{ t: l.detalhe, i: true }]));
    if (l.alerta) item.push(par([{ t: l.alerta, b: true, cor: VERMELHO }]));
    if (l.finalizarConformeImagem) item.push(par([{ t: TEXTOS_COMANDA.finalizar, b: true, cor: VERMELHO }]));
    linhas.push([cel([par(l.quantidade, { alinhar: "centro" })]), cel(item), ...(exp ? [tique(), tique()] : [])]);
    // Materiais: sublinhas ticáveis logo abaixo do item.
    for (const m of l.materiais ?? []) linhas.push([cel([]), cel([par(`☐ ${m}`, { recuo: 360 })]), ...(exp ? [tique(), tique()] : [])]);
  }
  return tabela(linhas, larg, { corBorda: ambar ? "000000" : cor });
}

function paginaSetor(c: Comanda, pg: PaginaComanda) {
  const meta = PAGINAS_COMANDA[pg.tipo];
  const corpo: Array<Table | ReturnType<typeof espaco>> = [];
  for (const a of pg.avisos) corpo.push(tarjaDoAviso(a), espaco(80));
  for (const b of pg.blocos) corpo.push(tabelaBloco(b, pg.tipo), espaco());
  const h = c.cabecalho;
  return secao(cabecalho(`${meta.titulo} — ${dataLonga(pg.data)}`, `${h.cliente} · ${h.evento} · ${h.pax} pax · ${h.horarioInicio} às ${h.horarioFim}`, meta.cor), corpo, meta.cor);
}

function paginaAdriana(c: Comanda) {
  const meta = PAGINAS_COMANDA.ADRIANA, cor = meta.cor, a = c.adriana;
  const titulo = (t: string, fundo?: string): Cel => ({ pars: [par([{ t, b: true, cor: fundo ? "000000" : cor, size: 26 }])], fundo });
  const corpo: Array<Table | ReturnType<typeof espaco>> = [];

  corpo.push(tabela([[titulo("LOCAÇÃO EXTRA")], ...(a.locacoes.length ? a.locacoes.map((l) => [{ pars: [par(`☐ ${l}`)] }]) : [[{ pars: [par("Não solicitado")] }]])], [PAGINA.util], { corBorda: cor }), espaco());

  const larg = [2900, 5066, 2500];
  const forn: Cel[][] = [[{ ...titulo("FORNECEDORES (comprados prontos)", AMBAR), span: 3 }]];
  const datas = [...new Set(a.fornecedores.map((f) => f.data))].sort();
  if (!datas.length) forn.push([{ pars: [par("Nenhum fornecedor externo")], span: 3, fundo: AMBAR_CLARO }]);
  for (const d of datas) {
    if (c.cabecalho.datas.length > 1) forn.push([{ pars: [par([{ t: `DIA ${dataLonga(d)}`, b: true }])], span: 3, fundo: AMBAR_CLARO }]);
    forn.push(["FORNECEDOR", "ITEM", "QUANTIDADE"].map((t) => ({ pars: [par([{ t, b: true }])], fundo: AMBAR_CLARO })));
    for (const f of a.fornecedores.filter((x) => x.data === d)) forn.push([f.fornecedor, f.item, f.quantidade].map((t) => ({ pars: [par(t)], fundo: AMBAR_CLARO })));
  }
  corpo.push(tabela(forn, larg, { corBorda: "000000" }), espaco());

  const pessoal: Cel[][] = [[titulo("PESSOAL FREELANCER")], [{ pars: [par(`Nº de freelancers contratados: ${a.freelancers ?? "____"}`)] }]];
  if (a.verbaCentavos > 0) pessoal.push([titulo("VERBA")], [{ pars: [par(`Verba: ${moeda(a.verbaCentavos)}`)] }]);
  corpo.push(tabela(pessoal, [PAGINA.util], { corBorda: cor }));

  const h = c.cabecalho;
  return secao(cabecalho(meta.titulo, `${h.cliente} · ${h.evento} · ${h.datas.map(dataLonga).join(", ")}`, cor), corpo, cor);
}

/** Páginas que vão para o arquivo: setores com blocos, na ordem do motor, e a da Adriana no fim. */
export const paginasVisiveis = (c: Comanda) => c.paginas.filter((p) => p.blocos.length > 0);

export async function renderizarComanda(c: Comanda): Promise<Buffer> {
  const doc = new Document({
    creator: "Pieggi", title: `Comanda - ${c.cabecalho.evento}`, styles: ESTILOS,
    sections: [...paginasVisiveis(c).map((p) => paginaSetor(c, p)), paginaAdriana(c)]
  });
  return Packer.toBuffer(doc);
}
