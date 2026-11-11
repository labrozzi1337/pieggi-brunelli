// PDF genérico de tabela (relatório de freelancer, pedido de compra…): logo, título, cabeçalho cinza
// repetido a cada página, linhas que quebram texto e nunca se partem entre páginas, linha de totais.
import { StandardFonts, rgb } from "pdf-lib";
import { A4, TelaPdf, hex, quebrarLinhas } from "./pdf-base";
import { CONTATO_COMERCIAL, asset } from "./comum";

const MARGEM = 36; // 720 DXA = 0,5"
const LOGO = 52;   // ~70 px
const FONTE = 9, LINHA = 11, PAD = 3;

const exibir = (v: string | number | null | undefined) =>
  v === null || v === undefined ? "" : typeof v === "number" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : v;

export async function gerarPdfTabela(titulo: string, colunas: string[], linhas: Array<Array<string | number | null>>, totais?: Array<string | number | null>): Promise<Buffer> {
  const tela = await TelaPdf.criar(MARGEM, titulo);
  const normal = await tela.fonte(StandardFonts.Helvetica);
  const negrito = await tela.fonte(StandardFonts.HelveticaBold);
  const logo = await tela.doc.embedPng(asset("selo-pieggi.png"));
  const [W, H] = A4;
  const util = W - 2 * MARGEM;

  // Larguras: proporcionais ao conteúdo natural (cap 220pt por coluna), escaladas para a largura útil.
  const todas = [colunas, ...linhas, ...(totais ? [totais] : [])];
  const natural = colunas.map((_, i) => Math.min(220, Math.max(30, ...todas.map((l, r) =>
    tela.largura(exibir(l[i]), r === 0 ? negrito : normal, FONTE) + 2 * PAD + 1))));
  const soma = natural.reduce((a, b) => a + b, 0);
  const larg = natural.map((n) => (n / soma) * util);
  const numerica = colunas.map((_, i) => linhas.length > 0 && linhas.every((l) => l[i] === null || typeof l[i] === "number"));

  const celulas = (l: Array<string | number | null>, f = normal) =>
    larg.map((w, i) => quebrarLinhas(exibir(l[i]), w - 2 * PAD, (s) => tela.largura(s, f, FONTE)));
  const alturaDe = (cs: string[][]) => Math.max(1, ...cs.map((c) => c.length)) * LINHA + 2 * PAD;

  let pagina = tela.novaPagina();
  let y = 0;
  const desenharLinha = (cs: string[][], o: { fundo?: string; f?: typeof normal; topo?: boolean } = {}) => {
    const h = alturaDe(cs);
    let x = MARGEM;
    cs.forEach((c, i) => {
      const w = larg[i]!;
      tela.retangulo(pagina, x, y - h, w, h, { cor: o.fundo ? hex(o.fundo) : undefined, borda: hex("#808080"), espessura: 0.4 });
      c.forEach((t, k) => {
        const tw = tela.largura(t, o.f ?? normal, FONTE);
        const tx = numerica[i] && !o.fundo ? x + w - PAD - tw : x + PAD;
        tela.texto(pagina, t, { x: tx, y: y - PAD - (k + 1) * LINHA + 2.5, size: FONTE, font: o.f ?? normal, maxWidth: w - 2 * PAD });
      });
      x += w;
    });
    if (o.topo) tela.linha(pagina, MARGEM, y, MARGEM + util, y, { espessura: 1.2 });
    y -= h;
  };
  const cab = celulas(colunas, negrito);
  const inicioPagina = (primeira: boolean) => {
    y = H - MARGEM;
    tela.imagem(pagina, logo, MARGEM, y - LOGO, LOGO, LOGO);
    const linhasTitulo = quebrarLinhas(primeira ? titulo : `${titulo} (continuação)`, util - LOGO - 12, (s) => tela.largura(s, negrito, 14)).slice(0, 2);
    linhasTitulo.forEach((t, k) => tela.texto(pagina, t, { x: MARGEM + LOGO + 12, y: y - 22 - k * 17, size: 14, font: negrito, maxWidth: util - LOGO - 12 }));
    y -= LOGO + 12;
    desenharLinha(cab, { fundo: "#D9D9D9", f: negrito });
  };
  const rodape = `${CONTATO_COMERCIAL.telefone} · ${CONTATO_COMERCIAL.email} · ${CONTATO_COMERCIAL.site}`;

  inicioPagina(true);
  const corpo: Array<{ cs: string[][]; total?: boolean }> = linhas.map((l) => ({ cs: celulas(l) }));
  if (totais) corpo.push({ cs: celulas(totais, negrito), total: true });
  for (const { cs, total } of corpo) {
    if (y - alturaDe(cs) < MARGEM + 16) { pagina = tela.novaPagina(); inicioPagina(false); }
    desenharLinha(cs, total ? { f: negrito, topo: true } : {});
  }
  const paginas = tela.doc.getPages();
  paginas.forEach((p, i) => {
    tela.texto(p, rodape, { x: MARGEM, y: MARGEM + 3, size: 7, font: normal, color: rgb(0.35, 0.35, 0.35) });
    const n = `${i + 1}/${paginas.length}`;
    tela.texto(p, n, { x: W - MARGEM - tela.largura(n, normal, 7), y: MARGEM + 3, size: 7, font: normal, color: rgb(0.35, 0.35, 0.35) });
  });
  return tela.salvar();
}
