import JSZip from "jszip";

/** .xlsx mínimo com uma aba para testes; `null` = célula vazia, número = célula numérica. */
export async function planilhaTeste(aba: string, linhas: Array<Array<string | number | null>>): Promise<Buffer> {
  const z = new JSZip();
  const col = (i: number) => String.fromCharCode(65 + i);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const xml = linhas.map((l, r) => `<row r="${r + 1}">${l.map((v, i) => v === null ? "" : typeof v === "number"
    ? `<c r="${col(i)}${r + 1}"><v>${v}</v></c>` : `<c r="${col(i)}${r + 1}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`).join("")}</row>`).join("");
  z.file("xl/workbook.xml", `<workbook xmlns:r="r"><sheets><sheet name="${aba}" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  z.file("xl/_rels/workbook.xml.rels", `<Relationships><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/></Relationships>`);
  z.file("xl/worksheets/sheet1.xml", `<worksheet><sheetData>${xml}</sheetData></worksheet>`);
  return Buffer.from(await z.generateAsync({ type: "uint8array" }));
}

export const CABECALHO_FISCAL = ["#", "PRODUTO", "GRUPO", "NCM", "DESCRIÇÃO NCM", "CATEGORIA FISCAL", "CFOP", "CST ICMS", "ALÍQ. ICMS", "BC ICMS", "OBSERVAÇÃO ICMS",
  "CST PIS", "ALÍQ. PIS", "CST COFINS", "ALÍQ. COFINS", "CEST", "ORIGEM", "CUSTO DO PRODUTO (R$)", "PREÇO DE VENDA (R$)"];
