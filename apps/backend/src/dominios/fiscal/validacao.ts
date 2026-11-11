import { z } from "zod";
import type { DocumentoFiscalEntrada, ResultadoValidacaoFiscal, TotaisDocumentoFiscal } from "./tipos";

const dinheiro = z.number().finite().nonnegative().multipleOf(0.01);

export const itemDocumentoFiscalSchema = z.object({
  produtoId: z.string().uuid().optional(),
  descricao: z.string().trim().min(1).max(120),
  ncm: z.string().regex(/^\d{8}$/, "NCM deve conter oito dígitos."),
  cfop: z.string().regex(/^\d{4}$/, "CFOP deve conter quatro dígitos."),
  unidade: z.string().trim().min(1).max(6),
  quantidade: z.number().finite().positive(),
  valorUnitario: z.number().finite().nonnegative(),
  desconto: dinheiro.optional(), frete: dinheiro.optional(), seguro: dinheiro.optional(), outrasDespesas: dinheiro.optional(),
  origem: z.string().regex(/^\d$/, "Origem deve ser o código fiscal de um dígito."),
  cst: z.string().max(3).optional(), csosn: z.string().max(3).optional(), gtin: z.string().max(14).optional(),
  cest: z.string().regex(/^\d{7}$/).optional(), sku: z.string().max(100).optional(),
  icms: z.record(z.string(), z.unknown()).optional(), ipi: z.record(z.string(), z.unknown()).optional(),
  pis: z.record(z.string(), z.unknown()).optional(), cofins: z.record(z.string(), z.unknown()).optional(),
  ibs: z.record(z.string(), z.unknown()).optional(), cbs: z.record(z.string(), z.unknown()).optional(), cClassTrib: z.string().max(30).optional()
}).refine((item) => Boolean(item.cst) !== Boolean(item.csosn), { message: "Informe CST ou CSOSN, nunca ambos.", path: ["cst"] });

export const documentoFiscalEntradaSchema = z.object({
  empresaId: z.string().uuid(),
  ambiente: z.enum(["HOMOLOGACAO", "PRODUCAO"]),
  serie: z.number().int().min(0).max(999),
  naturezaOperacao: z.string().trim().min(1).max(60),
  destinoOperacao: z.enum(["1", "2", "3"]), consumidorFinal: z.enum(["0", "1"]),
  indicadorPresenca: z.enum(["0", "1", "2", "3", "4", "5", "9"]),
  destinatario: z.record(z.string(), z.unknown()),
  itens: z.array(itemDocumentoFiscalSchema).min(1).max(990),
  transporte: z.record(z.string(), z.unknown()).optional(), pagamento: z.record(z.string(), z.unknown()).optional(),
  informacoesAdicionais: z.string().max(5000).optional()
});

/** Calcula os totais sem confiar nos valores exibidos pelo navegador. */
export function calcularTotaisDocumento(itens: DocumentoFiscalEntrada["itens"]): TotaisDocumentoFiscal {
  const total = itens.reduce((acumulado, item) => {
    const produtos = arredondar(item.quantidade * item.valorUnitario);
    acumulado.produtos += produtos;
    acumulado.desconto += item.desconto ?? 0;
    acumulado.frete += item.frete ?? 0;
    acumulado.seguro += item.seguro ?? 0;
    acumulado.outrasDespesas += item.outrasDespesas ?? 0;
    return acumulado;
  }, { produtos: 0, desconto: 0, frete: 0, seguro: 0, outrasDespesas: 0 });

  return { ...Object.fromEntries(Object.entries(total).map(([chave, valor]) => [chave, arredondar(valor)])) as Omit<TotaisDocumentoFiscal, "notaFiscal">, notaFiscal: arredondar(total.produtos - total.desconto + total.frete + total.seguro + total.outrasDespesas) };
}

/** Executa validações de domínio antes da geração técnica do XML. */
export function validarDocumentoFiscal(documento: DocumentoFiscalEntrada): ResultadoValidacaoFiscal[] {
  const resultados: ResultadoValidacaoFiscal[] = [];
  if (documento.itens.some((item) => item.desconto && item.desconto > item.quantidade * item.valorUnitario)) {
    resultados.push({ nivel: "ERRO", campo: "itens.desconto", mensagem: "O desconto não pode superar o valor bruto do item." });
  }
  if (documento.ambiente === "PRODUCAO") resultados.push({ nivel: "ALERTA", campo: "ambiente", mensagem: "Produção exige certificado A1 ativo e confirmação explícita." });
  return resultados;
}

function arredondar(valor: number): number { return Math.round((valor + Number.EPSILON) * 100) / 100; }
