import { z } from "zod";
import type { Leitor } from "@/dominios/regras/motor";

// Regras puras do módulo de freelancers (sem banco). Valores de negócio vêm sempre do motor de regras.

export const soDigitos = (v: string) => v.replace(/\D/g, "");
export const centavos = (reais: number) => Math.round(reais * 100);
export const reais = (c: number) => c / 100;

/** CNPJ com dígitos verificadores válidos (aceita com ou sem máscara). */
export function cnpjValido(valor: string): boolean {
  const d = soDigitos(valor);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const resto = [...base].reduce((s, c, i) => s + Number(c) * pesos[i]!, 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const p1 = dv(d.slice(0, 12));
  return p1 === Number(d[12]) && dv(d.slice(0, 12) + p1) === Number(d[13]);
}

export const formatarCnpj = (d: string) => d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : d;

export const CODIGO_DIARIA = "freelancer.diaria";
export const CODIGO_FAIXA = "freelancer.diaria.faixa";
export const CODIGO_VERBA = "verba.percentual";
const faixaSchema = z.object({ min: z.number().positive(), max: z.number().positive() });

export function faixaDiaria(leitor: Leitor) {
  return leitor.ler(CODIGO_FAIXA, faixaSchema, {}, false);
}

/** Diária cheia: valor individual do freelancer, senão o padrão da função na data do dia trabalhado. */
export function valorDaDiaria(leitor: Leitor, funcao: string, individual: number | null): { valorCentavos: number; origem: "FUNCAO" | "INDIVIDUAL" } | undefined {
  if (individual !== null && individual > 0) return { valorCentavos: centavos(individual), origem: "INDIVIDUAL" };
  const padrao = leitor.ler(CODIGO_DIARIA, z.number().positive(), { item: funcao });
  return padrao === undefined ? undefined : { valorCentavos: centavos(padrao), origem: "FUNCAO" };
}

/** Verba do evento = percentual da regra × orçamento total (em centavos). */
export const calcularVerba = (totalCentavos: number, percentual: number) => Math.round(totalCentavos * percentual);

/** Verba disponível × custo da escala. Verba zero com escala lançada também alerta. */
export function compararVerba(verbaCentavos: number, custoCentavos: number) {
  return { verbaCentavos, custoCentavos, saldoCentavos: verbaCentavos - custoCentavos, estourou: custoCentavos > verbaCentavos, exibirVerba: verbaCentavos > 0 };
}

// ---------------------------------------------------------------- Relatório de pagamento

export interface DiariaRelatorio {
  id: string; freelancerId: string; nome: string; cnpj: string; pix: string;
  funcao: string; valorCentavos: number; status: "PENDENTE" | "PAGO";
  eventoId: string; evento: string; data: string; local: string;
  pagamentoId: string | null; pagoEm: string | null; comprovante: string | null;
}

export interface LinhaPagamento {
  freelancerId: string; nome: string; cnpj: string; pix: string; funcao: string; diarias: number;
  valorDiariaCentavos: number; totalCentavos: number; status: "PENDENTE" | "PAGO";
  pagamentoId: string | null; pagoEm: string | null; comprovante: string | null;
}

/** Uma linha por freelancer × função × valor × situação de pagamento, com totais geral, por função e por evento. */
export function montarRelatorio(diarias: readonly DiariaRelatorio[]) {
  const linhas = new Map<string, LinhaPagamento>();
  const porFuncao = new Map<string, { diarias: number; totalCentavos: number }>();
  const porEvento = new Map<string, { evento: string; diarias: number; totalCentavos: number }>();
  for (const d of diarias) {
    const chave = [d.freelancerId, d.funcao, d.valorCentavos, d.status, d.pagamentoId].join("|");
    const l = linhas.get(chave) ?? { freelancerId: d.freelancerId, nome: d.nome, cnpj: d.cnpj, pix: d.pix, funcao: d.funcao, diarias: 0, valorDiariaCentavos: d.valorCentavos, totalCentavos: 0, status: d.status, pagamentoId: d.pagamentoId, pagoEm: d.pagoEm, comprovante: d.comprovante };
    l.diarias += 1; l.totalCentavos += d.valorCentavos; linhas.set(chave, l);
    const f = porFuncao.get(d.funcao) ?? { diarias: 0, totalCentavos: 0 };
    f.diarias += 1; f.totalCentavos += d.valorCentavos; porFuncao.set(d.funcao, f);
    const e = porEvento.get(d.eventoId) ?? { evento: d.evento, diarias: 0, totalCentavos: 0 };
    e.diarias += 1; e.totalCentavos += d.valorCentavos; porEvento.set(d.eventoId, e);
  }
  const ordenadas = [...linhas.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.funcao.localeCompare(b.funcao));
  const soma = (s: "PENDENTE" | "PAGO") => diarias.filter((d) => d.status === s).reduce((t, d) => t + d.valorCentavos, 0);
  return {
    linhas: ordenadas,
    detalhes: [...diarias].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.data.localeCompare(b.data)),
    totais: {
      diarias: diarias.length, geralCentavos: soma("PENDENTE") + soma("PAGO"), pendenteCentavos: soma("PENDENTE"), pagoCentavos: soma("PAGO"),
      porFuncao: [...porFuncao].map(([funcao, v]) => ({ funcao, ...v })).sort((a, b) => a.funcao.localeCompare(b.funcao)),
      porEvento: [...porEvento].map(([eventoId, v]) => ({ eventoId, ...v })).sort((a, b) => a.evento.localeCompare(b.evento, "pt-BR"))
    }
  };
}

const virgula = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const csv = (v: string) => /[;"\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;

/**
 * Arquivo genérico de pagamento em lote por PIX (CSV com ;): um registro por freelancer com saldo pendente.
 * Não é CNAB: layout específico de banco fica fora do escopo.
 */
export function arquivoPix(linhas: readonly LinhaPagamento[], identificador: string): string {
  const porPessoa = new Map<string, { nome: string; cnpj: string; pix: string; totalCentavos: number }>();
  for (const l of linhas.filter((x) => x.status === "PENDENTE")) {
    const p = porPessoa.get(l.freelancerId) ?? { nome: l.nome, cnpj: l.cnpj, pix: l.pix, totalCentavos: 0 };
    p.totalCentavos += l.totalCentavos; porPessoa.set(l.freelancerId, p);
  }
  const registros = [...porPessoa].map(([id, p]) => [p.nome, p.cnpj, p.pix, virgula(p.totalCentavos), `${identificador}-${id.slice(0, 8)}`].map(csv).join(";"));
  return ["nome;documento;chave_pix;valor;identificador", ...registros].join("\r\n") + "\r\n";
}

const ROTULOS: Record<string, string> = { COPEIRA: "Copeira", GARCOM: "Garçom", COZINHEIRO: "Cozinheiro", AUXILIAR: "Auxiliar", MOTORISTA: "Motorista" };
/** Código da função (regra freelancer.diaria, escopo ITEM) → texto para documento. */
export const rotuloFuncao = (codigo: string) => ROTULOS[codigo] ?? codigo.charAt(0) + codigo.slice(1).toLowerCase().replaceAll("_", " ");
