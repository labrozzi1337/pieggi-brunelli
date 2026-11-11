// Catálogo fiscal a partir da planilha revisada pela contabilidade (CONSOLIDADO — Estudo Tributário).
// As colunas são reconhecidas pelo cabeçalho (PRODUTO, NCM, CFOP, CST ICMS…), então a planilha pode ganhar abas ou mudar
// a ordem das colunas. Linha sem NCM fechado (serviço/locação, coberto pela taxa de serviço — ISS, ou NCM em análise)
// fica fora da NF-e modelo 55 e volta em `ignorados` com o motivo.
import { randomUUID } from "node:crypto";
import JSZip from "jszip";
import type { UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import { auditar, ErroOperacao } from "@/dominios/operacao/http";
import type { Sql, Tx } from "@/integrations/banco";

export interface ProdutoPlanilha {
  codigo: string; descricao: string; grupo: string | null; unidade: string; ncm: string; descricao_ncm: string | null; categoria_fiscal: string | null;
  cfop_padrao: string; origem: string; cst_icms: string; aliquota_icms: number; cst_pis: string; aliquota_pis: number; cst_cofins: string; aliquota_cofins: number;
  cest: string | null; observacao_fiscal: string | null; custo_padrao: number | null; preco_venda: number | null; referencia_origem: string;
}
export interface Ignorado { aba: string; linha: number; produto: string; motivo: string }

type Celula = { texto: string; numero: boolean };

const entidades: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" };
const decodificar = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
  e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : entidades[e] ?? m);
