// Proposta comercial (§5) em .pptx. O template oficial não está disponível: layout preto/branco Pieggi com
// TODAS as medidas e cores em LAYOUT_PROPOSTA, para trocar pelo template depois sem mexer no conteúdo.
import PptxGenJS from "pptxgenjs";
import type { CardapioProposta, LinhaOrcamento, PropostaDoc } from "./tipos";
import { CONTATO_COMERCIAL, asset, dataLonga, moeda, type Asset } from "./comum";

export const LAYOUT_PROPOSTA = {
  slide: { w: 10, h: 5.625 },          // 16:9, polegadas
  margem: 0.35,
  painel: { w: 2.4 },                   // faixa preta à esquerda nos slides de conteúdo
  cor: { preto: "000000", branco: "FFFFFF", cinza: "F2F2F2", cinzaRotulo: "A6A6A6", texto: "222222", suave: "595959" },
  fonte: { titulo: "Georgia", corpo: "Arial" },
  tamanho: { titulo: 26, corpo: 12, min: 8, descricao: 10 },
  tarja: { w: 2.4, proporcao: 1260 / 420 },
  simbolo: { proporcao: 700 / 672 },
  selo: { proporcao: 546 / 545 }
} as const;
const L = LAYOUT_PROPOSTA;

const img = (nome: Asset) => `${nome.endsWith(".png") ? "image/png" : "image/jpeg"};base64,${asset(nome).toString("base64")}`;
const valor = (c: number | null) => (c === null ? "—" : moeda(c));
const conteudoX = L.painel.w + L.margem, conteudoW = L.slide.w - conteudoX - L.margem;

/** Linhas estimadas de um texto numa largura (pol.) com fonte de `pt` (Arial ≈ 0,5 em por caractere). */
const linhasTexto = (t: string, larguraPol: number, pt: number) =>
  t.split("\n").reduce((a, l) => a + Math.max(1, Math.ceil(l.length / Math.max(1, (larguraPol * 144) / pt))), 0);
const alturaLinha = (linhas: number, pt: number) => linhas * pt * 1.2 / 72 + 0.1;

/** Slides na ordem; usado também pela validação para saber quantos esperar. */
export function estruturaDeck(p: PropostaDoc): string[] {
  return p.formato === "POCKET"
    ? ["capa", "dados", "orcamento", "contracapa"]
    : ["capa", "institucional", "dados", "orcamento", ...p.cardapios.map((_, i) => `cardapio-${i}`), "contracapa"];
}

function capa(pptx: PptxGenJS, contato: boolean) {
  const s = pptx.addSlide();
  s.background = { color: L.cor.preto };
  const tw = 3, th = tw / L.tarja.proporcao, tx = (L.slide.w - tw) / 2, ty = (L.slide.h - th) / 2 - (contato ? 0.3 : 0);
  s.addImage({ data: img("tarja-pieggi-branco.png"), x: tx, y: ty, w: tw, h: th });
  const sw = 1.1;
  s.addImage({ data: img("selo-pieggi-branco.png"), x: tx + tw - 0.05, y: ty - 0.35, w: sw, h: sw / L.selo.proporcao, transparency: 40 });
  if (contato) s.addText(`${CONTATO_COMERCIAL.telefone}  ·  ${CONTATO_COMERCIAL.email}  ·  ${CONTATO_COMERCIAL.site}`, {
    x: L.margem, y: L.slide.h - 1.3, w: L.slide.w - 2 * L.margem, h: 0.4, align: "center",
    fontFace: L.fonte.corpo, fontSize: 14, color: L.cor.branco
  });
}

function slideConteudo(pptx: PptxGenJS, titulo: string) {
  const s = pptx.addSlide();
  s.background = { color: L.cor.branco };
  s.addShape("rect", { x: 0, y: 0, w: L.painel.w, h: L.slide.h, fill: { color: L.cor.preto }, line: { color: L.cor.preto } });
  const sw = 1.3;
  s.addImage({ data: img("simbolo-pg-branco.png"), x: (L.painel.w - sw) / 2, y: 0.45, w: sw, h: sw / L.simbolo.proporcao });
  s.addText("CATERING\nCOFFEE &\nEVENTOS.", { x: 0.3, y: 2.2, w: L.painel.w - 0.4, h: 1.6, fontFace: L.fonte.corpo, fontSize: 22, bold: true, color: L.cor.branco, valign: "top" });
  const tw = L.painel.w - 0.6;
  s.addImage({ data: img("tarja-pieggi-branco.png"), x: 0.3, y: L.slide.h - 0.35 - tw / L.tarja.proporcao, w: tw, h: tw / L.tarja.proporcao });
  s.addText(titulo, { x: conteudoX, y: 0.25, w: conteudoW, h: 0.6, fontFace: L.fonte.titulo, fontSize: L.tamanho.titulo, bold: true, italic: true, color: L.cor.preto, align: "center" });
  return s;
}

