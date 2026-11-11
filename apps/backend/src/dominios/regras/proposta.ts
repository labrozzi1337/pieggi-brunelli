// Proposta (.pptx): orçamento com a redação do comercial, cardápios por serviço, opcionais. Verba e venda avulsa.
// Nunca expõe CMV, custo, lógica de preço nem repasse WTC.
import { z } from "zod";
import type { CabecalhoEvento, CardapioProposta, ItemCatalogo, LinhaOrcamento, PropostaDoc, ServicoProgramacao } from "@/dominios/documentos/tipos";
import { Leitor, paraCentavos, precificar, teto, verificarListaNegra, type Regra, type ServicoPreco, type Trava } from "./motor";
import { contemTermo, diagnostico, Dicionario, formatarReais, preencher, registro, type Diagnostico } from "./cardapio";

const textos = z.array(z.string());

/** Verba de freelancer = verba.percentual × total do evento. O documento mostra só "Verba: R$ X". */
export function calcularVerba(regras: readonly Regra[], data: string, totalCentavos: number, cliente?: string | null) {
  const percentual = new Leitor(regras, { data, cliente: cliente ?? undefined }).ler("verba.percentual", z.number().min(0).max(1)) ?? 0;
  return Math.round(totalCentavos * percentual);
}

/** "Verba: R$ 1.600,00"; verba zero → null (o bloco some inteiro, sem "R$ 0,00"). */
export const textoVerba = (centavos: number) => (centavos > 0 ? `Verba: ${formatarReais(centavos)}` : null);

// ---------------------------------------------------------------- Proposta

export interface ServicoProposta extends ServicoPreco { descritivo: string; cardapio?: ServicoProgramacao }
export interface OpcaoProposta { titulo?: string; servicos: ServicoProposta[] }
export interface EntradaProposta {
  cabecalho: CabecalhoEvento; data: string; tabela: string; regioes?: string[];
  descontoPercentual?: number; custoEstimado?: number;
  opcoes: OpcaoProposta[];                                                  // mais de uma → total "R$ a definir"
  alcoolicos?: Array<{ descritivo: string; pax: number | null; valorCentavos: number }>;
  restricoes?: Array<{ descritivo: string; pax: number; valorCentavos?: number; cortesia?: boolean }>;
  validade?: string | null;
}
export type ResultadoProposta = PropostaDoc & Diagnostico;

export function gerarPropostaDoc(regras: readonly Regra[], entrada: EntradaProposta, catalogo: readonly ItemCatalogo[] = []): ResultadoProposta {
  const cliente = entrada.cabecalho.clienteChave ?? undefined;
  const leitor = new Leitor(regras, { data: entrada.data, cliente, regioes: entrada.regioes });
  const dic = new Dicionario(leitor);
  const avisos: string[] = [];
  const bloqueios: Trava[] = [];
  const t = leitor.ler("proposta.textos", registro(z.string())) ?? {};
  const ocultarPorPessoa = leitor.ler("proposta.ocultar_por_pessoa", z.boolean()) ?? false;
  const ocultarQtd = leitor.ler("proposta.ocultar_quantidades", z.boolean()) ?? false;
  const proibidos = leitor.ler("proposta.termos_proibidos", z.object({ remover: textos, avisar: textos })) ?? { remover: [], avisar: [] };
  const nomesServico = Object.entries(leitor.ler("proposta.nomes_servico", registro(z.string()), {}, false) ?? {}).sort((a, b) => b[0].length - a[0].length);
  const cortesiaAte = leitor.ler("restricao.cortesia_pax", z.number().min(0), {}, false) ?? 0;
  const variasOpcoes = entrada.opcoes.length > 1;
  const orcamento: LinhaOrcamento[] = [];
  let totalCentavos: number | null = null;
  const removida = (descritivo: string) => contemTermo(descritivo, proibidos.remover);

  for (const opcao of entrada.opcoes) {
    const preco = precificar(regras, { data: entrada.data, tabela: entrada.tabela, cliente, regioes: entrada.regioes, servicos: opcao.servicos, descontoPercentual: entrada.descontoPercentual ?? 0, custoEstimado: entrada.custoEstimado });
    avisos.push(...preco.avisos);
    bloqueios.push(...preco.bloqueios);
    preco.regrasFaltando.forEach((f) => leitor.faltando.add(f));
    const prefixo = variasOpcoes && opcao.titulo ? `${opcao.titulo} — ` : "";
    opcao.servicos.forEach((s, i) => {
      const p = preco.servicos[i]!;
      if (removida(s.descritivo)) { avisos.push(`Linha removida do orçamento: ${s.descritivo}`); return; }
      const nome = nomesServico.find(([n]) => contemTermo(s.descritivo, [n]));
      if (nome && nome[1] !== `${s.linha}.${s.tier}`) avisos.push(`"${s.descritivo}": para o cliente, "${nome[0]}" é ${nome[1].replace(".", " ")}, mas o serviço está como ${s.linha} ${s.tier}.`);
      if (contemTermo(s.descritivo, proibidos.avisar)) avisos.push(`"${s.descritivo}": use o nome do serviço como o cliente descreveu, sem nome de linha Pieggi.`);
      orcamento.push({ descritivo: `${prefixo}${s.descritivo}`, pax: p.paxCobrado, porPessoaCentavos: ocultarPorPessoa ? null : Math.round(p.valorCentavos / p.paxCobrado), valorCentavos: p.valorCentavos });
    });
    if (preco.descontoCentavos) orcamento.push({ descritivo: `${prefixo}${t.desconto ?? ""}`, pax: null, porPessoaCentavos: null, valorCentavos: -preco.descontoCentavos });
    if (preco.taxaCentavos) {
      const percentual = `${Math.round(preco.taxaCentavos / preco.alimentacaoCentavos * 100)}%`;
      orcamento.push({ descritivo: `${prefixo}${preencher(t.taxa ?? "", { percentual })}`, pax: null, porPessoaCentavos: null, valorCentavos: preco.taxaCentavos });
    }
    if (preco.logisticaCentavos) orcamento.push({ descritivo: `${prefixo}${t.logistica ?? ""}`, pax: null, porPessoaCentavos: null, valorCentavos: preco.logisticaCentavos });
    totalCentavos = preco.totalCentavos;
  }
  for (const r of entrada.restricoes ?? []) {
    const cortesia = r.cortesia ?? (r.valorCentavos === undefined || r.pax <= cortesiaAte);
    orcamento.push({ descritivo: cortesia ? `${r.descritivo} — ${t.cortesia ?? ""}` : r.descritivo, pax: r.pax, porPessoaCentavos: null, valorCentavos: cortesia ? 0 : r.valorCentavos ?? 0 });
    if (!cortesia && totalCentavos !== null) totalCentavos += r.valorCentavos ?? 0;
  }

  const servicos = entrada.opcoes.flatMap((o) => o.servicos);
  const cardapios: CardapioProposta[] = servicos.filter((s) => s.cardapio).map((s) => {
    const itens = s.cardapio!.itens.filter((i) => !i.bebida);
    const negra = verificarListaNegra(leitor, itens.map((i) => i.receita), "PROPOSTA");
    bloqueios.push(...negra);
    return {
      titulo: s.descritivo,
      itens: itens.filter((i) => !negra.some((n) => n.mensagem.startsWith(`${i.receita}:`))).map((i) => ({
        nome: dic.limpar(i.receita), quantidade: ocultarQtd || i.unidade !== "UN" ? null : i.quantidade,
        descricao: catalogo.find((c) => c.id === i.cardapioItemId)?.ingredientes || null
      })),
      bebidas: s.cardapio!.itens.filter((i) => i.bebida).map((i) => i.receita)
    };
  });

  const linhasLouca = leitor.ler("proposta.louca_premium_linhas", textos) ?? [];
  const louca = leitor.ler("louca_premium.por_pax", z.number().positive(), {}, false);
  const opcionais = louca && servicos.some((s) => linhasLouca.includes(s.linha))
    ? [{ descritivo: t.louca ?? "", valorTexto: preencher(t.loucaValor ?? "", { valor: formatarReais(paraCentavos(louca)).replace(/^R\$ /, "") }) }] : [];

  return {
    cabecalho: entrada.cabecalho, formato: cardapios.length ? "COMPLETO" : "POCKET", orcamento,
    bebidasAlcoolicas: (entrada.alcoolicos ?? []).map((a) => ({ descritivo: a.descritivo, pax: a.pax, porPessoaCentavos: null, valorCentavos: a.valorCentavos })),
    totalCentavos: variasOpcoes ? null : totalCentavos, opcionais, cardapios, validade: entrada.validade ?? null,
    ...diagnostico([leitor], avisos, bloqueios)
  };
}

