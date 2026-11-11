export const statusDocumentoFiscal = [
  "RASCUNHO", "VALIDANDO", "PRONTO", "ASSINANDO", "ENVIANDO", "PROCESSANDO",
  "AUTORIZADO", "REJEITADO", "DENEGADO", "CANCELADO", "ERRO"
] as const;

export type StatusDocumentoFiscal = (typeof statusDocumentoFiscal)[number];
export type AmbienteFiscal = "HOMOLOGACAO" | "PRODUCAO";

export interface ItemDocumentoFiscal {
  produtoId?: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  desconto?: number;
  frete?: number;
  seguro?: number;
  outrasDespesas?: number;
  origem: string;
  cst?: string;
  csosn?: string;
  gtin?: string;
  cest?: string;
  sku?: string;
  icms?: Record<string, unknown>;
  ipi?: Record<string, unknown>;
  pis?: Record<string, unknown>;
  cofins?: Record<string, unknown>;
  ibs?: Record<string, unknown>;
  cbs?: Record<string, unknown>;
  cClassTrib?: string;
}

export interface TotaisDocumentoFiscal {
  produtos: number;
  desconto: number;
  frete: number;
  seguro: number;
  outrasDespesas: number;
  notaFiscal: number;
}

export interface DocumentoFiscalEntrada {
  empresaId: string;
  ambiente: AmbienteFiscal;
  serie: number;
  naturezaOperacao: string;
  destinoOperacao: "1" | "2" | "3";
  consumidorFinal: "0" | "1";
  indicadorPresenca: "0" | "1" | "2" | "3" | "4" | "5" | "9";
  destinatario: Record<string, unknown>;
  itens: ItemDocumentoFiscal[];
  transporte?: Record<string, unknown>;
  pagamento?: Record<string, unknown>;
  informacoesAdicionais?: string;
}

export interface DocumentoFiscal extends DocumentoFiscalEntrada {
  id: string;
  numero: number | null;
  chaveAcesso: string | null;
  codigoStatusSefaz?: string;
  mensagemSefaz?: string;
  status: StatusDocumentoFiscal;
  totais: TotaisDocumentoFiscal;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ResultadoValidacaoFiscal {
  nivel: "ERRO" | "ALERTA" | "INFORMACAO";
  campo: string;
  mensagem: string;
}

/** Representa a parametrização disponível para pré-preencher um item de NF-e. */
export interface ProdutoFiscal {
  id: string;
  codigo: string;
  descricao: string;
  grupo?: string;
  unidade: string;
  ncm: string;
  cfop: string;
  origem: string;
  cstIcms?: string;
  aliquotaIcms?: number;
  cstPis?: string;
  aliquotaPis?: number;
  cstCofins?: string;
  aliquotaCofins?: number;
  cest?: string;
  cBenef?: string;
  precoVenda?: number;
  revisaoFiscalPendente: boolean;
}
