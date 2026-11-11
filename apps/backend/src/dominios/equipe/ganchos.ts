import type { Tx } from "@/integrations/banco";
import type { UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import type { ProgramacaoLinha } from "@/dominios/operacao/ganchos-tipos";

/**
 * Programação mudou de status. Antigo trigger equipe_revisar_programacao: quando a versão APROVADA é
 * invalidada, as contratações ligadas a ela voltam para A_REVISAR (exceto canceladas/executadas).
 * A escala de freelancers (diárias) não depende da versão da programação e não é tocada.
 */
export async function aoMudarStatusProgramacao(tx: Tx, _usuario: UsuarioAutenticado, programacao: ProgramacaoLinha, statusAnterior: string): Promise<void> {
  if (programacao.status !== "INVALIDADA" || statusAnterior !== "APROVADA") return;
  await tx`update evento_equipe set estado = 'A_REVISAR', motivo = 'Programação invalidada. Revise escala e contratação antes de confirmar novamente.', atualizado_em = now()
    where programacao_id = ${programacao.id} and estado not in ('CANCELADA', 'EXECUTADA')`;
}
