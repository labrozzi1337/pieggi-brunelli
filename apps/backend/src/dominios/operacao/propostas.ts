import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { autorizarEmpresa, type PapelUsuario, type UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import { atualizarEvento, faltaDadoContrato, hojeSaoPaulo, linhas, podeAcessar, PAPEIS_COMERCIAIS, propostasDoEvento, snapshotProposta, temPapel, travarEvento, type Leitura, type Linha } from "@/dominios/operacao/eventos";
import { auditar, ErroOperacao } from "@/dominios/operacao/http";
import { Leitor, linhasServico, travasComerciais, type Regra } from "@/dominios/regras/motor";
import type { ServicoVendido } from "@/dominios/regras/programacao";
import { fixosDoEvento } from "./clientes";
import { carregarRegras, PAPEIS_FINANCEIROS } from "@/dominios/regras/repositorio";
import type { Tx } from "@/integrations/banco";

const texto = (max: number) => z.string().trim().min(1).max(max);
const chave = z.string().regex(/^[A-Z0-9_]{2,40}$/);
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.");
const selosExtras = z.array(z.enum(["SEM_GLUTEN", "SEM_LACTOSE", "SEM_ACUCAR"])).max(3);
const unidade = z.enum(["UN", "KG", "G", "L", "ML", "GARRAFA", "TRAVESSA", "PACOTE"]);
const componente = z.object({ nome: texto(200), insumo: chave.optional() }).strict();
/** Serviço vendido (ServicoVendido do motor): é o descritivo que a proposta aprovada trava. */
export const servicoVendidoSchema = z.object({
  id: z.string().max(60).optional(), data: z.string().date(), linha: z.enum(linhasServico), tier: chave,
  periodo: z.enum(["MANHA", "ALMOCO", "TARDE", "NOITE", "DIA"]), horarioInicio: hora, horarioFim: hora,
  pax: z.number().int().positive().max(100000), nome: texto(100).optional(), descritivo: texto(200).optional(), reposicao: z.boolean().optional(),
  itens: z.array(z.object({
    catalogoId: z.string().max(60).optional(), nome: texto(200).optional(), item: texto(100).optional(), sabor: texto(100).optional(),
    slot: z.number().int().min(0).max(50).optional(), quantidade: z.number().positive().max(1000000).optional(), unidade: unidade.optional(),
    autorizado: z.boolean().optional(), selosExtras: selosExtras.optional(), observacao: texto(500).optional()
  }).strict()).max(60).optional(),
  trocas: z.record(z.string().max(60), z.string().max(60)).optional(),
  bebidas: z.array(texto(100)).max(20).optional(),
  restricoes: z.array(z.object({ receita: texto(200), item: texto(100).optional(), quantidade: z.number().positive().max(100000), unidade: unidade.optional(),
    selo: z.enum(["VEGANO", "VEGETARIANO"]).nullable().optional(), selosExtras: selosExtras.optional() }).strict()).max(20).optional(),
  variantePreco: chave.optional(),                  // ex.: coquetel SEM_CERVEJA / LATA / LONG_NECK
  cortesia: z.boolean().optional(), periodos: z.number().int().positive().max(10).optional(), tabua: chave.optional(),
  almoco: z.object({
    proteinas: z.array(componente).max(10), acompanhamentos: z.array(componente).max(10), massa: componente.optional(), vegetariano: componente.optional(),
    folhas: componente.optional(), saladaComposta: componente.optional(), vegetais: componente.optional(),
    sobremesas: z.array(z.object({ nome: texto(200), pudim: z.boolean() }).strict()).max(5)
  }).strict().optional()
}).strict().refine((s) => s.horarioFim > s.horarioInicio, "O fim do serviço deve ser depois do início.");
export type ServicoVendidoEntrada = z.infer<typeof servicoVendidoSchema> & ServicoVendido;

const dinheiro = z.number().min(0).max(999999999).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001, "Use valores com no máximo duas casas decimais.");
export const propostaSchema = z.object({
  briefing: z.object({ startse: z.boolean(), categoria: z.enum(["STARTSE_INTELI", "NEGOCIACAO", "EXTERNOS", "WTC"]), restricoesConfirmadas: z.literal(true), restricoes: z.string().trim().max(2000), restritos: z.number().int().min(0).max(100000), cobrancaRestritos: z.enum(["SEM_RESTRICOES", "PAGO", "CORTESIA"]), escopo: z.string().trim().min(5).max(5000),
    tabela: chave.optional(), servicos: z.array(servicoVendidoSchema).min(1).max(30).optional() }).strict(),
  itens: z.array(z.object({ nome: z.string().trim().min(2).max(200), servico: z.string().trim().min(2).max(100), quantidade: z.number().positive().max(1000000).refine(v => Math.abs(v * 1000 - Math.round(v * 1000)) < 0.00001, "Use no máximo três casas na quantidade."), unidade: z.enum(["UN", "PAX", "SERVICO", "KG", "L"]), preco: dinheiro.refine(v => v > 0, "Informe o preço confirmado.") }).strict()).min(1).max(100),
  desconto: dinheiro, taxas: dinheiro, custoEstimado: dinheiro.nullable(), fontePreco: z.string().trim().min(5).max(500), alteracoes: z.string().trim().min(5).max(2000), validade: z.string().date()
}).strict();
export type DadosProposta = z.infer<typeof propostaSchema>;

