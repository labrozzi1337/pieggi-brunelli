import type { StatusDocumentoFiscal } from "./tipos";

const transicoes: Record<StatusDocumentoFiscal, readonly StatusDocumentoFiscal[]> = {
  RASCUNHO: ["VALIDANDO"], VALIDANDO: ["RASCUNHO", "PRONTO", "ERRO"], PRONTO: ["RASCUNHO", "ASSINANDO"],
  ASSINANDO: ["ENVIANDO", "ERRO"], ENVIANDO: ["PROCESSANDO", "AUTORIZADO", "REJEITADO", "DENEGADO", "ERRO"], PROCESSANDO: ["AUTORIZADO", "REJEITADO", "DENEGADO", "ERRO"],
  AUTORIZADO: ["CANCELADO"], REJEITADO: ["RASCUNHO", "VALIDANDO"], DENEGADO: [], CANCELADO: [], ERRO: ["RASCUNHO", "VALIDANDO"]
};

export class ConflitoFiscal extends Error {}

/** Impede mudanças de estado que violariam a imutabilidade fiscal do documento. */
export function podeTransicionarDocumento(de: StatusDocumentoFiscal, para: StatusDocumentoFiscal): boolean {
  return transicoes[de].includes(para);
}

/** Informa se dados fiscais ainda podem ser alterados ou excluídos. */
export function documentoFiscalEditavel(status: StatusDocumentoFiscal): boolean {
  return status === "RASCUNHO" || status === "REJEITADO" || status === "ERRO";
}
