// Validação automática de render (§12), sem LibreOffice: confere invariantes estruturais direto no arquivo.
// "Documento que falha na validação não chega ao usuário" → gerarDocumentoValidado lança DocumentoInvalidoError.
import JSZip from "jszip";
import { PDFDocument, PDFHexString, PDFName, PDFString } from "pdf-lib";
import { nomeArquivo, type Comanda, type Plaquinhas, type Programacao, type PropostaDoc } from "./tipos";
import { CHAVE_RENDER, type RegistroRender } from "./pdf-base";
import { PAGINA } from "./docx-base";
import { renderizarProgramacao, type TextosProgramacao } from "./programacao-docx";
import { paginasVisiveis, renderizarComanda } from "./comanda-docx";
import { montarCelulas, renderizarPlaquinhas } from "./plaquinha-pdf";
import { estruturaDeck, renderizarProposta } from "./proposta-pptx";

export type TipoDocumento = "PROGRAMACAO" | "COMANDA" | "PLAQUINHA" | "PROPOSTA" | "PDF";
export interface Esperado {
  /** docx: páginas lógicas (seções + quebras forçadas); pdf: páginas físicas. */
  paginas?: number;
  slides?: number;
  /** Palavras/expressões que não podem aparecer no texto (além das fixas por tipo). */
  proibidas?: string[];
}

const DIA_SEMANA = /\b(segunda|terça|terca|quarta|quinta|sexta)(-feira)?\s*,|\b(segunda|terça|terca|quarta|quinta|sexta)-feira\b|\bsábado\b|\bsabado\b|\bdomingo\b/i;
const PROIBIDAS: Record<TipoDocumento, string[]> = {
  PROGRAMACAO: ["Chef decide", "Confeiteiro decide"],
  COMANDA: ["Chef decide", "Confeiteiro decide"],
  PLAQUINHA: ["cumbuca", "bebezinho", "VEGANO"],
  PROPOSTA: ["CMV"],
  PDF: []
};
const TOL = 0.5;