/** Travas de desconto e CMV com as regras vigentes na data do evento (Caso 5). */
export function travasDaProposta(regras: readonly Regra[], data: string, dados: DadosProposta) {
  const brutoCentavos = dados.itens.reduce((soma, i) => soma + Math.round(i.quantidade * i.preco * 100), 0);
  return travasComerciais(new Leitor(regras, { data }), brutoCentavos, Math.round(dados.desconto * 100), dados.custoEstimado ?? undefined);
}

const centavos = (v: number) => BigInt(Math.round(v * 100));
/** round(quantidade × preço, 2) em aritmética exata (quantidade com até 3 casas, preço com até 2). */
export const subtotalCentavos = (itens: DadosProposta["itens"]) =>
  itens.reduce((soma, i) => soma + (BigInt(Math.round(i.quantidade * 1000)) * centavos(i.preco) + 500n) / 1000n, 0n);

/** Regras do antigo salvar_proposta que vão além do formato (o zod cuida do formato). */
export function validarProposta(dados: DadosProposta, pax: number | null) {
  const b = dados.briefing;
  if ((b.restritos > 0 && (b.restricoes.trim().length < 2 || b.cobrancaRestritos === "SEM_RESTRICOES")) || (b.restritos === 0 && b.cobrancaRestritos !== "SEM_RESTRICOES") || (pax !== null && b.restritos > pax))
    throw new ErroOperacao("Confira quantidade, tipo e cobrança dos participantes com restrições.", 409);
  if (b.startse && b.categoria !== "STARTSE_INTELI") throw new ErroOperacao("StartSe utiliza sua tabela específica.", 409);
  const casas = (v: number, n: number) => Math.abs(v * 10 ** n - Math.round(v * 10 ** n)) < 0.00001;
  for (const i of dados.itens)
    if (i.quantidade <= 0 || i.quantidade > 1000000 || !casas(i.quantidade, 3) || i.preco <= 0 || i.preco > 999999999 || !casas(i.preco, 2) || (["UN", "PAX", "SERVICO"].includes(i.unidade) && !Number.isInteger(i.quantidade)))
      throw new ErroOperacao("Confira quantidade e preço, com no máximo duas casas para valores.", 409);
  const subtotal = subtotalCentavos(dados.itens);
  const [d, t] = [centavos(dados.desconto), centavos(dados.taxas)];
  const total = subtotal - d + t;
  const custo = dados.custoEstimado;
  if (d > subtotal || !casas(dados.desconto, 2) || !casas(dados.taxas, 2) || (custo !== null && (custo < 0 || !casas(custo, 2) || custo > 999999999)) || total <= 0n || total > 99999999900n)
    throw new ErroOperacao("Totais inválidos.", 409);
  if (["STARTSE_INTELI", "WTC"].includes(b.categoria) && t !== 0n) throw new ErroOperacao("Esta tabela é isenta de taxas e logística.", 409);
  if (dados.validade < hojeSaoPaulo()) throw new ErroOperacao("Informe fonte de preço, resumo da revisão e validade vigente.", 409);
  return Number(total) / 100;
}

