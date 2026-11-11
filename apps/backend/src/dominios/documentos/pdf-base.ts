// Base dos PDFs (pdf-lib): toda primitiva desenhada passa por aqui e registra seus limites, para a
// validação automática (§12) conferir margem e fonte mínima a partir do próprio arquivo.
import { PDFDocument, PDFFont, PDFHexString, PDFImage, PDFName, PDFPage, StandardFonts, popGraphicsState, pushGraphicsState, rgb, setCharacterSqueeze, type Color } from "pdf-lib";

export const A4: [number, number] = [595.28, 841.89];
export const CHAVE_RENDER = "PieggiRender";

export interface RegistroPagina {
  w: number; h: number;
  /** [xMin, yMin, xMax, yMax] de tudo que foi desenhado. */
  limites: [number, number, number, number] | null;
  problemas: string[];
  /** Todo texto desenhado (para conferir palavras proibidas). */
  textos: string[];
}
export interface RegistroRender { margem: number; paginas: RegistroPagina[] }

export const hex = (h: string): Color => {
  const n = parseInt(h.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

/** squeeze = escala horizontal em % (100 = normal). */
export interface OpcoesTexto { x: number; y: number; size: number; font: PDFFont; color?: Color; maxWidth?: number; minSize?: number; squeeze?: number }

export class TelaPdf {
  private paginas = new Map<PDFPage, RegistroPagina>();
  private conjuntos = new Map<PDFFont, Set<number>>();
  private constructor(readonly doc: PDFDocument, readonly margem: number) {}

  static async criar(margem: number, titulo: string) {
    const doc = await PDFDocument.create();
    doc.setTitle(titulo); doc.setAuthor("Pieggi"); doc.setProducer("Pieggi"); doc.setCreator("Pieggi");
    return new TelaPdf(doc, margem);
  }

  fonte(f: StandardFonts) { return this.doc.embedFont(f); }

  novaPagina(tam: [number, number] = A4): PDFPage {
    const p = this.doc.addPage(tam);
    this.paginas.set(p, { w: tam[0], h: tam[1], limites: null, problemas: [], textos: [] });
    return p;
  }

  private reg(p: PDFPage) { const r = this.paginas.get(p); if (!r) throw new Error("Página fora da TelaPdf"); return r; }
  private marcar(p: PDFPage, x0: number, y0: number, x1: number, y1: number) {
    const r = this.reg(p);
    const l = r.limites;
    r.limites = l ? [Math.min(l[0], x0), Math.min(l[1], y0), Math.max(l[2], x1), Math.max(l[3], y1)] : [x0, y0, x1, y1];
  }
  problema(p: PDFPage, msg: string) { this.reg(p).problemas.push(msg); }

  /** Remove o que a fonte padrão (WinAnsi) não codifica, trocando os casos conhecidos. */
  limpar(texto: string, font: PDFFont): string {
    let set = this.conjuntos.get(font);
    if (!set) { set = new Set(font.getCharacterSet()); this.conjuntos.set(font, set); }
    const t = texto.replace(/☐/g, "[ ]").replace(/→/g, "->").replace(/≈/g, "~").replace(/[\u2009\u202f\u00a0]/g, " ");
    return [...t].filter((c) => set.has(c.codePointAt(0)!)).join("");
  }

  largura(texto: string, font: PDFFont, size: number) { return font.widthOfTextAtSize(this.limpar(texto, font), size); }

  texto(p: PDFPage, texto: string, o: OpcoesTexto) {
    const t = this.limpar(texto, o.font);
    const sq = o.squeeze ?? 100;
    const w = o.font.widthOfTextAtSize(t, o.size) * sq / 100;
    if (o.minSize !== undefined && o.size < o.minSize - 1e-6) this.problema(p, `fonte ${o.size.toFixed(1)}pt abaixo do mínimo ${o.minSize}pt: "${t}"`);
    if (o.maxWidth !== undefined && w > o.maxWidth + 0.5) this.problema(p, `texto estoura a largura (${w.toFixed(1)} > ${o.maxWidth.toFixed(1)}): "${t}"`);
    if (sq !== 100) p.pushOperators(pushGraphicsState(), setCharacterSqueeze(sq));
    p.drawText(t, { x: o.x, y: o.y, size: o.size, font: o.font, color: o.color ?? rgb(0, 0, 0) });
    if (sq !== 100) p.pushOperators(popGraphicsState());
    this.reg(p).textos.push(t);
    const alto = o.font.heightAtSize(o.size, { descender: false });
    this.marcar(p, o.x, o.y - (o.font.heightAtSize(o.size) - alto), o.x + w, o.y + alto);
    return w;
  }

  retangulo(p: PDFPage, x: number, y: number, w: number, h: number, o: { cor?: Color; borda?: Color; espessura?: number } = {}) {
    p.drawRectangle({ x, y, width: w, height: h, color: o.cor, borderColor: o.borda, borderWidth: o.borda ? (o.espessura ?? 0.5) : 0 });
    this.marcar(p, x, y, x + w, y + h);
  }

  linha(p: PDFPage, x0: number, y0: number, x1: number, y1: number, o: { cor?: Color; espessura?: number; tracejado?: number[] } = {}) {
    p.drawLine({ start: { x: x0, y: y0 }, end: { x: x1, y: y1 }, thickness: o.espessura ?? 0.5, color: o.cor ?? rgb(0, 0, 0), dashArray: o.tracejado });
    this.marcar(p, Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1));
  }

  elipse(p: PDFPage, x: number, y: number, rx: number, ry: number, o: { cor?: Color; borda?: Color; espessura?: number } = {}) {
    p.drawEllipse({ x, y, xScale: rx, yScale: ry, color: o.cor, borderColor: o.borda, borderWidth: o.borda ? (o.espessura ?? 1) : 0 });
    this.marcar(p, x - rx, y - ry, x + rx, y + ry);
  }

  /** Desenha caminho SVG (coordenadas com y para baixo a partir de x,y). Limites informados pelo chamador. */
  caminho(p: PDFPage, d: string, x: number, y: number, caixa: [number, number, number, number], o: { cor?: Color; borda?: Color; espessura?: number; escala?: number } = {}) {
    p.drawSvgPath(d, { x, y, scale: o.escala ?? 1, color: o.cor, borderColor: o.borda, borderWidth: o.borda ? (o.espessura ?? 1) : 0 });
    this.marcar(p, ...caixa);
  }

  imagem(p: PDFPage, img: PDFImage, x: number, y: number, w: number, h: number) {
    p.drawImage(img, { x, y, width: w, height: h });
    this.marcar(p, x, y, x + w, y + h);
  }

  /** Grava o registro no catálogo do PDF e serializa. */
  async salvar(): Promise<Buffer> {
    const reg: RegistroRender = { margem: this.margem, paginas: this.doc.getPages().map((p) => this.reg(p)) };
    this.doc.catalog.set(PDFName.of(CHAVE_RENDER), PDFHexString.fromText(JSON.stringify(reg)));
    return Buffer.from(await this.doc.save());
  }
}

/** Quebra texto em linhas que cabem em `largura`; palavra maior que a linha é cortada por caractere. */
export function quebrarLinhas(texto: string, largura: number, medir: (s: string) => number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split("\n")) {
    let atual = "";
    for (let palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      while (medir(palavra) > largura && palavra.length > 1) {
        if (atual) { linhas.push(atual); atual = ""; }
        let n = palavra.length;
        while (n > 1 && medir(palavra.slice(0, n)) > largura) n--;
        linhas.push(palavra.slice(0, n)); palavra = palavra.slice(n);
      }
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (medir(tentativa) <= largura) atual = tentativa;
      else { if (atual) linhas.push(atual); atual = palavra; }
    }
    linhas.push(atual);
  }
  return linhas;
}
