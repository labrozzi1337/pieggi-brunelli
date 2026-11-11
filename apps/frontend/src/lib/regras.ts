import { moeda } from "@/lib/operacao";

export interface RegraApi {
  id: string; codigo: string; versao: number; titulo: string; origem: string; status: "APROVADA" | "PENDENTE"; valor: unknown;
  escopoTipo: string; escopoChave: string; vigenteDesde: string; financeiro: boolean; justificativa: string | null; criadoEm: string;
}

export const hojeSaoPaulo = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
export const campoTexto = (f: FormData, nome: string) => { const v = f.get(nome); return typeof v === "string" ? v : ""; };
export const PERCENTUAL = /(percentual|cmv\.(aviso|bloqueio)|desconto|imposto|repasse|acrescimo_fixo|vegetariano)$/;

export function formatarValor(codigo: string, valor: unknown): string {
  if (typeof valor === "number") {
    if (PERCENTUAL.test(codigo)) return `${(valor * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
    return /^(preco|logistica|copeira|louca_premium|acrescimo)\./.test(codigo) ? moeda(valor) : valor.toLocaleString("pt-BR");
  }
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (typeof valor === "string") return valor;
  if (Array.isArray(valor)) return (valor as unknown[]).map((v) => (typeof v === "object" && v !== null ? Object.values(v).join(" → ") : String(v))).join(" · ");
  if (valor && typeof valor === "object") return Object.entries(valor).map(([k, v]) => `${k}: ${typeof v === "number" && /^preco\./.test(codigo) ? moeda(v) : String(v)}`).join(" · ");
  return "—";
}