/** Antigo salvar_proposta: nova versão imutável, idempotente pela chave. */
export async function salvarProposta(tx: Tx, usuario: UsuarioAutenticado, entrada: { eventoId: string; revisao: number; chave: string; dados: DadosProposta }) {
  const e = await travarEvento(tx, entrada.eventoId);
  if (!e || !podeAcessar(usuario, e.empresa_id, PAPEIS_COMERCIAIS)) throw new ErroOperacao("Acesso negado.", 403);
  if (!usuario.papeis.includes("ADMIN")) {
    const { bloqueios } = travasDaProposta(await carregarRegras(tx, usuario), e.data_evento ?? hojeSaoPaulo(), entrada.dados);
    // A diretoria (ADMIN) libera salvando ela mesma; o autor e o resumo da revisão ficam na versão.
    if (bloqueios.length) throw new ErroOperacao(`${bloqueios.map(b => b.mensagem).join(" ")} Peça à diretoria para salvar esta versão.`, 409);
  }
  const [existente] = await tx<{ id: string; evento_id: string; dados: unknown }[]>`
    select id, evento_id, jsonb_build_object('briefing',briefing,'itens',itens,'desconto',desconto,'taxas',taxas,'custoEstimado',custo_estimado,'fontePreco',fonte_preco,'alteracoes',alteracoes,'validade',validade) dados
    from propostas where idempotencia = ${entrada.chave}`;
  if (existente) {
    if (existente.evento_id !== e.id || !isDeepStrictEqual(existente.dados, JSON.parse(JSON.stringify(entrada.dados)))) throw new ErroOperacao("Chave utilizada por outra proposta.", 409);
    return { id: existente.id };
  }
  if (e.revisao !== entrada.revisao) throw new ErroOperacao("Evento alterado. Atualize antes de salvar.", 409);
  if (e.contrato_assinado_em || e.etapa_comercial === "PERDIDO") throw new ErroOperacao("Evento encerrado comercialmente. Alterações exigem tratamento contratual.", 409);
  const d = entrada.dados;
  const total = validarProposta(d, e.pax);
  const id = randomUUID();
  const versao = (await tx<{ versao: number }[]>`select coalesce(max(versao), 0) + 1 versao from propostas where evento_id = ${e.id}`)[0]?.versao ?? 1;
  await tx`insert into propostas ${tx({
    id, empresa_id: e.empresa_id, evento_id: e.id, versao, briefing: tx.json(d.briefing), itens: tx.json(d.itens as never), snapshot: tx.json((await snapshotProposta(tx, e.id)) as never),
    desconto: d.desconto, taxas: d.taxas, total, custo_estimado: d.custoEstimado, fonte_preco: d.fontePreco, alteracoes: d.alteracoes, validade: d.validade,
    idempotencia: entrada.chave, criado_por: usuario.id
  })}`;
  await atualizarEvento(tx, usuario, e.id);
  await auditar(tx, usuario, { acao: "PROPOSTA_VERSIONADA", entidade: "proposta", entidadeId: id, empresaId: e.empresa_id, dados: { eventoId: e.id } });
  return { id };
}

/** Antigo aprovar_proposta: aprova a última versão, invalida a anterior e grava o valor de venda do evento. */
export async function aprovarProposta(tx: Tx, usuario: UsuarioAutenticado, entrada: { eventoId: string; revisao: number; propostaId: string; confirmado: boolean }) {
  const e = await travarEvento(tx, entrada.eventoId);
  if (!e || !podeAcessar(usuario, e.empresa_id, PAPEIS_COMERCIAIS)) throw new ErroOperacao("Acesso negado.", 403);
  const [travada] = await tx`select 1 from propostas where id = ${entrada.propostaId} and evento_id = ${e.id} for update`;
  const propostas = await propostasDoEvento(tx, e.id);
  const p = propostas.find((x) => x.id === entrada.propostaId);
  if (!travada || !p || entrada.confirmado !== true) throw new ErroOperacao("Confirme o resumo completo antes de aprovar.", 409);
  const snapshot = await snapshotProposta(tx, e.id);
  if (p.status === "APROVADA" && isDeepStrictEqual(p.snapshot, snapshot)) return { id: p.id };
  if (e.revisao !== entrada.revisao) throw new ErroOperacao("Evento alterado. Atualize antes de aprovar.", 409);
  if (e.contrato_assinado_em || e.etapa_comercial === "PERDIDO" || p.status !== "RASCUNHO" || p.versao !== propostas[0]?.versao) throw new ErroOperacao("Aprove somente a última versão em rascunho, antes do contrato.", 409);
  if (!isDeepStrictEqual(p.snapshot, snapshot)) throw new ErroOperacao("Briefing ou cliente mudou. Salve uma nova versão com os dados atuais.", 409);
  if (p.validade < hojeSaoPaulo()) throw new ErroOperacao("Proposta vencida. Crie uma nova versão.", 409);
  if (faltaDadoContrato(e, !!(await fixosDoEvento(tx, usuario, e.id)).endereco)) throw new ErroOperacao("Complete tabela, pax, data, horários, endereço e contato no evento antes de aprovar.", 409);
  await tx`update propostas set status = 'INVALIDADA' where evento_id = ${e.id} and status = 'APROVADA'`;
  await tx`update propostas set status = 'APROVADA', aprovado_em = now(), aprovado_por = ${usuario.id} where id = ${p.id}`;
  await tx`insert into evento_valores (evento_id, valor_venda, custo_estimado, proposta_id) values (${e.id}, ${p.total}, ${p.custo_estimado}, ${p.id})
    on conflict (evento_id) do update set valor_venda = excluded.valor_venda, custo_estimado = excluded.custo_estimado, proposta_id = excluded.proposta_id, atualizado_em = now()`;
  await atualizarEvento(tx, usuario, e.id, { etapa_comercial: "QUENTE" });
  await auditar(tx, usuario, { acao: "PROPOSTA_APROVADA", entidade: "proposta", entidadeId: p.id, empresaId: e.empresa_id, dados: { eventoId: e.id, versao: p.versao } });
  return { id: p.id };
}

