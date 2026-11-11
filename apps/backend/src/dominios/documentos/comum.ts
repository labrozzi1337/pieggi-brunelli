// Utilidades compartilhadas pelos geradores: assets de marca, formatação de data/dinheiro e contato comercial.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

export const CONTATO_COMERCIAL = { telefone: "+55 11 94683-5321", email: "atendimento@pieggi.com.br", site: "pieggi.com.br" } as const;
export const SITE_URL = "https://pieggi.com.br";

export type Asset = "selo-pieggi.png" | "selo-pieggi-branco.png" | "simbolo-pg.jpg" | "simbolo-pg-branco.png" | "tarja-pieggi-branco.png";
// cwd = apps/backend no Next (dev e standalone em /app → apps/backend) e = raiz do repo no vitest.
const DIRS = [path.resolve(process.cwd(), "assets/marca"), path.resolve(process.cwd(), "apps/backend/assets/marca")];
const cache = new Map<Asset, Buffer>();
export function asset(nome: Asset): Buffer {
  const c = cache.get(nome);
  if (c) return c;
  const dir = DIRS.find((d) => existsSync(path.join(d, nome)));
  if (!dir) throw new Error(`Asset de marca não encontrado: ${nome} (procurado em ${DIRS.join(", ")})`);
  const b = readFileSync(path.join(dir, nome));
  cache.set(nome, b);
  return b;
}

const partes = (iso: string) => { const [a = "", m = "", d = ""] = iso.slice(0, 10).split("-"); return { a, m, d }; };
/** DD/MM — usado na programação. */
export const dataCurta = (iso: string) => { const { m, d } = partes(iso); return `${d}/${m}`; };
/** DD/MM/AAAA — demais documentos. */
export const dataLonga = (iso: string) => { const { a, m, d } = partes(iso); return `${d}/${m}/${a}`; };
/** Centavos → "R$ 1.234,56". */
export const moeda = (centavos: number) =>
  "R$ " + (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
