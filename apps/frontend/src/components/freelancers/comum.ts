import { api } from "@/lib/api";
import { moeda } from "@/lib/operacao";

export interface Freelancer {
  id: string; nome: string; cnpj: string; celular: string; pix: string; funcoes: string[]; valorDiaria: number | null;
  documentosPath: string | null; ativo: boolean; anonimizado: boolean; criadoEm: string; eventos: number; ultimaDiaria: string | null;
}
export interface Tabela { funcoes: { funcao: string; valorCentavos: number | null; pendente: boolean }[]; faixa: { min: number; max: number } | null }
export interface DadosFreelancers { freelancers: Freelancer[]; tabela: Tabela; podeEditar: boolean; podePagar: boolean; podeAnonimizar: boolean }

const ROTULOS: Record<string, string> = { COPEIRA: "Copeira", GARCOM: "Garçom", COZINHEIRO: "Cozinheiro", AUXILIAR: "Auxiliar", MOTORISTA: "Motorista" };
export const rotuloFuncao = (codigo: string) => ROTULOS[codigo] ?? codigo.charAt(0) + codigo.slice(1).toLowerCase().replaceAll("_", " ");
export const reais = (centavos: number) => moeda(centavos / 100);
export const hoje = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
export const dataBr = (iso: string | null) => iso ? iso.slice(0, 10).split("-").reverse().join("/") : "Sem data";

export function enviar<T = { id: string }>(caminho: string, corpo: unknown): Promise<T> {
  return api<T>(caminho, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
}

/** Valor que a diária terá se lançada hoje: individual, senão o padrão da função (o backend congela o valor real). */
export function valorPrevisto(f: Freelancer | undefined, funcao: string, tabela: Tabela): number | null {
  if (f?.valorDiaria) return Math.round(f.valorDiaria * 100);
  return tabela.funcoes.find((t) => t.funcao === funcao)?.valorCentavos ?? null;
}
