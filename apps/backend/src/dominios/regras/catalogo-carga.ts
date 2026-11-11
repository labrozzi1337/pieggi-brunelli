// Cardápio da carga (migrations 20261108101000 + 20261109103100 + itens da 20261109108000) sem banco — só para testes de aceite.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ItemCatalogo, Selo } from "@/dominios/documentos/tipos";
import { CARDAPIO_V4 } from "./regras-iniciais";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../../../../supabase/migrations");
const tupla = (linha: string) => [...linha.matchAll(/'((?:[^']|'')*)'|(\d+(?:\.\d+)?)|(null)/g)].map((m) => (m[1] !== undefined ? m[1].replaceAll("''", "'") : m[2] ?? null));

export function catalogoDaCarga(): ItemCatalogo[] {
  const carga = readFileSync(path.join(MIGRATIONS, "20261108101000_carga_regras_e_cardapio.sql"), "utf8");
  const enriquecimento = (() => { try { return readFileSync(path.join(MIGRATIONS, "20261109103100_cardapio_traducoes_selos.sql"), "utf8"); } catch { return ""; } })();
  const extras = new Map<string, Array<string | null>>();
  for (const m of enriquecimento.matchAll(/^ {2}\((.*)\),?$/gm)) {
    const [grupo, nome, ...resto] = tupla(m[1] ?? "");
    extras.set(`${grupo}|${nome}`, resto);
  }
  const bloco = carga.slice(carga.indexOf("with carga("));
  const novos: ItemCatalogo[] = CARDAPIO_V4.map((i, k) => ({
    id: `item-v4-${k + 1}`, nome: i.nome, grupo: i.grupo, categoria: i.categoria, tier: i.tier, ingredientes: i.ingredientes, unidade: i.unidade,
    nomeEn: i.nomeEn, nomeEs: i.nomeEs, selo: i.selo, estacao: i.estacao, fornecedor: i.fornecedor, ativo: true, custo: null
  }));
  return [...[...bloco.matchAll(/^ {2}\((.*)\),?$/gm)].map((m, i) => {
    const [familia, grupo, categoria, tier, nome, ingredientes, unidade, custo] = tupla(m[1] ?? "");
    const [nomeEn, nomeEs, selo, estacao, fornecedor] = extras.get(`${grupo}|${nome}`) ?? [];
    void familia;
    return {
      id: `item-${i + 1}`, nome: nome ?? "", grupo: grupo ?? "", categoria: categoria ?? "", tier: tier ?? "", ingredientes: ingredientes ?? "", unidade: unidade ?? "",
      nomeEn: nomeEn ?? null, nomeEs: nomeEs ?? null, selo: (selo as Selo | null) ?? null, estacao: estacao ?? null, fornecedor: fornecedor ?? null,
      ativo: true, custo: custo ? Number(custo) : null
    };
  }), ...novos];
}
