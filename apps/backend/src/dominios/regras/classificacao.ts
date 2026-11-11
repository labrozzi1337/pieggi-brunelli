// Classificação de item por texto: rótulo, sabor, tipo, base, selo e roteamento.
// Funções puras, sem import de runtime: o gerador da carga (node scripts/*.ts) usa as mesmas funções que o motor.
// Todo termo vem das regras (cardapio.categorias, cardapio.bases, selo.classificacao, roteamento.estacao).
import type { Estacao, Fornecedor, Selo } from "../documentos/tipos";

export type TipoItem = "SALGADO" | "DOCE" | "SHOT" | "MISTO" | "BEBIDA" | "BASE";
export interface CategoriaRegra { grupo?: string; termos?: string[]; rotulo: string; prefixos?: string[]; conector?: string; tipo: TipoItem; receitaSemRotulo?: boolean }
export interface SeloRegra { semSelo: string[]; vegano: string[]; vegetariano: string[] }
export interface RotaRegra {
  termos: string[]; estacao: Estacao; fornecedor?: Fornecedor; compradoPronto?: boolean;
  tipos?: TipoItem[]; linhas?: string[];
}

export const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
// Palavra inteira: "chá" não casa com "chantilly". Plural entra como termo próprio.
const contem = (texto: string, termo: string) =>
  new RegExp(`(^|[^a-z0-9])${normalizar(termo).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`).test(normalizar(texto));
export const contemAlgum = (texto: string, termos: readonly string[]) => termos.some((t) => contem(texto, t));
const capitalizar = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

export interface Classificacao { rotulo: string; sabor: string | null; tipo: TipoItem; conector?: string }

/** Rótulo (coluna ITEM), sabor (título da plaquinha) e tipo. Primeira regra que casar vence. */
export function classificar(categorias: readonly CategoriaRegra[], nome: string, grupo?: string | null, queijo: readonly string[] = []): Classificacao {
  const regra = categorias.find((c) => (c.grupo !== undefined && grupo != null && normalizar(c.grupo) === normalizar(grupo))
    || (c.termos !== undefined && contemAlgum(nome, c.termos)));
  if (!regra) return { rotulo: nome.trim(), sabor: null, tipo: "SALGADO" };
  let sabor = nome.replace(/\s*\((vegano|vegetariano)\)\s*/gi, " ").trim();
  for (const p of [...(regra.prefixos ?? [])].sort((a, b) => b.length - a.length)) {
    const i = normalizar(sabor).indexOf(normalizar(p));
    if (i === 0) { sabor = sabor.slice(p.length).trim(); break; }
  }
  sabor = sabor.replace(/^(de|com|na|no)\s+/i, "").trim();
  const tipo = regra.tipo === "MISTO" ? (contemAlgum(nome, queijo) ? "SALGADO" : "DOCE") : regra.tipo;
  return { rotulo: regra.rotulo, sabor: sabor ? capitalizar(sabor) : null, tipo, conector: regra.conector };
}

/** Base de ingrediente para não repetir entre períodos e dias: primeiro termo da lista presente no nome. */
export function baseDoItem(bases: readonly string[], nome: string) {
  return bases.find((b) => contem(nome, b)) ?? normalizar(nome);
}

/** Selo padrão: sem selo (carne, peixe, café, água) > vegano > vegetariano; nada casou → sem selo. */
export function seloDoItem(regra: SeloRegra, texto: string): Selo | null {
  if (contemAlgum(texto, regra.semSelo)) return null;
  if (contemAlgum(texto, regra.vegano)) return "VEGANO";
  if (contemAlgum(texto, regra.vegetariano)) return "VEGETARIANO";
  return null;
}

export function rotear(rotas: readonly RotaRegra[], texto: string, tipo: TipoItem, linha?: string) {
  return rotas.find((r) => contemAlgum(texto, r.termos) && (!r.tipos || r.tipos.includes(tipo)) && (!r.linhas || (linha !== undefined && r.linhas.includes(linha))));
}