/**
 * Antigo trigger proteger_valor_proposta: uma venda originada em proposta aprovada não é sobrescrita por formulário.
 * Quem grava evento_valores fora do fluxo de propostas (ex.: financeiro) deve chamar antes de gravar.
 */
export async function protegerValorProposta(tx: Tx, eventoId: string, valorVenda: number | null, custoEstimado: number | null) {
  const [v] = await tx<{ status: string; total: number; custo_estimado: number | null }[]>`
    select p.status, p.total, p.custo_estimado from evento_valores v join propostas p on p.id = v.proposta_id where v.evento_id = ${eventoId}`;
  if (v && (v.status !== "APROVADA" || v.total !== valorVenda || v.custo_estimado !== custoEstimado)) throw new ErroOperacao("Revise a proposta para alterar os valores aprovados.", 409);
}

/** Handoff para a programação, explicitamente sem preços (antigo proposta_operacional). */
export async function propostaOperacional(sql: Leitura, usuario: UsuarioAutenticado, eventoId: string) {
  const [e] = await sql<{ empresa_id: string }[]>`select empresa_id from eventos where id = ${eventoId}`;
  if (!e || !podeAcessar(usuario, e.empresa_id, ["ADMIN", "PROGRAMACAO", "COMERCIAL", "ATENDIMENTO"] satisfies PapelUsuario[])) throw new ErroOperacao("Acesso negado.", 403);
  const [p] = await sql<{ versao: number; briefing: { escopo: string; restricoes: string; restritos: number }; itens: Linha[]; snapshot: unknown }[]>`
    select versao, briefing, itens, snapshot from propostas where evento_id = ${eventoId} and status = 'APROVADA'`;
  if (!p || !isDeepStrictEqual(p.snapshot, await snapshotProposta(sql, eventoId))) return null;
  return { versao: p.versao, escopo: p.briefing.escopo, restricoes: p.briefing.restricoes, restritos: p.briefing.restritos,
    itens: p.itens.map((i) => ({ nome: i.nome, servico: i.servico, quantidade: i.quantidade, unidade: i.unidade })) };
}

/** Evento (com o nome do cliente) e todas as versões, para perfis comerciais/financeiros. */
export async function consultarPropostas(sql: Leitura, usuario: UsuarioAutenticado, eventoId: string) {
  if (!temPapel(usuario, PAPEIS_FINANCEIROS)) throw new ErroOperacao("Perfil sem acesso às propostas comerciais.", 403);
  const [evento] = await linhas(sql`select to_jsonb(e) || jsonb_build_object('clientes', jsonb_build_object('nome', c.nome)) j from eventos e join clientes c on c.id = e.cliente_id where e.id = ${eventoId}`);
  if (!evento) throw new ErroOperacao("Evento não encontrado.", 404);
  autorizarEmpresa(usuario, String(evento.empresa_id));
  const propostas = await linhas(sql`select to_jsonb(p) j from propostas p where evento_id = ${eventoId} order by versao desc`);
  return { evento, propostas };
}
