import type { Evento } from "@/lib/api";
import { pendenciasCriticas } from "@/lib/eventos";

export const campo = "h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
export const area = "min-h-24 w-full rounded-lg border bg-background p-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
export const etapas = [
  { id: "FRIO", nome: "Frio", cor: "bg-slate-400" },
  { id: "MORNO", nome: "Morno", cor: "bg-sky-500" },
  { id: "QUENTE", nome: "Quente", cor: "bg-orange-500" },
  { id: "CONTRATO_ENVIADO", nome: "Contrato enviado", cor: "bg-violet-500" },
  { id: "CONTRATO_ASSINADO", nome: "Contrato assinado", cor: "bg-emerald-500" },
  { id: "PERDIDO", nome: "Perdido", cor: "bg-rose-500" }
] as const;
export type Etapa = (typeof etapas)[number]["id"];
export const PAPEIS_COMERCIAIS = ["ADMIN", "COMERCIAL", "ATENDIMENTO"];
export const PAPEIS_VALORES = ["ADMIN", "COMERCIAL", "ATENDIMENTO", "FINANCEIRO"];
export const tem = (papeis: readonly string[] | undefined, permitidos: readonly string[]) => !!papeis?.some((p) => p === "ADMIN" || permitidos.includes(p));

export function diasAte(data?: string | null): number | null {
  if (!data) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${data}T00:00:00`).getTime() - hoje.getTime()) / 86400000);
}
export function formatarData(data?: string | null): string {
  return data ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${data}T12:00:00`)) : "Data pendente";
}
export const rotulo = (valor: string) => valor.replaceAll("_", " ").toLocaleLowerCase("pt-BR").replace(/(^|\s)\S/g, (l) => l.toLocaleUpperCase("pt-BR"));
export function rotuloPrazo(dias: number | null): string {
  if (dias === null) return "Sem data";
  if (dias < 0) return `${Math.abs(dias)}d atrasado`;
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Amanhã";
  return `Em ${dias} dias`;
}
export function urgenciaClasse(dias: number | null): string {
  if (dias === null) return "bg-muted text-muted-foreground";
  if (dias < 0) return "bg-rose-500/10 text-rose-700";
  if (dias <= 3) return "bg-orange-500/10 text-orange-700";
  return "bg-sky-500/10 text-sky-700";
}
export function corEtapa(valor: string): string {
  const cores: Record<string, string> = {
    FRIO: "bg-slate-500/10 text-slate-700", MORNO: "bg-sky-500/10 text-sky-700", QUENTE: "bg-orange-500/10 text-orange-700",
    CONTRATO_ENVIADO: "bg-violet-500/10 text-violet-700", CONTRATO_ASSINADO: "bg-emerald-500/10 text-emerald-700", PERDIDO: "bg-rose-500/10 text-rose-700"
  };
  return cores[valor] ?? "bg-muted text-muted-foreground";
}
/** Endereço fixo do cliente: o backend grava só o logradouro (texto completo da regra). */
export const temEnderecoFixo = (e: Evento) => !!e.logradouro && !e.numeroEndereco && !e.cep;
export const camposPendentes = (e: Evento) => [...(e.tabelaPreco ? [] : ["tabela de preço"]), ...pendenciasCriticas(e, temEnderecoFixo(e))];
export const quantidadePendencias = (e: Evento) => camposPendentes(e).length;
export const mensagem = (falha: unknown) => (falha instanceof Error ? falha.message : "Não foi possível concluir a operação.");
