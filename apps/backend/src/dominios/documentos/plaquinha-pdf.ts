// Plaquinhas trilíngues (§8): A4 em grade 2×3, cortes pontilhados, dobra 50/50 — metade de cima 100% branca,
// todo conteúdo na metade de baixo, empurrado para baixo. Só desenha o que o motor mandou nos cards.
import QRCode from "qrcode";
import { type PDFFont, type PDFImage, type PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { CardPlaquinha, Plaquinhas, Selo, SeloExtra } from "./tipos";
import { A4, TelaPdf, hex, quebrarLinhas } from "./pdf-base";
import { SITE_URL, asset } from "./comum";

export const FOLD_RATIO = 0.5;
export const CONTENT_RATIO = 0.5;
const MM = 72 / 25.4;
const MARGEM = 18;                 // ~6 mm: área segura de impressão
const COLS = 2, LINS = 3;
const PAD_INF = 2.5 * MM;          // padding da borda inferior
const PAD_LAT = 10, FOLGA_DOBRA = 6, VAO = 8;
// Proporções exigidas pelo §8 (largura/altura).
const TARJA = 1260 / 420, SIMBOLO = 700 / 672, SELO_VEGETARIANO = 616 / 644, SELO_VEGANO = 588 / 588;
const SELO_H = 22;
export const TIPO = {
  titulo: { base: 18, min: 13, max: 3 },
  subtitulo: { base: 10, min: 9 },
  idioma: { size: 8, squeezeMin: 70, cor: "#555555" }
} as const;

type Celula = { tipo: "card"; card: CardPlaquinha } | { tipo: "site" } | { tipo: "vazia" };

/** Células na ordem de impressão, com quebra de página entre dias e o par do site no fim. */
export function montarCelulas(p: Plaquinhas): Celula[][] {
  const dias = p.dias.filter((d) => d.cards.length > 0).map((d) => d.cards.map((card): Celula => ({ tipo: "card", card })));
  if (dias.length === 0) dias.push([]);
  const ultimo = dias[dias.length - 1]!;
  if (ultimo.length % 2 === 1) ultimo.push({ tipo: "vazia" });
  ultimo.push({ tipo: "site" }, { tipo: "site" });
  const paginas: Celula[][] = [];
  for (const dia of dias) for (let i = 0; i < dia.length; i += COLS * LINS) paginas.push(dia.slice(i, i + COLS * LINS));
  return paginas;
}

interface Ctx {
  tela: TelaPdf; bold: PDFFont; obliq: PDFFont; boldPlain: PDFFont;
  tarja: PDFImage; simbolo: PDFImage; qr: QRCode.QRCode;
}

export async function renderizarPlaquinhas(p: Plaquinhas): Promise<Buffer> {
  const tela = await TelaPdf.criar(MARGEM, `Plaquinhas - ${p.cabecalho.evento}`);
  const ctx: Ctx = {
    tela,
    bold: await tela.fonte(StandardFonts.HelveticaBoldOblique),
    obliq: await tela.fonte(StandardFonts.HelveticaOblique),
    boldPlain: await tela.fonte(StandardFonts.HelveticaBold),
    tarja: await tela.doc.embedPng(asset("tarja-pieggi-branco.png")),
    simbolo: await tela.doc.embedJpg(asset("simbolo-pg.jpg")),
    qr: QRCode.create(SITE_URL, { errorCorrectionLevel: "M" })
  };
  const [W, H] = A4;
  const cw = (W - 2 * MARGEM) / COLS, ch = (H - 2 * MARGEM) / LINS;
  for (const celulas of montarCelulas(p)) {
    const pg = tela.novaPagina();
    celulas.forEach((c, i) => {
      const x = MARGEM + (i % COLS) * cw, y = H - MARGEM - (Math.floor(i / COLS) + 1) * ch;
      if (c.tipo === "card") desenharCard(ctx, pg, c.card, x, y, cw, ch);
      else if (c.tipo === "site") desenharSite(ctx, pg, x, y, cw, ch);
    });
    // Cortes pontilhados: contorno + divisões da grade.
    const cor = hex("#9E9E9E"), tracejado = [3, 3];
    for (let k = 0; k <= COLS; k++) tela.linha(pg, MARGEM + k * cw, MARGEM, MARGEM + k * cw, H - MARGEM, { cor, tracejado });
    for (let k = 0; k <= LINS; k++) tela.linha(pg, MARGEM, MARGEM + k * ch, W - MARGEM, MARGEM + k * ch, { cor, tracejado });
  }
  return tela.salvar();
}

/** Coluna esquerda (tarja + símbolo PG), igual em todos os cards. Devolve o topo do logo e a borda direita. */
function colunaMarca(ctx: Ctx, pg: PDFPage, x: number, y: number, ch: number) {
  const dobra = y + ch * FOLD_RATIO;
  const altDisp = ch * CONTENT_RATIO - PAD_INF - FOLGA_DOBRA;
  // tarja + vão + símbolo ocupam a altura disponível; larguras iguais.
  const larg = (altDisp - 6) / (1 / TARJA + 1 / SIMBOLO);
  const hT = larg / TARJA, hS = larg / SIMBOLO;
  const x0 = x + PAD_LAT, base = y + PAD_INF;
  const topo = base + hS + 6 + hT;
  ctx.tela.retangulo(pg, x0, topo - hT, larg, hT, { cor: rgb(0, 0, 0) });
  const insetX = larg * 0.1, insetY = hT * 0.18; // logo branco dentro do retângulo preto
  ctx.tela.imagem(pg, ctx.tarja, x0 + insetX, topo - hT + insetY, larg - 2 * insetX, hT - 2 * insetY);
  ctx.tela.imagem(pg, ctx.simbolo, x0, base, larg, hS);
  if (topo > dobra + 0.01) ctx.tela.problema(pg, "conteúdo cruza a linha de dobra");
  return { topo, direita: x0 + larg, base };
}

function desenharSelo(ctx: Ctx, pg: PDFPage, s: Selo | SeloExtra, xDir: number, topo: number): number {
  const t = ctx.tela, verde = hex("#2E7D32"), branco = rgb(1, 1, 1);
  const h = SELO_H;
  const w = s === "VEGETARIANO" ? h * SELO_VEGETARIANO : s === "VEGANO" ? h * SELO_VEGANO : h;
  const cx = xDir - w / 2, cy = topo - h / 2;
  if (s === "VEGANO" || s === "VEGETARIANO") {
    const vegano = s === "VEGANO";
    t.elipse(pg, cx, cy, w / 2 - 0.6, h / 2 - 0.6, vegano ? { cor: verde } : { cor: branco, borda: verde, espessura: 1.2 });
    const marca = vegano ? branco : verde;
    const letra = vegano ? "VG" : "V";
    const fs = vegano ? 8 : 10;
    const lw = ctx.boldPlain.widthOfTextAtSize(letra, fs);
    t.texto(pg, letra, { x: cx - lw / 2, y: cy - fs * 0.45, size: fs, font: ctx.boldPlain, color: marca });
    // folha: caminho num quadrado 10×10 (y para baixo), no alto à direita da letra
    const e = h / 40, fx = cx + lw / 2 - 1, fy = cy + fs * 0.75;
    t.caminho(pg, "M 0 10 C 0 4 4 0 10 0 C 10 6 6 10 0 10 Z", fx, fy, [fx, fy - 10 * e, fx + 10 * e, fy], { cor: marca, escala: e });
  } else {
    const rot = { SEM_GLUTEN: ["SEM", "GLÚTEN"], SEM_LACTOSE: ["SEM", "LACTOSE"], SEM_ACUCAR: ["SEM", "AÇÚCAR"] }[s];
    t.elipse(pg, cx, cy, w / 2 - 0.6, h / 2 - 0.6, { cor: branco, borda: rgb(0, 0, 0), espessura: 0.9 });
    rot.forEach((r, i) => {
      const fs = 4.2, lw = ctx.boldPlain.widthOfTextAtSize(r, fs);
      t.texto(pg, r, { x: cx - lw / 2, y: cy + (i === 0 ? 0.8 : -4.2), size: fs, font: ctx.boldPlain });
    });
  }
  return w;
}

/** Versões cada vez mais curtas de uma lista de sabores: "A, B, C E D" → "A, B ...E D" → "A ...E D". */
export function variantesLista(texto: string): string[] {
  const out = [texto];
  const m = texto.match(/^(.*\/\s*)?(.*?)\s+(E|e|&|y|Y|and)\s+([^,]+)$/);
  if (!m) return out;
  const [, prefixo = "", corpo = "", conj, ultimo] = m;
  const antes = corpo.split(/,\s*/).filter(Boolean);
  while (antes.length > 1) { antes.pop(); out.push(`${prefixo}${antes.join(", ")} ...${conj} ${ultimo}`); }
  return out;
}

/** Título: quebra em até 3 linhas antes de reduzir; no mínimo, encurta a lista de sabores. */
function ajustarTitulo(texto: string, largura: number, medir: (s: string, size: number) => number, cabeAltura: (linhas: number, size: number) => boolean) {
  for (const t of variantesLista(texto)) {
    for (let size: number = TIPO.titulo.base; size >= TIPO.titulo.min; size -= 0.5) {
      const linhas = quebrarLinhas(t, largura, (s) => medir(s, size));
      if (linhas.length <= TIPO.titulo.max && cabeAltura(linhas.length, size)) return { linhas, size };
    }
  }
  // Não coube nem encurtado: desenha no mínimo e a validação barra o documento.
  return { linhas: quebrarLinhas(texto, largura, (s) => medir(s, TIPO.titulo.min)), size: TIPO.titulo.min as number };
}

function desenharCard(ctx: Ctx, pg: PDFPage, card: CardPlaquinha, x: number, y: number, cw: number, ch: number) {
  const t = ctx.tela;
  const marca = colunaMarca(ctx, pg, x, y, ch);
  const xDir = x + cw - PAD_LAT;
  let xs = xDir;
  for (const s of card.selos) xs -= desenharSelo(ctx, pg, s, xs, marca.topo) + 3;
  const areaX0 = marca.direita + VAO, areaW = xDir - areaX0;
  const areaTopo = card.selos.length ? marca.topo - SELO_H - 4 : marca.topo;
  const areaAlt = areaTopo - marca.base;

  const titulo = card.titulo.toLocaleUpperCase("pt-BR");
  const sub = card.subtitulo ? card.subtitulo.toLocaleUpperCase("pt-BR") : "";
  const lh = (s: number) => s * 1.08;
  // Subtítulo: 1 linha de 10 → 9 pt; senão quebra em 2 no mínimo.
  let subSize: number = TIPO.subtitulo.base;
  while (sub && subSize > TIPO.subtitulo.min && t.largura(sub, ctx.bold, subSize) > areaW) subSize -= 0.5;
  const subLinhas = sub ? quebrarLinhas(sub, areaW, (s) => t.largura(s, ctx.bold, subSize)) : [];
  const altIdiomas = 2 * lh(TIPO.idioma.size) + 3;
  const altFixa = (subLinhas.length ? subLinhas.length * lh(subSize) + 3 : 0) + altIdiomas;
  const tit = ajustarTitulo(titulo, areaW, (s, size) => t.largura(s, ctx.bold, size), (n, size) => n * lh(size) + altFixa <= areaAlt);
  const altTotal = tit.linhas.length * lh(tit.size) + altFixa;
  if (altTotal > areaAlt + 0.5) t.problema(pg, `texto não cabe na plaquinha: "${titulo}"`);
  // Bloco centralizado na vertical da área de texto; nunca acima do topo do logo.
  let yy = Math.min(areaTopo, marca.base + (areaAlt + altTotal) / 2);
  const centro = (s: string, font: PDFFont, size: number, o: { cor?: string; min?: number; squeeze?: number } = {}) => {
    yy -= lh(size);
    const w = t.largura(s, font, size) * (o.squeeze ?? 100) / 100;
    t.texto(pg, s, { x: areaX0 + (areaW - w) / 2, y: yy + size * 0.22, size, font, maxWidth: areaW, minSize: o.min, squeeze: o.squeeze, color: o.cor ? hex(o.cor) : undefined });
  };
  tit.linhas.forEach((l) => centro(l, ctx.bold, tit.size, { min: TIPO.titulo.min }));
  if (subLinhas.length) { yy -= 3; subLinhas.forEach((l) => centro(l, ctx.bold, subSize, { min: TIPO.subtitulo.min })); }
  yy -= 3;
  for (const original of [card.en, card.es]) {
    // EN/ES sempre em 1 linha: comprime na horizontal; no limite da compressão, encurta a lista de sabores.
    const cabe = (s: string) => t.largura(s, ctx.obliq, TIPO.idioma.size) * TIPO.idioma.squeezeMin / 100 <= areaW;
    const idioma = variantesLista(original).find(cabe) ?? original;
    const w = t.largura(idioma, ctx.obliq, TIPO.idioma.size);
    const sq = Math.max(TIPO.idioma.squeezeMin, Math.min(100, Math.floor((areaW / w) * 100)));
    centro(idioma, ctx.obliq, TIPO.idioma.size, { cor: TIPO.idioma.cor, min: TIPO.idioma.size, squeeze: sq });
  }
}

function desenharSite(ctx: Ctx, pg: PDFPage, x: number, y: number, cw: number, ch: number) {
  const t = ctx.tela;
  const marca = colunaMarca(ctx, pg, x, y, ch);
  const areaX0 = marca.direita + VAO, areaW = x + cw - PAD_LAT - areaX0;
  const titulo = "VISITE NOSSO SITE", sub = "pieggi.com.br";
  let ts = 12;
  while (ts > 8 && t.largura(titulo, ctx.bold, ts) > areaW) ts -= 0.5;
  const ss = 10;
  const yTit = marca.topo - ts * 0.8;
  t.texto(pg, titulo, { x: areaX0 + (areaW - t.largura(titulo, ctx.bold, ts)) / 2, y: yTit, size: ts, font: ctx.bold, maxWidth: areaW });
  t.texto(pg, sub, { x: areaX0 + (areaW - t.largura(sub, ctx.bold, ss)) / 2, y: marca.base + 2, size: ss, font: ctx.bold, maxWidth: areaW });
  // QR 270×270 (quadrado) no meio, entre o título e o subtítulo.
  const topoQr = yTit - ts * 0.35 - 4, baseQr = marca.base + ss + 6;
  const lado = Math.min(areaW, topoQr - baseQr);
  const qx = areaX0 + (areaW - lado) / 2, qy = baseQr + (topoQr - baseQr - lado) / 2;
  const n = ctx.qr.modules.size, m = lado / n;
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!ctx.qr.modules.get(r, c)) { c++; continue; }
      const ini = c;
      while (c < n && ctx.qr.modules.get(r, c)) c++;
      t.retangulo(pg, qx + ini * m, qy + lado - (r + 1) * m, (c - ini) * m + 0.05, m + 0.05, { cor: rgb(0, 0, 0) });
    }
  }
}