function textoProibido(tipo: TipoDocumento, texto: string, extras: string[] = []): string[] {
  const out: string[] = [];
  if (DIA_SEMANA.test(texto)) out.push(`dia da semana no texto: "${texto.match(DIA_SEMANA)![0]}"`);
  for (const w of [...PROIBIDAS[tipo], ...extras]) {
    if (new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}])`, "iu").test(texto)) out.push(`texto proibido: "${w}"`);
  }
  return out;
}

const decodificar = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const blocos = (xml: string, tag: string) => xml.match(new RegExp(`<${tag}[ >][\\s\\S]*?</${tag}>`, "g")) ?? [];

async function validarDocx(tipo: TipoDocumento, buf: Buffer, e: Esperado): Promise<string[]> {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) return ["docx sem word/document.xml"];
  const p: string[] = [];
  const secoes = xml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/g) ?? [];
  secoes.forEach((s, i) => {
    const sz = s.match(/<w:pgSz [^>]*>/)?.[0] ?? "";
    if (!sz.includes(`w:w="${PAGINA.largura}"`) || !sz.includes(`w:h="${PAGINA.altura}"`)) p.push(`seção ${i + 1}: página não é A4 (${sz})`);
    const mar = s.match(/<w:pgMar [^>]*>/)?.[0] ?? "";
    for (const lado of ["top", "right", "bottom", "left"]) if (!mar.includes(`w:${lado}="${PAGINA.margem}"`)) p.push(`seção ${i + 1}: margem ${lado} diferente de ${PAGINA.margem}`);
  });
  const logicas = secoes.length + (xml.match(/<w:pageBreakBefore\/>/g) ?? []).length;
  if (e.paginas !== undefined && logicas !== e.paginas) p.push(`páginas lógicas: ${logicas}, esperado ${e.paginas}`);
  // Tabelas indivisíveis: toda linha cantSplit e todo parágrafo (exceto da última linha) keepNext.
  blocos(xml, "w:tbl").forEach((tbl, t) => {
    const linhas = blocos(tbl, "w:tr");
    linhas.forEach((tr, r) => {
      if (!tr.includes("<w:cantSplit/>")) p.push(`tabela ${t + 1}, linha ${r + 1}: sem cantSplit`);
      if (r < linhas.length - 1) {
        const pars = (tr.match(/<w:p[ >]/g) ?? []).length, keep = (tr.match(/<w:keepNext\/>/g) ?? []).length;
        if (keep < pars) p.push(`tabela ${t + 1}, linha ${r + 1}: sem keepNext (a tabela pode quebrar no meio)`);
      }
    });
  });
  for (const m of xml.matchAll(/<w:sz w:val="(\d+)"\/>/g)) if (Number(m[1]) < 18) { p.push(`fonte de ${Number(m[1]) / 2} pt abaixo do mínimo de 9 pt`); break; }
  const texto = blocos(xml, "w:p").map((par) => decodificar([...par.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(""))).join("\n");
  p.push(...textoProibido(tipo, texto, e.proibidas));
  if (tipo === "PROGRAMACAO" && /\b\d{2}\/\d{2}\/\d{4}\b/.test(texto)) p.push("programação com data DD/MM/AAAA (deve ser só DD/MM)");
  // Logo em todas as páginas: todo cabeçalho referenciado precisa ter imagem.
  const refs = [...xml.matchAll(/<w:headerReference [^>]*r:id="([^"]+)"/g)].map((m) => m[1]!);
  const rels = (await zip.file("word/_rels/document.xml.rels")?.async("string")) ?? "";
  if (!refs.length) p.push("documento sem cabeçalho (logo)");
  for (const id of new Set(refs)) {
    const alvo = rels.match(new RegExp(`Id="${id}"[^>]*Target="([^"]+)"`))?.[1] ?? rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${id}"`))?.[1];
    const h = alvo ? await zip.file(`word/${alvo}`)?.async("string") : undefined;
    if (!h?.includes("<w:drawing>")) p.push(`cabeçalho ${alvo ?? id} sem o logo`);
  }
  return p;
}

async function validarPdf(tipo: TipoDocumento, buf: Buffer, e: Esperado): Promise<string[]> {
  const doc = await PDFDocument.load(buf);
  const p: string[] = [];
  if (e.paginas !== undefined && doc.getPageCount() !== e.paginas) p.push(`páginas: ${doc.getPageCount()}, esperado ${e.paginas}`);
  const bruto = doc.catalog.lookup(PDFName.of(CHAVE_RENDER));
  if (!(bruto instanceof PDFHexString || bruto instanceof PDFString)) return [...p, "PDF sem registro de render (não foi gerado pela TelaPdf)"];
  const reg = JSON.parse(bruto.decodeText()) as RegistroRender;
  const textos: string[] = [];
  reg.paginas.forEach((pg, i) => {
    const real = doc.getPage(i).getSize();
    if (Math.abs(real.width - 595.28) > 1 || Math.abs(real.height - 841.89) > 1) p.push(`página ${i + 1}: não é A4`);
    const [x0, y0, x1, y1] = pg.limites ?? [reg.margem, reg.margem, reg.margem, reg.margem];
    if (x0 < reg.margem - TOL || y0 < reg.margem - TOL || x1 > pg.w - reg.margem + TOL || y1 > pg.h - reg.margem + TOL) {
      p.push(`página ${i + 1}: conteúdo fora da margem de ${reg.margem} pt (${[x0, y0, x1, y1].map((n) => n.toFixed(1)).join(", ")})`);
    }
    pg.problemas.forEach((m) => p.push(`página ${i + 1}: ${m}`));
    textos.push(...pg.textos);
  });
  const texto = textos.join("\n");
  p.push(...textoProibido(tipo, texto, e.proibidas));
  if (tipo === "PLAQUINHA") {
    const site = textos.filter((t) => t === "VISITE NOSSO SITE").length;
    if (site !== 2) p.push(`par "Visite nosso site" deve aparecer exatamente 2 vezes (achou ${site})`);
  }
  return p;
}

async function validarPptx(tipo: TipoDocumento, buf: Buffer, e: Esperado): Promise<string[]> {
  const zip = await JSZip.loadAsync(buf);
  const p: string[] = [];
  const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  if (e.slides !== undefined && slides.length !== e.slides) p.push(`slides: ${slides.length}, esperado ${e.slides}`);
  const pres = (await zip.file("ppt/presentation.xml")?.async("string")) ?? "";
  const cx = Number(pres.match(/<p:sldSz cx="(\d+)"/)?.[1]), cy = Number(pres.match(/<p:sldSz [^>]*cy="(\d+)"/)?.[1]);
  const textos: string[] = [];
  for (const [i, f] of slides.entries()) {
    const xml = (await zip.file(f)!.async("string"));
    const n = i + 1;
    // Toda forma dentro do slide; tabela pela soma real das alturas de linha.
    for (const m of xml.matchAll(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/g)) {
      const [x, y, w, h] = m.slice(1).map(Number) as [number, number, number, number];
      if (x < 0 || y < 0 || x + w > cx + 1 || y + h > cy + 1) p.push(`slide ${n}: elemento fora do slide`);
    }
    for (const g of blocos(xml, "p:graphicFrame")) {
      const y = Number(g.match(/<a:off x="-?\d+" y="(-?\d+)"/)?.[1] ?? 0);
      const alt = [...g.matchAll(/<a:tr h="(\d+)"/g)].reduce((a, m) => a + Number(m[1]), 0);
      if (y + alt > cy + 1) p.push(`slide ${n}: tabela passa do rodapé do slide`);
    }
    for (const m of xml.matchAll(/ sz="(\d+)"/g)) if (Number(m[1]) < 800) { p.push(`slide ${n}: fonte de ${Number(m[1]) / 100} pt abaixo de 8 pt`); break; }
    textos.push(...[...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodificar(m[1]!)));
  }
  p.push(...textoProibido(tipo, textos.join("\n"), e.proibidas));
  return p;
}

/** Confere o arquivo gerado. Lista vazia = aprovado. */
export async function validarDocumento(tipo: TipoDocumento, buffer: Buffer, esperado: Esperado = {}): Promise<string[]> {
  try {
    if (tipo === "PROGRAMACAO" || tipo === "COMANDA") return await validarDocx(tipo, buffer, esperado);
    if (tipo === "PROPOSTA") return await validarPptx(tipo, buffer, esperado);
    return await validarPdf(tipo, buffer, esperado);
  } catch (e) {
    return [`arquivo ilegível: ${(e as Error).message}`];
  }
}

export class DocumentoInvalidoError extends Error {
  constructor(readonly tipo: TipoDocumento, readonly problemas: string[]) {
    super(`Documento ${tipo} reprovado na validação: ${problemas.join("; ")}`);
    this.name = "DocumentoInvalidoError";
  }
}

export type PedidoDocumento =
  | { tipo: "PROGRAMACAO"; dados: Programacao; textos?: TextosProgramacao }
  | { tipo: "COMANDA"; dados: Comanda }
  | { tipo: "PLAQUINHA"; dados: Plaquinhas }
  | { tipo: "PROPOSTA"; dados: PropostaDoc };
export interface DocumentoGerado { nome: string; mime: string; buffer: Buffer }

const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pdf: "application/pdf"
} as const;

/** Gera, valida e devolve o arquivo com o nome padrão; lança DocumentoInvalidoError se reprovar. */
export async function gerarDocumentoValidado(pedido: PedidoDocumento): Promise<DocumentoGerado> {
  let buffer: Buffer, esperado: Esperado, nome: string, mime: string;
  switch (pedido.tipo) {
    case "PROGRAMACAO":
      buffer = await renderizarProgramacao(pedido.dados, pedido.textos);
      esperado = { paginas: Math.max(1, new Set(pedido.dados.servicos.map((s) => s.data)).size) };
      nome = nomeArquivo("Programacao", pedido.dados.cabecalho, "docx"); mime = MIME.docx;
      break;
    case "COMANDA":
      buffer = await renderizarComanda(pedido.dados);
      esperado = { paginas: paginasVisiveis(pedido.dados).length + 1 };
      nome = nomeArquivo("Comanda", pedido.dados.cabecalho, "docx"); mime = MIME.docx;
      break;
    case "PLAQUINHA":
      buffer = await renderizarPlaquinhas(pedido.dados);
      esperado = { paginas: montarCelulas(pedido.dados).length };
      nome = nomeArquivo("Plaquinha", pedido.dados.cabecalho, "pdf"); mime = MIME.pdf;
      break;
    case "PROPOSTA":
      buffer = await renderizarProposta(pedido.dados);
      // StartSe: sem valor por pessoa e sem nome de linha Pieggi (§5).
      esperado = { slides: estruturaDeck(pedido.dados).length, proibidas: pedido.dados.cabecalho.clienteChave === "STARTSE" ? ["Standard", "Executive", "Master", "por pessoa"] : [] };
      nome = nomeArquivo("Proposta", pedido.dados.cabecalho, "pptx"); mime = MIME.pptx;
      break;
  }
  const problemas = await validarDocumento(pedido.tipo, buffer, esperado);
  if (problemas.length) throw new DocumentoInvalidoError(pedido.tipo, problemas);
  return { nome, mime, buffer };
}
