// Base dos .docx (programação e comanda): A4, margens 720, cabeçalho com o selo PIEGGI e tabelas que nunca
// quebram (toda linha cantSplit; todo parágrafo keepLines e keepNext até a última linha da tabela).
import {
  AlignmentType, BorderStyle, Header, ImageRun, PageBorderOffsetFrom, Paragraph, ShadingType, Table, TableCell,
  TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType, type ISectionOptions
} from "docx";
import { asset } from "./comum";

export const PAGINA = { largura: 11906, altura: 16838, margem: 720, util: 10466 } as const;
export const CINZA_ROTULO = "D9D9D9";

export interface Run { t: string; b?: boolean; i?: boolean; cor?: string; size?: number; u?: boolean }
export interface Par { runs: Run[]; alinhar?: "esq" | "centro" | "dir"; antes?: number; depois?: number; recuo?: number }
export interface Cel { pars: Par[]; fundo?: string; span?: number; corBorda?: string }

export const par = (t: string | Run[], o: Omit<Par, "runs"> = {}): Par => ({ runs: typeof t === "string" ? [{ t }] : t, ...o });

function paragrafo(p: Par, keepNext: boolean, size: number): Paragraph {
  return new Paragraph({
    keepNext, keepLines: true,
    alignment: p.alinhar === "centro" ? AlignmentType.CENTER : p.alinhar === "dir" ? AlignmentType.RIGHT : AlignmentType.LEFT,
    spacing: { before: p.antes ?? 0, after: p.depois ?? 0 },
    indent: p.recuo ? { left: p.recuo } : undefined,
    children: p.runs.map((r) => new TextRun({ text: r.t, bold: r.b, italics: r.i, underline: r.u ? {} : undefined, color: r.cor, size: r.size ?? size, font: "Arial" }))
  });
}

/** Tabela indivisível: larguras em DXA (tblGrid + layout fixo, senão o Word divide por igual). */
export function tabela(linhas: Cel[][], larguras: number[], o: { corBorda?: string; espessura?: number; size?: number; indivisivel?: boolean } = {}): Table {
  const size = o.size ?? 24;
  const indivisivel = o.indivisivel ?? true;
  const borda = (cor = o.corBorda ?? "000000") => ({ style: BorderStyle.SINGLE, size: o.espessura ?? 6, color: cor });
  return new Table({
    width: { size: larguras.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: larguras,
    layout: TableLayoutType.FIXED,
    rows: linhas.map((linha, r) => {
      let col = 0;
      return new TableRow({
        cantSplit: true,
        children: linha.map((c) => {
          const span = c.span ?? 1;
          const w = larguras.slice(col, col + span).reduce((a, b) => a + b, 0);
          col += span;
          const b = borda(c.corBorda);
          return new TableCell({
            width: { size: w, type: WidthType.DXA },
            columnSpan: span > 1 ? span : undefined,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 40, bottom: 40, left: 100, right: 100 },
            shading: c.fundo ? { type: ShadingType.CLEAR, color: "auto", fill: c.fundo } : undefined,
            borders: { top: b, bottom: b, left: b, right: b },
            children: (c.pars.length ? c.pars : [par("")]).map((p, k, todos) =>
              paragrafo(p, indivisivel && (r < linhas.length - 1 || k < todos.length - 1), size))
          });
        })
      });
    })
  });
}

/** Faixa de uma célula na largura útil (tarjas amarela/vermelha, avisos). */
export const tarja = (pars: Par[], o: { fundo?: string; corBorda?: string; espessura?: number; size?: number } = {}) =>
  tabela([[{ pars, fundo: o.fundo, corBorda: o.corBorda }]], [PAGINA.util], { corBorda: o.corBorda, espessura: o.espessura ?? 12, size: o.size });

export const espaco = (depois = 120) => new Paragraph({ spacing: { before: 0, after: depois }, children: [] });

/** Cabeçalho de página: selo redondo PIEGGI (~70×70 px) no canto superior esquerdo + títulos. */
export function cabecalho(titulo: string, subtitulo: string, cor = "000000"): Header {
  const semBorda = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const bordas = { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda };
  return new Header({
    children: [new Table({
      width: { size: PAGINA.util, type: WidthType.DXA }, columnWidths: [1300, PAGINA.util - 1300], layout: TableLayoutType.FIXED,
      borders: { ...bordas, insideHorizontal: semBorda, insideVertical: semBorda },
      rows: [new TableRow({
        cantSplit: true,
        children: [
          new TableCell({ width: { size: 1300, type: WidthType.DXA }, borders: bordas, verticalAlign: VerticalAlign.CENTER, children: [
            new Paragraph({ children: [new ImageRun({ type: "png", data: asset("selo-pieggi.png"), transformation: { width: 70, height: 70 }, altText: { name: "Pieggi", description: "Selo Pieggi", title: "Pieggi" } })] })
          ] }),
          new TableCell({ width: { size: PAGINA.util - 1300, type: WidthType.DXA }, borders: bordas, verticalAlign: VerticalAlign.CENTER, children: [
            new Paragraph({ children: [new TextRun({ text: titulo, bold: true, size: 26, color: cor, font: "Arial" })] }),
            new Paragraph({ children: [new TextRun({ text: subtitulo, size: 20, color: "404040", font: "Arial" })] })
          ] })
        ]
      })]
    })]
  });
}

/** Seção A4 com margens de 720 DXA; borda de página colorida opcional (comanda). */
export function secao(header: Header, children: ISectionOptions["children"], corBorda?: string): ISectionOptions {
  const b = corBorda ? { style: BorderStyle.SINGLE, size: 24, color: corBorda, space: 18 } : undefined;
  return {
    properties: {
      page: {
        size: { width: PAGINA.largura, height: PAGINA.altura },
        margin: { top: PAGINA.margem, right: PAGINA.margem, bottom: PAGINA.margem, left: PAGINA.margem, header: 360, footer: 360 },
        borders: b ? { pageBorders: { offsetFrom: PageBorderOffsetFrom.PAGE }, pageBorderTop: b, pageBorderRight: b, pageBorderBottom: b, pageBorderLeft: b } : undefined
      }
    },
    headers: { default: header },
    children
  };
}

export const ESTILOS = { default: { document: { run: { font: "Arial", size: 24 } } } };