function institucional(pptx: PptxGenJS) {
  // TEMPLATE: substituir pelos slides institucionais oficiais.
  const s = pptx.addSlide();
  s.background = { color: L.cor.preto };
  const sw = 2.2;
  s.addImage({ data: img("selo-pieggi-branco.png"), x: (L.slide.w - sw) / 2, y: 0.9, w: sw, h: sw / L.selo.proporcao });
  s.addText("CATERING, COFFEE & EVENTOS", { x: L.margem, y: 3.5, w: L.slide.w - 2 * L.margem, h: 0.5, align: "center", fontFace: L.fonte.corpo, fontSize: 20, bold: true, color: L.cor.branco });
  s.addText(CONTATO_COMERCIAL.site, { x: L.margem, y: 4.1, w: L.slide.w - 2 * L.margem, h: 0.4, align: "center", fontFace: L.fonte.corpo, fontSize: 14, color: L.cor.branco });
}

type Celula = PptxGenJS.TableCell;
/** Tabela com altura de linha calculada (fica gravada no arquivo e a validação confere se cabe no slide). */
function tabela(s: PptxGenJS.Slide, linhas: Celula[][], colW: number[], y: number, pt: number) {
  const rowH = linhas.map((l) => Math.max(...l.map((c, i) => alturaLinha(linhasTexto(typeof c.text === "string" ? c.text : (c.text ?? []).map((t) => (typeof t.text === "string" ? t.text : "")).join(""), colW[i]! - 0.1, pt), pt))));
  s.addTable(linhas, { x: conteudoX, y, w: conteudoW, colW, rowH, fontFace: L.fonte.corpo, fontSize: pt, color: L.cor.texto, valign: "middle", border: { type: "solid", pt: 0.75, color: L.cor.cinzaRotulo }, margin: 0.05 });
  return y + rowH.reduce((a, b) => a + b, 0);
}

function dados(pptx: PptxGenJS, p: PropostaDoc) {
  const s = slideConteudo(pptx, "DADOS DO CLIENTE");
  const c = p.cabecalho;
  const linhas: Array<[string, string]> = [
    ["Cliente", c.cliente], ["Evento", c.evento], ["Contato", c.telefoneContato ? `${c.contato} — ${c.telefoneContato}` : c.contato],
    ["Pax", String(c.pax)], ["Data", c.datas.map(dataLonga).join(", ")], ["Horário", `${c.horarioInicio} às ${c.horarioFim}`], ["Endereço", c.endereco]
  ];
  const rot = (t: string): Celula => ({ text: t, options: { bold: true, color: L.cor.branco, fill: { color: L.cor.preto } } });
  const val = (t: string): Celula => ({ text: t, options: { align: "center", fill: { color: L.cor.cinza } } });
  tabela(s, linhas.map(([r, v]) => [rot(r), val(v)]), [1.6, conteudoW - 1.6], 1.05, L.tamanho.corpo);
}