const textos = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((t) => decodificar(t[1]!)).join("");
export const normalizar = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().replace(/[^A-Z0-9#]+/g, " ").trim();
const colunaDe = (ref: string) => [...ref.replace(/\d+/g, "")].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

/** Abas da planilha como matrizes de células (linha da planilha → colunas). */
export async function lerAbas(arquivo: Buffer): Promise<Array<{ nome: string; linhas: Map<number, Celula[]> }>> {
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(arquivo); } catch { throw new ErroOperacao("Arquivo não é uma planilha .xlsx válida.", 400); }
  const ler = (caminho: string) => zip.file(caminho)?.async("string");
  const [livro, relacoes, compartilhadas] = await Promise.all([ler("xl/workbook.xml"), ler("xl/_rels/workbook.xml.rels"), ler("xl/sharedStrings.xml")]);
  if (!livro || !relacoes) throw new ErroOperacao("Arquivo não é uma planilha .xlsx válida.", 400);
  const strings = [...(compartilhadas ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textos(m[1]!));
  const alvos = new Map([...relacoes.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [m[0].match(/Id="([^"]+)"/)?.[1], m[0].match(/Target="([^"]+)"/)?.[1]]));
  const abas = [];
  for (const m of livro.matchAll(/<sheet\b[^>]*>/g)) {
    const nome = decodificar(m[0].match(/name="([^"]+)"/)?.[1] ?? "");
    const alvo = alvos.get(m[0].match(/r:id="([^"]+)"/)?.[1]);
    const xml = alvo ? await ler(alvo.startsWith("/") ? alvo.slice(1) : `xl/${alvo}`) : undefined;
    if (!xml) continue;
    const linhas = new Map<number, Celula[]>();
    for (const r of xml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const celulas: Celula[] = [];
      for (const c of r[2]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = c[1]!.match(/r="([A-Z]+\d+)"/)?.[1];
        if (!ref) continue;
        const tipo = c[1]!.match(/t="([^"]+)"/)?.[1];
        const v = c[2]?.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        const texto = tipo === "s" ? strings[Number(v)] ?? "" : tipo === "inlineStr" ? textos(c[2] ?? "") : decodificar(v ?? "");
        celulas[colunaDe(ref)] = { texto: texto.trim(), numero: !tipo || tipo === "n" };
      }
      linhas.set(Number(r[1]), celulas);
    }
    abas.push({ nome, linhas });
  }
  return abas;
}

const PREFIXOS: Record<string, string> = { "COFFEE BREAK": "COF", "HAPPY HOUR": "HAP", "ALMOCO E JANTAR": "ALJ" };
const prefixo = (aba: string) => PREFIXOS[normalizar(aba)] ?? normalizar(aba).replace(/[^A-Z]/g, "").slice(0, 3).padEnd(3, "X");

/** Cabeçalho normalizado → campo. Reconhece pelo início para aceitar "PREÇO DE VENDA (R$)", "ALÍQ. ICMS" etc. */
const COLUNAS: Array<[string, string]> = [
  ["#", "numero"], ["CODIGO", "codigo"], ["PRODUTO", "descricao"], ["GRUPO", "grupo"], ["UNIDADE", "unidade"], ["NCM", "ncm"],
  ["DESCRICAO NCM", "descricao_ncm"], ["CATEGORIA FISCAL", "categoria_fiscal"], ["CFOP", "cfop"], ["CST ICMS", "cst_icms"], ["ALIQ ICMS", "aliq_icms"],
  ["OBSERVACAO ICMS", "observacao"], ["CST PIS", "cst_pis"], ["ALIQ PIS", "aliq_pis"], ["CST COFINS", "cst_cofins"], ["ALIQ COFINS", "aliq_cofins"],
  ["CEST", "cest"], ["ORIGEM", "origem"], ["CUSTO", "custo"], ["PRECO", "preco"]
];
function mapearCabecalho(celulas: Celula[]): Map<string, number> | null {
  const mapa = new Map<string, number>();
  celulas.forEach((c, i) => {
    const h = normalizar(c?.texto ?? "");
    const campo = COLUNAS.find(([nome]) => h === nome || (nome.length > 3 && h.startsWith(nome)))?.[1];
    if (campo && !mapa.has(campo)) mapa.set(campo, i);
  });
  return mapa.has("descricao") && mapa.has("ncm") && mapa.has("cfop") ? mapa : null;
}

/** "4,0% efet." → 4; "0,65%" → 0.65; célula numérica de percentual (0,0065) → 0.65. */
export function percentual(c: Celula | undefined): number | null {
  if (!c?.texto) return null;
  if (c.numero) { const n = Number(c.texto); return Number.isFinite(n) ? (n <= 1 ? Math.round(n * 1e6) / 1e4 : n) : null; }
  const m = c.texto.match(/\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(",", ".")) : null;
}
const valor = (c: Celula | undefined) => {
  if (!c?.texto) return null;
  const n = c.numero ? Number(c.texto) : Number(c.texto.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1e4) / 1e4 : null;
};

export async function lerPlanilhaFiscal(arquivo: Buffer, nomeArquivo: string) {
  const produtos: ProdutoPlanilha[] = [];
  const ignorados: Ignorado[] = [];
  for (const aba of await lerAbas(arquivo)) {
    let cab: Map<string, number> | null = null;
    for (const [linha, celulas] of [...aba.linhas].sort(([a], [b]) => a - b)) {
      if (!cab) { cab = mapearCabecalho(celulas); continue; }
      const t = (campo: string) => { const i = cab!.get(campo); return i === undefined ? "" : celulas[i]?.texto ?? ""; };
      const c = (campo: string) => { const i = cab!.get(campo); return i === undefined ? undefined : celulas[i]; };
      const descricao = t("descricao");
      if (!descricao) continue;
      const ignorar = (motivo: string) => ignorados.push({ aba: aba.nome, linha, produto: descricao, motivo });
      const ncm = /^[\d.\s]+$/.test(t("ncm")) ? t("ncm").replace(/\D/g, "") : "";
      if (ncm.length !== 8) { ignorar(/servi|loca/i.test(`${t("categoria_fiscal")} ${t("descricao_ncm")}`) ? "Serviço/locação (ISS) — fora da NF-e de produto" : "NCM não definido de forma única"); continue; }
      const cfop = t("cfop").replace(/\D/g, "");
      const cstIcms = t("cst_icms").replace(/\D/g, "");
      const origem = t("origem").match(/^\s*(\d)/)?.[1] ?? "";
      const [aliqIcms, aliqPis, aliqCofins] = [percentual(c("aliq_icms")), percentual(c("aliq_pis")), percentual(c("aliq_cofins"))];
      if (cfop.length !== 4 || !/^\d{2,3}$/.test(cstIcms) || !origem || aliqIcms === null || aliqPis === null || aliqCofins === null) {
        ignorar("Tributação incompleta (CFOP, CST, origem ou alíquotas)"); continue;
      }
      const numero = t("numero").replace(/\D/g, "");
      const codigo = t("codigo") || (numero ? `${prefixo(aba.nome)}-${numero.padStart(3, "0")}` : "");
      if (!codigo) { ignorar("Sem número (#) ou código"); continue; }
      produtos.push({
        codigo, descricao: descricao.slice(0, 120), grupo: t("grupo") || null, unidade: (t("unidade") || "UN").toUpperCase().slice(0, 6), ncm,
        descricao_ncm: t("descricao_ncm") || null, categoria_fiscal: t("categoria_fiscal") || null, cfop_padrao: cfop, origem, cst_icms: cstIcms, aliquota_icms: aliqIcms,
        cst_pis: t("cst_pis").replace(/\D/g, "").padStart(2, "0"), aliquota_pis: aliqPis, cst_cofins: t("cst_cofins").replace(/\D/g, "").padStart(2, "0"), aliquota_cofins: aliqCofins,
        cest: t("cest").replace(/\D/g, "") || null, observacao_fiscal: t("observacao") || null, custo_padrao: valor(c("custo")), preco_venda: valor(c("preco")),
        referencia_origem: `${aba.nome}!${linha}`
      });
    }
  }
  if (!produtos.length) throw new ErroOperacao(`Nenhum produto reconhecido em "${nomeArquivo}". A planilha precisa das colunas PRODUTO, NCM, CFOP, CST e alíquotas.`, 422);
  const repetidos = produtos.map((p) => p.codigo).filter((cod, i, todos) => todos.indexOf(cod) !== i);
  if (repetidos.length) throw new ErroOperacao(`Códigos repetidos na planilha: ${[...new Set(repetidos)].slice(0, 10).join(", ")}.`, 422);
  return { produtos, ignorados };
}

/**
 * Substitui o catálogo da empresa pelo da planilha: atualiza pelo código, cria os novos e inativa (nunca apaga — notas
 * emitidas referenciam) os que saíram. A planilha é a revisada pela contabilidade, então os itens entram aprovados.
 */
export async function importarCatalogoFiscal(tx: Tx, usuario: UsuarioAutenticado, empresaId: string, nomeArquivo: string, arquivo: Buffer) {
  const { produtos, ignorados } = await lerPlanilhaFiscal(arquivo, nomeArquivo);
  const existentes = new Set((await tx<{ codigo: string }[]>`select codigo from fiscal_produtos where empresa_id = ${empresaId} for update`).map((p) => p.codigo));
  const agora = new Date();
  const linhas = produtos.map((p) => ({ ...p, id: randomUUID(), empresa_id: empresaId, origem_catalogo: nomeArquivo.slice(0, 200), revisao_fiscal_pendente: false, ativo: true, criado_em: agora, atualizado_em: agora }));
  await tx`insert into fiscal_produtos ${tx(linhas)} on conflict (empresa_id, codigo) do update set
    descricao = excluded.descricao, grupo = excluded.grupo, unidade = excluded.unidade, ncm = excluded.ncm, descricao_ncm = excluded.descricao_ncm,
    categoria_fiscal = excluded.categoria_fiscal, cfop_padrao = excluded.cfop_padrao, origem = excluded.origem, cst_icms = excluded.cst_icms,
    aliquota_icms = excluded.aliquota_icms, cst_pis = excluded.cst_pis, aliquota_pis = excluded.aliquota_pis, cst_cofins = excluded.cst_cofins,
    aliquota_cofins = excluded.aliquota_cofins, cest = excluded.cest, observacao_fiscal = excluded.observacao_fiscal, custo_padrao = excluded.custo_padrao,
    preco_venda = excluded.preco_venda, origem_catalogo = excluded.origem_catalogo, referencia_origem = excluded.referencia_origem,
    revisao_fiscal_pendente = false, ativo = true, atualizado_em = excluded.atualizado_em`;
  const inativados = await tx<{ codigo: string }[]>`update fiscal_produtos set ativo = false, atualizado_em = ${agora}
    where empresa_id = ${empresaId} and ativo and codigo <> all(${produtos.map((p) => p.codigo)}::text[]) returning codigo`;
  const resultado = {
    arquivo: nomeArquivo, produtos: produtos.length, novos: produtos.filter((p) => !existentes.has(p.codigo)).length,
    atualizados: produtos.filter((p) => existentes.has(p.codigo)).length, inativados: inativados.map((p) => p.codigo), ignorados
  };
  await auditar(tx, usuario, { acao: "CATALOGO_FISCAL_IMPORTAR", entidade: "fiscal_produtos", entidadeId: empresaId, empresaId,
    dados: { ...resultado, ignorados: ignorados.length } });
  return resultado;
}

/** Situação do catálogo para a tela de configurações. */
export async function situacaoCatalogo(sql: Sql, empresaId: string) {
  const [s] = await sql<{ ativos: number; pendentes: number; inativos: number; arquivo: string | null; atualizado_em: string | null }[]>`
    select count(*) filter (where ativo)::int ativos, count(*) filter (where ativo and revisao_fiscal_pendente)::int pendentes,
      count(*) filter (where not ativo)::int inativos,
      (array_agg(origem_catalogo order by atualizado_em desc))[1] arquivo, max(atualizado_em) atualizado_em
    from fiscal_produtos where empresa_id = ${empresaId}`;
  return s!;
}
