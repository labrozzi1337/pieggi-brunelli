import type { Tx } from "@/integrations/banco";
import type { UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import { auditar } from "@/dominios/operacao/http";
import type { ProgramacaoLinha } from "@/dominios/operacao/ganchos-tipos";
import { baixarExpedicao, gerarDemandas } from "./servico";

/**
 * Programação mudou de status. Aprovada → explode os itens em demandas de compra (porta do trigger gerar_demanda_compra).
 * Invalidada → cancela as demandas ainda não consumidas; o que já estava em pedido aparece como alerta em Compras.
 */
export async function aoMudarStatusProgramacao(tx: Tx, usuario: UsuarioAutenticado, programacao: ProgramacaoLinha, statusAnterior: string): Promise<void> {
  if (programacao.status === "APROVADA" && statusAnterior !== "APROVADA") {
    const [existe] = await tx`select 1 from compra_demandas where programacao_id = ${programacao.id} limit 1`;
    if (existe) return;
    const n = await gerarDemandas(tx, programacao);
    await auditar(tx, usuario, { acao: "COMPRAS_DEMANDA_GERADA", entidade: "programacao", entidadeId: programacao.id, empresaId: programacao.empresa_id, dados: { linhas: n } });
  } else if (programacao.status === "INVALIDADA" && statusAnterior !== "INVALIDADA") {
    const canceladas = await tx`update compra_demandas set cancelada_em = now() where programacao_id = ${programacao.id} and cancelada_em is null and consumida_em is null returning id`;
    if (canceladas.length) await auditar(tx, usuario, { acao: "COMPRAS_DEMANDA_CANCELADA", entidade: "programacao", entidadeId: programacao.id, empresaId: programacao.empresa_id, dados: { linhas: canceladas.length } });
  }
}

/** Comanda marcada como expedida: baixa do estoque o que saiu (necessidade corrigida das demandas do evento). */
export async function aoExpedirEvento(tx: Tx, usuario: UsuarioAutenticado, eventoId: string): Promise<void> {
  await baixarExpedicao(tx, usuario, eventoId);
}