function orcamento(pptx: PptxGenJS, p: PropostaDoc) {
  const s = slideConteudo(pptx, "ORÇAMENTO");
  const total = p.orcamento.length + p.bebidasAlcoolicas.length + p.opcionais.length;
  const pt = total > 12 ? L.tamanho.min : total > 8 ? 10 : L.tamanho.corpo;
  const colW = [conteudoW - 2.6, 0.9, 1.7];
  const cab = (t: string, escuro: boolean): Celula => ({ text: t, options: { bold: true, align: "center", color: escuro ? L.cor.branco : L.cor.preto, fill: { color: escuro ? L.cor.preto : L.cor.cinzaRotulo } } });
  const linha = (l: LinhaOrcamento): Celula[] => [
    { text: l.descritivo }, { text: l.pax === null ? "" : String(l.pax), options: { align: "center" } }, { text: valor(l.valorCentavos), options: { align: "right" } }
  ];
  const linhas: Celula[][] = [[cab("Descritivo", true), cab("PAX", false), cab("Valor", false)], ...p.orcamento.map(linha),
    [{ text: "Total", options: { bold: true } }, { text: "" }, { text: p.totalCentavos === null ? "R$ a definir" : moeda(p.totalCentavos), options: { bold: true, align: "right" } }]];
  let y = tabela(s, linhas, colW, 1.0, pt) + 0.15;
  if (p.bebidasAlcoolicas.length) {
    // Bloco separado: nunca somado à gastronomia.
    y = tabela(s, [[cab("Bebidas alcoólicas (à parte)", true), cab("PAX", false), cab("Valor", false)], ...p.bebidasAlcoolicas.map(linha)], colW, y, pt) + 0.15;
  }
  if (p.opcionais.length) {
    y = tabela(s, [[{ ...cab("Opcionais (não incluídos no total)", true), options: { ...cab("", true).options, colspan: 2 } }, cab("Valor", false)],
      ...p.opcionais.map((o): Celula[] => [{ text: o.descritivo, options: { colspan: 2 } }, { text: o.valorTexto, options: { align: "right" } }])], colW, y, pt) + 0.1;
  }
  if (p.validade) s.addText(`Proposta válida até ${dataLonga(p.validade)}`, { x: conteudoX, y: Math.min(y, L.slide.h - 0.55), w: conteudoW, h: 0.3, fontFace: L.fonte.corpo, fontSize: 9, color: L.cor.suave });
}

function cardapio(pptx: PptxGenJS, c: CardapioProposta) {
  const s = slideConteudo(pptx, c.titulo);
  const larg = conteudoW, alturaDisp = L.slide.h - 1.05 - 0.3;
  const blocos = (pt: number, ptD: number) => {
    const runs: PptxGenJS.TextProps[] = [];
    for (const i of c.itens) {
      runs.push({ text: i.quantidade === null ? i.nome : `${i.nome} — ${i.quantidade} ${i.quantidade === 1 ? "unidade" : "unidades"}`, options: { bold: true, fontSize: pt, breakLine: true } });
      if (i.descricao) runs.push({ text: i.descricao, options: { fontSize: ptD, color: L.cor.suave, breakLine: true } });
    }
    if (c.bebidas.length) {
      runs.push({ text: "Bebidas", options: { bold: true, fontSize: pt, breakLine: true, paraSpaceBefore: 6 } });
      runs.push({ text: c.bebidas.join(" · "), options: { fontSize: ptD, color: L.cor.suave } });
    }
    return runs;
  };
  // Reduz a fonte até a estimativa caber; o PowerPoint ainda encolhe (fit: shrink) se precisar.
  let pt: number = L.tamanho.corpo;
  const altura = (pt: number) => {
    const ptD = Math.max(L.tamanho.min, pt - 2);
    return c.itens.reduce((a, i) => a + linhasTexto(`${i.nome} — ${i.quantidade ?? ""} unidades`, larg, pt) * pt * 1.25 / 72 + (i.descricao ? linhasTexto(i.descricao, larg, ptD) * ptD * 1.25 / 72 : 0), 0)
      + (c.bebidas.length ? (pt + 6 + linhasTexto(c.bebidas.join(" · "), larg, ptD) * ptD) * 1.25 / 72 : 0);
  };
  while (pt > L.tamanho.min && altura(pt) > alturaDisp) pt -= 1;
  s.addText(blocos(pt, Math.max(L.tamanho.min, pt - 2)), { x: conteudoX, y: 1.05, w: larg, h: alturaDisp, valign: "top", fontFace: L.fonte.corpo, color: L.cor.texto, fit: "shrink", paraSpaceAfter: 2 });
}

export async function renderizarProposta(p: PropostaDoc): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "Pieggi"; pptx.company = "Pieggi"; pptx.title = `Proposta - ${p.cabecalho.evento}`;
  for (const passo of estruturaDeck(p)) {
    if (passo === "capa") capa(pptx, false);
    else if (passo === "institucional") institucional(pptx);
    else if (passo === "dados") dados(pptx, p);
    else if (passo === "orcamento") orcamento(pptx, p);
    else if (passo === "contracapa") capa(pptx, true);
    else cardapio(pptx, p.cardapios[Number(passo.split("-")[1])]!);
  }
  return Buffer.from((await pptx.write({ outputType: "nodebuffer" })) as Uint8Array);
}