// ---------------------------------------------------------------- Venda por unidade (item avulso)

export interface EntradaAvulso {
  data: string; cliente?: string;
  itens: Array<{ chave: string; quantidade: number; descritivo?: string }>;   // chave de preco.avulso.*
  cafeLitros?: number;
  copeira?: boolean;                                                          // padrão: regra copeira.limite_evento_dia
}

/** Preço unitário da planilha (nunca o valor por pax); café por garrafa cheia; sem taxa; serviço numa linha só. */
export function precificarAvulso(regras: readonly Regra[], e: EntradaAvulso) {
  const leitor = new Leitor(regras, { data: e.data, cliente: e.cliente });
  const preco = (chave: string) => leitor.ler(`preco.avulso.${chave}`, z.number().positive());
  const linhas = e.itens.map((i) => {
    const unitarioCentavos = paraCentavos(preco(i.chave) ?? 0);
    return { descritivo: i.descritivo ?? i.chave, quantidade: i.quantidade, unitarioCentavos, valorCentavos: unitarioCentavos * i.quantidade };
  });
  if (e.cafeLitros) {
    const porGarrafa = leitor.ler("avulso.cafe_litros_garrafa", z.number().positive()) ?? 1;
    const garrafas = teto(e.cafeLitros / porGarrafa);
    const unitarioCentavos = paraCentavos(preco("CAFE_GARRAFA") ?? 0);
    linhas.push({ descritivo: `Café — ${garrafas} garrafa(s) de ${porGarrafa.toLocaleString("pt-BR")} L`, quantidade: garrafas, unitarioCentavos, valorCentavos: unitarioCentavos * garrafas });
  }
  const itensCentavos = linhas.reduce((a, l) => a + l.valorCentavos, 0);
  const isento = leitor.ler("isencao.logistica_e_taxa", z.boolean()) ?? false;
  const limite = leitor.ler("copeira.limite_evento_dia", z.number().positive());
  const cobraCopeira = e.copeira ?? (!isento && limite !== undefined && itensCentavos <= paraCentavos(limite));
  const servico = { descritivo: leitor.ler("avulso.texto_servico", z.string()) ?? "", valorCentavos: cobraCopeira ? paraCentavos(preco("COPEIRA") ?? 0) : 0 };
  return { linhas, servico, totalCentavos: itensCentavos + servico.valorCentavos, ...diagnostico([leitor], [], []) };
}
