// .xlsx mínimo (SpreadsheetML) montado com jszip: strings inline, cabeçalho em negrito, sem dependência nova.
import JSZip from "jszip";

export type Celula = string | number | null;
export interface Aba { nome: string; colunas: string[]; linhas: Celula[][] }

// eslint-disable-next-line no-control-regex -- remove caracteres de controle proibidos no XML
const esc = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function colunaLetra(i: number): string {
  let s = ""; i += 1;
  while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

function celula(v: Celula, ref: string, estilo = 0): string {
  const s = estilo ? ` s="${estilo}"` : "";
  if (v === null || v === undefined || v === "") return `<c r="${ref}"${s}/>`;
  if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
}

function planilha(a: Aba): string {
  const linhas = [a.colunas, ...a.linhas].map((l, r) =>
    `<row r="${r + 1}">${l.map((v, c) => celula(v, `${colunaLetra(c)}${r + 1}`, r === 0 ? 1 : 0)).join("")}</row>`);
  const larguras = a.colunas.map((c, i) => {
    const max = Math.max(c.length, ...a.linhas.map((l) => String(l[i] ?? "").length));
    return `<col min="${i + 1}" max="${i + 1}" width="${Math.min(60, Math.max(8, max + 2))}" customWidth="1"/>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${larguras ? `<cols>${larguras}</cols>` : ""}<sheetData>${linhas.join("")}</sheetData></worksheet>`;
}

/** Nome de aba válido no Excel: até 31 caracteres, sem []:*?/\ e único. */
function nomesAbas(abas: Aba[]): string[] {
  const usados = new Set<string>();
  return abas.map((a, i) => {
    const base = (a.nome.replace(/[[\]:*?/\\]/g, " ").trim() || `Aba ${i + 1}`).slice(0, 31);
    let n = base, k = 2;
    while (usados.has(n.toLowerCase())) { const suf = ` (${k++})`; n = base.slice(0, 31 - suf.length) + suf; }
    usados.add(n.toLowerCase());
    return n;
  });
}

export async function gerarXlsx(abas: Array<{ nome: string; colunas: string[]; linhas: Array<Array<string | number | null>> }>): Promise<Buffer> {
  if (abas.length === 0) throw new Error("Planilha precisa de ao menos uma aba.");
  const nomes = nomesAbas(abas);
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nomes.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  // Estilo 0 = normal, 1 = negrito com fundo cinza #D9D9D9 (cabeçalho).
  zip.file("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0" fillId="0" borderId="0"/><xf fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`);
  abas.forEach((a, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, planilha(a)));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
