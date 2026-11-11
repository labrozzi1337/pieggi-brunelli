import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { comanda, plaquinhas, programacao, propostaCompleta, propostaPocket, propostaStartSe } from "./fixtures";
import { renderizarProgramacao, TEXTOS_PADRAO_PROGRAMACAO } from "./programacao-docx";
import { renderizarComanda } from "./comanda-docx";
import { montarCelulas, renderizarPlaquinhas, variantesLista } from "./plaquinha-pdf";
import { renderizarProposta } from "./proposta-pptx";
import { gerarXlsx } from "./planilha-xlsx";
import { gerarPdfTabela } from "./pdf-tabela";
import { DocumentoInvalidoError, gerarDocumentoValidado, validarDocumento } from "./validacao";
import type { Comanda, Plaquinhas, Programacao, PropostaDoc } from "./tipos";

const docXml = async (b: Buffer) => (await JSZip.loadAsync(b)).file("word/document.xml")!.async("string");
const textoDocx = (xml: string) => [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(" ").replace(/&amp;/g, "&");
const conta = (s: string, sub: string) => s.split(sub).length - 1;
async function textoPptx(b: Buffer) {
  const zip = await JSZip.loadAsync(b);
  const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  return Promise.all(slides.map(async (f) => [...(await zip.file(f)!.async("string")).matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(" ")));
}

describe("programação .docx", () => {
  it("A4, margens 720, tabelas indivisíveis, página 1 com evento + checklist + auditório, datas DD/MM", async () => {
    const b = await renderizarProgramacao(programacao);
    expect(await validarDocumento("PROGRAMACAO", b, { paginas: 2 })).toEqual([]);
    const xml = await docXml(b);
    expect(xml).toContain('<w:gridCol w:w="2900"/><w:gridCol w:w="7566"/>');
    expect(xml).toContain('<w:gridCol w:w="1700"/><w:gridCol w:w="6366"/><w:gridCol w:w="2400"/>');
    expect(xml).toContain('w:fill="D9D9D9"');
    const t = textoDocx(xml);
    expect(t.indexOf("CLIENTE")).toBeLessThan(t.indexOf("CHECKLIST COPEIRAS"));
    expect(t.indexOf("CHECKLIST COPEIRAS")).toBeLessThan(t.indexOf("AUDITÓRIO"));
    expect(t.indexOf("AUDITÓRIO")).toBeLessThan(t.indexOf("COFFEE BREAK DA MANHÃ"));
    expect(t).toContain("+55 11 97603-8194");
    expect(t).toContain("24/11 · 25/11");
    expect(t).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(t).toContain("6,3 L (4 garrafas térmicas)");
    expect(t).toContain("37 un");
  });

  it("textos do checklist vêm das regras quando informados", async () => {
    const b = await renderizarProgramacao(programacao, { ...TEXTOS_PADRAO_PROGRAMACAO, checklistTitulo: "CHECKLIST DAS COPEIRAS (REGRA)" });
    expect(textoDocx(await docXml(b))).toContain("CHECKLIST DAS COPEIRAS (REGRA)");
  });

  it("validação barra 'Chef decide' e dia da semana", async () => {
    const ruim: Programacao = { ...programacao, servicos: [{ ...programacao.servicos[0]!, itens: [{ quantidade: 1, unidade: "UN", receita: "Chef decide a guarnição — segunda-feira", item: "Prato" }] }] };
    const problemas = await validarDocumento("PROGRAMACAO", await renderizarProgramacao(ruim));
    expect(problemas.join("\n")).toMatch(/Chef decide/);
    expect(problemas.join("\n")).toMatch(/dia da semana/);
  });
});

describe("comanda .docx", () => {
  it("multi-dia: uma seção por página com blocos, página vazia some, uma única página da Adriana", async () => {
    const b = await renderizarComanda(comanda);
    expect(await validarDocumento("COMANDA", b, { paginas: 8 })).toEqual([]);
    const xml = await docXml(b);
    expect(conta(xml, "<w:sectPr")).toBe(8);
    for (const cor of ["800020", "B45309", "1F4E79", "595959", "2E7D32"]) expect(xml).toContain(`<w:top w:val="single" w:color="${cor}"`);
    const t = textoDocx(xml);
    expect(conta(t, "DIA E HORÁRIO DA SAÍDA: ______ (perguntar pra Adriana e anotar aqui)")).toBe(7);
    expect(conta(t, "MOTORISTAS: ANTES DE LEVAR")).toBe(3);
    expect(conta(t, "COPEIRAS: antes do início do evento")).toBe(3);
    expect(conta(t, "EXP ☐")).toBe(5);
    expect(conta(t, "COPEIRAS ☐")).toBe(5);
    expect(conta(t, "FINALIZAR CONFORME IMAGEM")).toBe(3);
    expect(t).toContain("☐ 1 pegador + 1 descanso");
    expect(conta(t, "LOCAÇÃO EXTRA")).toBe(1);
    expect(t).toContain("Não solicitado");
    expect(t).toContain("DIA 24/11/2026");
    expect(t).toContain("DIA 25/11/2026");
    expect(t).toContain("Nº de freelancers contratados: ____");
    expect(t).toContain("Verba: R$ 1.234,56");
    expect(xml).toContain('w:fill="FFF200"');
  });

  it("verba zero remove o bloco VERBA; freelancers informados aparecem", async () => {
    const c: Comanda = { ...comanda, adriana: { ...comanda.adriana, verbaCentavos: 0, freelancers: 4, locacoes: ["Forno combinado"] } };
    const t = textoDocx(await docXml(await renderizarComanda(c)));
    expect(t).not.toContain("VERBA");
    expect(t).not.toContain("R$ 0,00");
    expect(t).toContain("Nº de freelancers contratados: 4");
    expect(t).toContain("☐ Forno combinado");
    expect(t).not.toContain("Não solicitado");
  });
});

describe("plaquinha .pdf", () => {
  it("contagem ímpar: célula em branco antes do par do site, quebra entre dias", async () => {
    const paginas = montarCelulas(plaquinhas);
    expect(paginas.map((p) => p.length)).toEqual([6, 1, 6]); // dia 1: 7 cards; dia 2: 3 + vazia + par
    expect(paginas[2]!.map((c) => c.tipo)).toEqual(["card", "card", "card", "vazia", "site", "site"]);
    const b = await renderizarPlaquinhas(plaquinhas);
    expect(await validarDocumento("PLAQUINHA", b, { paginas: 3 })).toEqual([]);
    expect((await PDFDocument.load(b)).getPageCount()).toBe(3);
  });

  it("contagem par não insere célula em branco", () => {
    const p: Plaquinhas = { ...plaquinhas, dias: [{ data: "2026-11-24", cards: plaquinhas.dias[0]!.cards.slice(0, 2) }] };
    expect(montarCelulas(p)[0]!.map((c) => c.tipo)).toEqual(["card", "card", "site", "site"]);
  });

  it("sabor longo encurta a lista mantendo o último", () => {
    expect(variantesLista("A, B, C E D")).toEqual(["A, B, C E D", "A, B ...E D", "A ...E D"]);
    expect(variantesLista("FRUIT SALAD / Kiwi, Mango & Coconut")[1]).toBe("FRUIT SALAD / Kiwi ...& Coconut");
  });

  it("validação barra 'bebezinho' e texto que não cabe nem no mínimo", async () => {
    const p: Plaquinhas = { ...plaquinhas, dias: [{ data: "2026-11-24", cards: [
      { titulo: "BEBEZINHO", subtitulo: "CUP CAKE", en: "CUPCAKE / x", es: "CUPCAKE / x", selos: [] },
      { titulo: "X".repeat(200), subtitulo: null, en: "Y".repeat(200), es: "ok", selos: [] }
    ] }] };
    const problemas = (await validarDocumento("PLAQUINHA", await renderizarPlaquinhas(p), { paginas: 1 })).join("\n");
    expect(problemas).toMatch(/bebezinho/);
    expect(problemas).toMatch(/não cabe|estoura/);
  });
});

describe("proposta .pptx", () => {
  it("POCKET tem 4 slides e Total 'R$ a definir' quando há mais de uma opção", async () => {
    const b = await renderizarProposta(propostaPocket);
    expect(await validarDocumento("PROPOSTA", b, { slides: 4 })).toEqual([]);
    const s = await textoPptx(b);
    expect(s[2]).toContain("R$ a definir");
    expect(s[3]).toContain("+55 11 94683-5321");
    expect(s[3]).toContain("atendimento@pieggi.com.br");
  });

  it("COMPLETO: dados, orçamento com bebida alcoólica separada, um pacote por slide, bebidas por último", async () => {
    const b = await renderizarProposta(propostaCompleta);
    expect(await validarDocumento("PROPOSTA", b, { slides: 7 })).toEqual([]);
    const s = await textoPptx(b);
    expect(s[2]).toContain("Endereço");
    expect(s[3]).toContain("R$ 13.465,36");
    expect(s[3]).toContain("Bebidas alcoólicas (à parte)");
    expect(s[4]).toContain("Mini lanche no pão brioche — frango defumado — 37 unidades");
    expect(s[4]!.trim().endsWith("Água mineral com e sem gás")).toBe(true);
    expect(s[5]).toContain("Filé mignon ao molho roti");
    expect(s[5]).not.toContain("unidades");
  });

  it("StartSe: sem nome de linha Pieggi (validação barra 'Executive')", async () => {
    expect(await validarDocumento("PROPOSTA", await renderizarProposta(propostaStartSe), { slides: 6, proibidas: ["Executive"] })).toEqual([]);
    const ruim: PropostaDoc = { ...propostaStartSe, orcamento: [{ descritivo: "Coffee Executive", pax: 75, porPessoaCentavos: null, valorCentavos: 1 }] };
    await expect(gerarDocumentoValidado({ tipo: "PROPOSTA", dados: ruim })).rejects.toBeInstanceOf(DocumentoInvalidoError);
  });
});

describe("gerarDocumentoValidado", () => {
  it("gera os quatro tipos com o nome padrão", async () => {
    const r = await Promise.all([
      gerarDocumentoValidado({ tipo: "PROPOSTA", dados: propostaCompleta }),
      gerarDocumentoValidado({ tipo: "PROGRAMACAO", dados: programacao }),
      gerarDocumentoValidado({ tipo: "COMANDA", dados: comanda }),
      gerarDocumentoValidado({ tipo: "PLAQUINHA", dados: plaquinhas })
    ]);
    expect(r.map((d) => d.nome)).toEqual([
      "Pieggi Proposta - Banco Neon S.A. - Workshop de Liderança 2026 - Mariana Souza - 24-11-2026.pptx",
      "Pieggi Programacao - Banco Neon S.A. - Workshop de Liderança 2026 - Mariana Souza - 24-11-2026.docx",
      "Pieggi Comanda - Banco Neon S.A. - Workshop de Liderança 2026 - Mariana Souza - 24-11-2026.docx",
      "Pieggi Plaquinha - Banco Neon S.A. - Workshop de Liderança 2026 - Mariana Souza - 24-11-2026.pdf"
    ]);
    // Amostras para conferência humana: GERAR_AMOSTRAS=1 npx vitest run apps/backend/src/dominios/documentos
    if (process.env.GERAR_AMOSTRAS) {
      const dir = path.resolve("docs/amostras");
      mkdirSync(dir, { recursive: true });
      for (const d of r) writeFileSync(path.join(dir, d.nome), d.buffer);
      const s = await gerarDocumentoValidado({ tipo: "PROPOSTA", dados: propostaStartSe });
      writeFileSync(path.join(dir, s.nome), s.buffer);
      const pk = await gerarDocumentoValidado({ tipo: "PROPOSTA", dados: { ...propostaPocket, cabecalho: { ...propostaPocket.cabecalho, evento: "Pocket" } } });
      writeFileSync(path.join(dir, pk.nome), pk.buffer);
      writeFileSync(path.join(dir, "Relatorio freelancers (exemplo).xlsx"), await gerarXlsx([{ nome: "Pagamentos", colunas: ["Nome", "Diárias", "Valor (R$)"], linhas: [["Ana Paula", 2, 360], ["José Carlos", 1, 180]] }]));
      writeFileSync(path.join(dir, "Pedido de compra (exemplo).pdf"), await gerarPdfTabela("Pedido de compra — Pad. Letícia — 24/11/2026", ["Item", "Qtd.", "Unid."], [["Quibe frito", 50, "un"], ["Pão ciabatta", 30, "un"]], ["Total", 80, ""]));
    }
  });
});

describe("planilha e pdf de tabela", () => {
  it("xlsx com abas, cabeçalho e caracteres especiais", async () => {
    const b = await gerarXlsx([
      { nome: "Pagamentos: nov/2026", colunas: ["Nome", "Diárias", "Valor"], linhas: [["Ana & Cia <x>", 2, 360.5], ["José", null, 0]] },
      { nome: "Pagamentos: nov/2026", colunas: ["A"], linhas: [] }
    ]);
    const zip = await JSZip.loadAsync(b);
    const wb = await zip.file("xl/workbook.xml")!.async("string");
    expect(wb).toContain('name="Pagamentos  nov 2026"');
    expect(wb).toContain('name="Pagamentos  nov 2026 (2)"');
    const s1 = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(s1).toContain("Ana &amp; Cia &lt;x&gt;");
    expect(s1).toContain("<v>360.5</v>");
  });

  it("pdf de tabela pagina, repete cabeçalho e não estoura margem", async () => {
    const linhas = Array.from({ length: 120 }, (_, i) => [`Freelancer ${i + 1} com nome razoavelmente comprido para quebrar a linha da célula`, i % 3, (i * 1234.5) / 10]);
    const b = await gerarPdfTabela("Relatório de pagamento de freelancers — novembro/2026", ["Nome", "Diárias", "Valor (R$)"], linhas, ["Total", 120, 99999.99]);
    const n = (await PDFDocument.load(b)).getPageCount();
    expect(n).toBeGreaterThan(1);
    expect(await validarDocumento("PDF", b, { paginas: n })).toEqual([]);
  });
});
