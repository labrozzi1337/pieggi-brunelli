import { api } from "./api";

export interface ItemProgramacao { nome: string; receita: string; quantidade: number; unidade: string; setor: string; servico: string; produtoId?: string; ref?: string; cardapioItemId?: string | null; compradoPronto?: boolean; fornecedor?: string | null }
export interface RotuloProgramacao { nomeEn: string; nomeEs: string; descricaoPt: string; descricaoEn: string; descricaoEs: string; ficha: string; restricoes: string[]; confirmado: boolean; exibir: boolean }
export interface EtapaCampo {tipo:string;titulo:string;orientacao:string;previstoEm:string}
export interface EventoOperacao { id: string; titulo: string; empresa_id: string; cliente_id: string; data_evento: string | null; pax: number | null; horario_inicio: string | null; horario_fim: string | null; etapa_comercial: string; etapa_operacao: string; etapa_financeiro: string; contrato_assinado_em: string | null; revisao: number }
export interface Programacao { id: string; evento_id: string; versao: number; status: string; saida_em: string; itens: ItemProgramacao[]; rotulos?: RotuloProgramacao[]; roteiro_campo?:EtapaCampo[]; alteracoes: string; criado_em: string; aprovado_em: string | null }
export interface Tarefa { id: string; evento_id: string; programacao_id: string; tipo: string; setor: string; titulo: string; descricao: string; quantidade: number | null; unidade: string | null; estado: string; evidencia_obrigatoria: boolean; evidencia_path: string | null; atualizado_em: string }
export interface Titulo { id: string; evento_id: string; descricao: string; valor: number; vencimento: string; recebido_em: string | null; forma: string }
export interface Operacao {
  etapasCampo:{id:string;evento_id:string;programacao_id:string;ordem:number;tipo:string;titulo:string;orientacao:string;previsto_em:string;concluido_em:string|null;observacao:string|null}[];
  custos: { id:string; evento_id:string; categoria:string; descricao:string; valor:number; competencia:string; referencia:string; cancelado_em:string|null; motivo_cancelamento:string|null }[];
  produtos: {id:string;codigo:string;descricao:string}[];
  eventos: EventoOperacao[]; programacoes: Programacao[]; tarefas: Tarefa[];
  notificacoes: { id: string; evento_id: string; mensagem: string; criado_em: string }[];
  integracoes: { id: string; evento_id: string; tipo: string; status: string }[];
  titulos: Titulo[]; valores: { evento_id: string; valor_venda: number | null; custo_estimado: number | null; proposta_id?: string | null }[];
  posVenda: { evento_id: string; nota: number | null; comentario: string; retorno_em: string | null }[];
  podeValores: boolean;
}
export const setores = ["A_CLASSIFICAR", "COZINHA_QUENTE", "COZINHA_FRIA", "CONFEITARIA", "BEBIDAS", "ESTRUTURA", "FORNECEDOR"];
export const rotulo = (valor: string) => valor.toLocaleLowerCase("pt-BR").replaceAll("_", " ");
export const moeda = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dataCurta = (valor: string | null) => valor ? new Date(`${valor.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "Sem data";
export function diasComSobrecarga(eventos: EventoOperacao[]) {
  const dias = new Map<string, number>();
  for (const evento of eventos) if (evento.data_evento && evento.etapa_comercial !== "PERDIDO" && evento.contrato_assinado_em) dias.set(evento.data_evento, (dias.get(evento.data_evento) ?? 0) + 1);
  return [...dias].filter(([, total]) => total > 2).sort(([a], [b]) => a.localeCompare(b));
}
/** Central mostra os ativos e os dos últimos 60 dias. `evento`: inclui um antigo aberto por link; `desde` (AAAA-MM-DD): amplia a janela. */
export function consultarOperacao(empresaId: string, evento?: string | null, desde?: string): Promise<Operacao> {
  return api(`/api/v1/operacao?empresaId=${empresaId}${evento ? `&evento=${evento}` : ""}${desde ? `&desde=${desde}` : ""}`);
}
export function executarOperacao(evento: EventoOperacao, acao: string, dados: unknown): Promise<{ id: string }> {
  return api(`/api/v1/eventos/${evento.id}/operacao`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revisao: evento.revisao, comando: { acao, dados } }) });
}
