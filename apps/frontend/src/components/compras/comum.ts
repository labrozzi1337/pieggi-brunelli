import { api } from "@/lib/api";

export const SETORES: Record<string, string> = {
  MERCEARIA: "Mercearia / secos", FRIOS_QUEIJOS: "Frios e queijos", BEBIDAS: "Bebidas", DESCARTAVEIS: "Descartáveis",
  HORTIFRUTI: "Hortifruti", EMBALAGEM: "Embalagem", PROTEINAS: "Carnes, aves e peixes", PRODUCAO_TERCEIRIZADA: "Produção terceirizada"
};
export const UNIDADES = ["KG", "G", "L", "ML", "UN"] as const;

export interface Insumo {
  id: string; nome: string; marca: string; setor: string; unidade: string; unidade_compra: string; fator_compra: number; estoque_minimo: number;
  perecivel: boolean; rendimento_chave: string | null; custo_medio: number; ativo: boolean; saldo: number; em_pedido: number;
}
export interface Fornecedor { id: string; nome: string; contato?: string; codigo?: string | null; categorias?: string[]; prazo_pagamento_dias?: number; pedido_minimo?: number; ativo?: boolean }

export const num = (x: number | null | undefined, casas = 3) => x === null || x === undefined ? "—" : x.toLocaleString("pt-BR", { maximumFractionDigits: casas });
export const moeda = (x: number | null | undefined) => x === null || x === undefined ? "—" : x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dataBr = (iso: string | null | undefined) => iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—";
export { hojeSaoPaulo } from "@/lib/regras";

/** Segunda e domingo da semana da data (ISO). */
export function semanaDe(data: string): [string, string] {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const inicio = d.toISOString().slice(0, 10);
  d.setUTCDate(d.getUTCDate() + 6);
  return [inicio, d.toISOString().slice(0, 10)];
}

export function comandar<T = unknown>(recurso: "compras" | "estoque", empresaId: string, acao: string, dados: unknown): Promise<T> {
  return api<T>(`/api/v1/${recurso}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ empresaId, comando: { acao, dados } }) });
}

export const mensagem = (e: unknown, padrao: string) => e instanceof Error ? e.message : padrao;
