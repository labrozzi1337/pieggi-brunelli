import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type postgres from "postgres";
import { z } from "zod";
import { autorizarEmpresa, type PapelUsuario, type UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import * as campo from "@/dominios/campo/ganchos";
import * as compras from "@/dominios/compras/ganchos";
import * as equipe from "@/dominios/equipe/ganchos";
import type { ProgramacaoLinha } from "@/dominios/operacao/ganchos-tipos";
import { auditar, ErroOperacao } from "@/dominios/operacao/http";
import { carregarRegras, dataSaoPaulo, PAPEIS_FINANCEIROS } from "@/dominios/regras/repositorio";
import { chaveDoNome, chavesComRegra, fixosDoCliente } from "./clientes";
import type { Tx } from "@/integrations/banco";

const texto = z.string().trim().max(5000).nullish();
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullish();
export const eventoEntrada = z.object({
  empresaId: z.string().uuid(), atualizadoEm: z.string().datetime({ offset: true }).optional(),
  registrarContratoAssinado: z.boolean().optional(), clienteId: z.string().uuid().optional(),
  titulo: z.string().trim().min(2).max(200).optional(), origemLead: texto,
  etapaComercial: z.enum(["FRIO","MORNO","QUENTE","CONTRATO_ENVIADO","CONTRATO_ASSINADO","PERDIDO"]).optional(),
  tabelaPreco: texto, pax: z.number().int().positive().max(100000).nullish(), dataEvento: z.string().date().nullish(),
  horarioInicio: hora, horarioFim: hora, logradouro: texto, numeroEndereco: texto, complemento: texto,
  bairro: texto, cidade: texto, uf: z.string().length(2).transform(v => v.toUpperCase()).nullish(), cep: texto,
  contatoLocalNome: texto, contatoLocalTelefone: texto, observacoes: texto,
  cliente: z.object({ tipo: z.enum(["PF","PJ"]), nome: z.string().trim().min(2).max(200), documento: texto, email: z.string().trim().email().nullish().or(z.literal("")), telefone: texto }).optional()
});
export type EventoEntrada = z.infer<typeof eventoEntrada>;
export function camposEvento(entrada: EventoEntrada) {
  const dados = Object.entries(entrada).filter(([k,v]) => !["empresaId","atualizadoEm","registrarContratoAssinado","cliente","clienteId"].includes(k) && v !== undefined);
  return Object.fromEntries(dados.map(([k,v]) => [k.replace(/[A-Z]/g, letra => `_${letra.toLowerCase()}`), v === "" ? null : v]));
}
export function mapearEvento(evento: Record<string, unknown>, cliente?: Record<string, unknown>) {
  const convertido = Object.fromEntries(Object.entries(evento).map(([k,v]) => [k.replace(/_([a-z])/g, (_,letra: string) => letra.toUpperCase()),v]));
  return { ...convertido, clienteNome: cliente?.nome ?? "Cliente", clienteTipo: cliente?.tipo ?? "PJ", clienteDocumento: cliente?.documento ?? null, clienteEmail: cliente?.email ?? null, clienteTelefone: cliente?.telefone ?? null,
    endereco: [evento.logradouro,evento.numero_endereco,evento.bairro,evento.cidade,evento.uf].filter(Boolean).join(", ") };
}

// ---------------------------------------------------------------------------------------------
// Núcleo do evento: tudo o que os triggers de eventos/clientes/programacoes faziam agora mora aqui.
// ---------------------------------------------------------------------------------------------

export type Leitura = postgres.ISql;
export type Linha = Record<string, unknown>;
export interface Evento extends Linha {
  id: string; empresa_id: string; cliente_id: string; titulo: string; revisao: number; atualizado_em: string;
  etapa_comercial: string; etapa_operacao: string; contrato_assinado_em: string | null; liberacao_excepcional_motivo: string | null;
  pax: number | null; data_evento: string | null;
}
export type StatusProgramacao = ProgramacaoLinha["status"];

/** Linhas no formato JSON que o PostgREST devolvia (data como texto, timestamptz com microssegundos). */
export async function linhas<T = Linha>(consulta: Promise<readonly { j: T }[]>): Promise<T[]> {
  return (await consulta).map((r) => r.j);
}

export const PAPEIS_EVENTO = ["ADMIN", "COMERCIAL", "ATENDIMENTO", "FINANCEIRO", "PROGRAMACAO", "PRODUCAO", "EXPEDICAO_COMPRAS"] as const satisfies readonly PapelUsuario[];
export const PAPEIS_COMERCIAIS = ["ADMIN", "COMERCIAL", "ATENDIMENTO"] as const satisfies readonly PapelUsuario[];
export const temPapel = (usuario: UsuarioAutenticado, papeis: readonly PapelUsuario[]) => usuario.papeis.some((p) => p === "ADMIN" || papeis.includes(p));
export const veValores = (usuario: UsuarioAutenticado) => temPapel(usuario, PAPEIS_FINANCEIROS);
/** Antigo pieggi.tem_acesso(empresa, papeis): usuário da empresa e, se pedido, com um dos papéis. */
export const podeAcessar = (usuario: UsuarioAutenticado, empresaId: string, papeis?: readonly PapelUsuario[]) =>
  usuario.empresas.includes(empresaId) && (!papeis || temPapel(usuario, papeis));

const CAMPOS_OPERACIONAIS = ["pax", "data_evento", "horario_inicio", "horario_fim", "logradouro", "numero_endereco", "complemento", "bairro", "cidade", "uf", "cep"];
const CAMPOS_BRIEFING = ["titulo", "cliente_id", "tabela_preco", ...CAMPOS_OPERACIONAIS, "contato_local_nome", "contato_local_telefone"];
const OBRIGATORIOS: Array<[string, string]> = [["tabela_preco", "tabela de preço"], ["pax", "pax"], ["data_evento", "data"], ["horario_inicio", "início"], ["horario_fim", "fim"], ["contato_local_nome", "contato"]];
const ENDERECO: Array<[string, string]> = [["logradouro", "logradouro"], ["numero_endereco", "número"], ["bairro", "bairro"], ["cidade", "cidade"], ["uf", "UF"], ["cep", "CEP"]];
/** O que falta para aprovar a proposta e formalizar o contrato. Cliente de endereço fixo (regra) não precisa do endereço estruturado. */
export function pendenciasEvento(e: Linha, enderecoFixo = false): string[] {
  const vazio = (c: string) => e[c] === null || e[c] === undefined || (typeof e[c] === "string" && !e[c].trim());
  return [...OBRIGATORIOS, ...(enderecoFixo ? [["logradouro", "endereço"] as [string, string]] : ENDERECO)].filter(([c]) => vazio(c)).map(([, nome]) => nome);
}
export const faltaDadoContrato = (e: Linha, enderecoFixo = false) => pendenciasEvento(e, enderecoFixo).length > 0;
export const liberadoParaOperar = (e: Evento) => Boolean(e.contrato_assinado_em || e.liberacao_excepcional_motivo?.trim());
export const hojeSaoPaulo = () => dataSaoPaulo(new Date());

export async function travarEvento(tx: Tx, id: string): Promise<Evento | undefined> {
  const [e] = await linhas<Evento>(tx`select to_jsonb(e) j from eventos e where id = ${id} for update`);
  return e;
}

export async function notificar(tx: Tx, e: Pick<Evento, "id" | "empresa_id">, mensagem: string) {
  await tx`insert into operacao_notificacoes (id, empresa_id, evento_id, mensagem) values (${randomUUID()}, ${e.empresa_id}, ${e.id}, ${mensagem})`;
}

/**
 * Muda o status de programações e dispara, na mesma transação, os ganchos que antes eram triggers
 * `after update of status` (ordem antiga: equipe, compras, campo).
 */
export async function alterarStatusProgramacoes(tx: Tx, usuario: UsuarioAutenticado, filtro: { eventoId: string; de: StatusProgramacao[]; id?: string }, para: StatusProgramacao) {
  const alteradas = await tx<{ linha: ProgramacaoLinha; anterior: string }[]>`
    update programacoes p set status = ${para}
      ${para === "APROVADA" ? tx`, aprovado_por = ${usuario.id}, aprovado_em = now()` : tx``}
    from (select id, status anterior from programacoes
          where evento_id = ${filtro.eventoId} and status in ${tx(filtro.de)} ${filtro.id ? tx`and id = ${filtro.id}` : tx``}
          for update) a
    where p.id = a.id
    returning to_jsonb(p) linha, a.anterior`;
  for (const { linha, anterior } of alteradas)
    for (const modulo of [equipe, compras, campo]) await modulo.aoMudarStatusProgramacao(tx, usuario, linha, anterior);
  return alteradas.map((a) => a.linha);
}

/** Snapshot comercial (evento + cliente) que a proposta congela. */
export async function snapshotProposta(sql: Leitura, eventoId: string): Promise<unknown> {
  const [r] = await sql<{ s: unknown }[]>`
    select jsonb_build_object(
      'evento', jsonb_build_object('titulo',e.titulo,'tabelaPreco',e.tabela_preco,'pax',e.pax,'data',e.data_evento,'inicio',e.horario_inicio,'fim',e.horario_fim,'logradouro',e.logradouro,'numero',e.numero_endereco,'complemento',e.complemento,'bairro',e.bairro,'cidade',e.cidade,'uf',e.uf,'cep',e.cep,'contato',e.contato_local_nome,'telefone',e.contato_local_telefone),
      'cliente', jsonb_build_object('id',c.id,'tipo',c.tipo,'nome',c.nome,'documento',c.documento,'email',c.email,'telefone',c.telefone)) s
    from eventos e join clientes c on c.id = e.cliente_id where e.id = ${eventoId}`;
  return r?.s;
}

export interface PropostaResumo { id: string; versao: number; status: string; snapshot: unknown; validade: string; total: number; custo_estimado: number | null }
export async function propostasDoEvento(sql: Leitura, eventoId: string) {
  return sql<PropostaResumo[]>`select id, versao, status, snapshot, validade::text validade, total, custo_estimado from propostas where evento_id = ${eventoId} order by versao desc`;
}
/** Proposta aprovada, última versão, com o briefing atual e dentro da validade. */
export function propostaVigente(propostas: readonly PropostaResumo[], snapshot: unknown) {
  const p = propostas.find((x) => x.status === "APROVADA");
  return p && p.versao === propostas[0]?.versao && isDeepStrictEqual(p.snapshot, snapshot) && p.validade >= hojeSaoPaulo() ? p : undefined;
}

async function invalidarPropostasAprovadas(tx: Tx, eventoIds: string[]) {
  if (!eventoIds.length) return;
  await tx`update propostas set status = 'INVALIDADA' where status = 'APROVADA' and evento_id in ${tx(eventoIds)}`;
  await tx`update evento_valores set proposta_id = null, valor_venda = null, custo_estimado = null where proposta_id is not null and evento_id in ${tx(eventoIds)}`;
}

/** Antigo trigger proposta_portao_evento. */
async function portaoPropostaEvento(tx: Tx, antes: Evento, novo: Evento, mudou: (campos: readonly string[]) => boolean) {
  const propostas = await propostasDoEvento(tx, antes.id);
  if (mudou(CAMPOS_BRIEFING)) {
    if (antes.contrato_assinado_em && propostas.some((p) => p.status === "APROVADA")) throw new ErroOperacao("Contrato já assinado. Trate o aditivo antes de mudar o briefing aprovado.", 409);
    await invalidarPropostasAprovadas(tx, [antes.id]);
  }
  const formaliza = (novo.etapa_comercial === "CONTRATO_ENVIADO" && antes.etapa_comercial !== "CONTRATO_ENVIADO") || (novo.contrato_assinado_em && !antes.contrato_assinado_em);
  if (formaliza && propostas.length) {
    // Relê: o bloco acima pode ter acabado de invalidar a aprovada.
    if (!propostaVigente(await propostasDoEvento(tx, antes.id), await snapshotProposta(tx, antes.id))) throw new ErroOperacao("Aprove a proposta vigente antes de formalizar o contrato.", 409);
  }
}

/** Antigo trigger proposta_portao_cliente: mudar dados cadastrais derruba propostas aprovadas dos eventos do cliente. */
export async function portaoPropostaCliente(tx: Tx, clienteId: string) {
  const [contratado] = await tx`select 1 from eventos e join propostas p on p.evento_id = e.id and p.status = 'APROVADA' where e.cliente_id = ${clienteId} and e.contrato_assinado_em is not null limit 1`;
  if (contratado) throw new ErroOperacao("Cliente vinculado a proposta contratada. Trate o aditivo antes de alterar os dados.", 409);
  const eventos = await tx<{ id: string }[]>`select id from eventos where cliente_id = ${clienteId} order by id for update`;
  await invalidarPropostasAprovadas(tx, eventos.map((e) => e.id));
}

/**
 * Única porta de escrita em `eventos` depois da criação. Aplica, na ordem, o que os antigos triggers faziam:
 * evento_bloquear_edicao_tardia (gancho do campo), evento_proposta_portao, evento_proteger_fluxo
 * (revisão, invalidação da programação, efeitos da assinatura) e evento_filas (integrações).
 * Cada chamada incrementa `revisao` uma vez. `alteracoes` usa os nomes das colunas.
 */
export async function atualizarEvento(tx: Tx, usuario: UsuarioAutenticado, id: string, alteracoes: Linha = {}): Promise<Evento> {
  const [r] = await tx<{ antes: Evento; novo: Evento }[]>`
    select to_jsonb(e) antes, to_jsonb(jsonb_populate_record(e, ${tx.json(alteracoes)}::jsonb)) novo from eventos e where id = ${id} for update`;
  if (!r) throw new ErroOperacao("Evento não encontrado.", 404);
  const { antes, novo } = r;
  const diferencas = () => Object.fromEntries(Object.keys(novo).filter((k) => !isDeepStrictEqual(antes[k], novo[k])).map((k) => [k, novo[k]]));
  const mudou = (campos: readonly string[]) => campos.some((c) => !isDeepStrictEqual(antes[c], novo[c]));

  await campo.validarEdicaoEvento(tx, id, diferencas());
  await portaoPropostaEvento(tx, antes, novo, mudou);
  if (antes.contrato_assinado_em && !novo.contrato_assinado_em) throw new ErroOperacao("Contrato assinado exige procedimento de cancelamento.", 409);
  if (mudou(CAMPOS_OPERACIONAIS) && (await alterarStatusProgramacoes(tx, usuario, { eventoId: id, de: ["APROVADA"] }, "INVALIDADA")).length) {
    novo.etapa_operacao = "PROGRAMACAO";
    await notificar(tx, novo, "Dados do evento alterados. Programação e derivados bloqueados até nova aprovação.");
  }
  if (novo.contrato_assinado_em && !antes.contrato_assinado_em) { novo.etapa_comercial = "CONTRATO_ASSINADO"; novo.etapa_operacao = "PROGRAMACAO"; }

  const [final] = await linhas<Evento>(tx`
    update eventos set ${tx({ ...diferencas(), revisao: antes.revisao + 1 } as never)}, atualizado_em = now() where id = ${id} returning to_jsonb(eventos) j`);
  if (!final) throw new ErroOperacao("Evento não encontrado.", 404);
  const filas = [
    ...(final.contrato_assinado_em ? ["AGENDA", "FATURAMENTO"] : []),
    ...(final.etapa_operacao === "ENTREGUE" ? ["POS_EVENTO"] : [])
  ].map((tipo) => ({ id: randomUUID(), empresa_id: final.empresa_id, evento_id: final.id, tipo }));
  if (filas.length) await tx`insert into integracao_fila ${tx(filas)} on conflict do nothing`;
  return final;
}

/** Antigo salvar_evento: CRUD comercial atômico (cria/atualiza evento e cliente). Sem `id` cria. */
export async function salvarEvento(tx: Tx, usuario: UsuarioAutenticado, id: string | null, entrada: EventoEntrada) {
  const empresa = entrada.empresaId;
  if (!podeAcessar(usuario, empresa, PAPEIS_COMERCIAIS)) throw new ErroOperacao("Acesso negado.", 403);
  const campos = camposEvento(entrada);
  let clienteId: string | undefined;
  if (id) {
    const [atual] = await tx<{ e: Evento; em_dia: boolean }[]>`
      select to_jsonb(e) e, e.atualizado_em = ${entrada.atualizadoEm ?? null}::timestamptz em_dia from eventos e where id = ${id} and empresa_id = ${empresa} for update`;
    if (!atual) throw new ErroOperacao("Evento não encontrado.", 403);
    if (!atual.em_dia) throw new ErroOperacao("Evento alterado por outra pessoa. Atualize a tela.", 409);
    if (campos.etapa_comercial === "CONTRATO_ASSINADO" && !atual.e.contrato_assinado_em) throw new ErroOperacao("Registre o PDF assinado na operação.", 409);
    if (atual.e.contrato_assinado_em && "etapa_comercial" in campos && campos.etapa_comercial !== "CONTRATO_ASSINADO") throw new ErroOperacao("Contrato assinado não pode voltar no funil.", 409);
    clienteId = atual.e.cliente_id;
  } else if ("etapa_comercial" in campos) throw new ErroOperacao("Novo evento inicia em Frio.", 409);

  if (entrada.clienteId && !id) {
    const [existente] = await tx<{ id: string }[]>`select id from clientes where id = ${entrada.clienteId} and empresa_id = ${empresa}`;
    if (!existente) throw new ErroOperacao("Cliente não encontrado.", 404);
    clienteId = existente.id;
  } else if (entrada.cliente) {
    const c = entrada.cliente;
    const dados = { tipo: c.tipo, nome: c.nome, documento: (c.documento ?? "").replace(/\D/g, "") || null, email: c.email || null, telefone: c.telefone || null };
    if (!clienteId && dados.documento) clienteId = (await tx<{ id: string }[]>`select id from clientes where empresa_id = ${empresa} and documento = ${dados.documento}`)[0]?.id;
    if (!clienteId) {
      clienteId = randomUUID();
      const chave = chaveDoNome(dados.nome, chavesComRegra(await carregarRegras(tx, usuario)));
      await tx`insert into clientes ${tx({ id: clienteId, empresa_id: empresa, ...dados, chave_regras: chave })}`;
    } else if (id) {
      const [atual] = await tx<Linha[]>`select tipo, nome, documento, email, telefone from clientes where id = ${clienteId} and empresa_id = ${empresa} for update`;
      if (atual && !isDeepStrictEqual({ ...atual }, dados)) await portaoPropostaCliente(tx, clienteId);
      await tx`update clientes set ${tx(dados)}, atualizado_em = now() where id = ${clienteId} and empresa_id = ${empresa}`;
    }
  }
  if (!clienteId) throw new ErroOperacao("Informe o cliente.", 409);

  // Cliente de endereço fixo (StartSe, Inteli, WTC…): endereço e contato vêm das regras — ninguém digita. Tabela padrão se vazia.
  const [cli] = await tx<{ chave_regras: string | null }[]>`select chave_regras from clientes where id = ${clienteId}`;
  const [anterior] = id ? await tx<{ data_evento: string | null; tabela_preco: string | null; contato_local_nome: string | null }[]>`
    select data_evento::text, tabela_preco, contato_local_nome from eventos where id = ${id}` : [];
  const fixos = fixosDoCliente(await carregarRegras(tx, usuario), cli?.chave_regras ?? null, (campos.data_evento as string | undefined) ?? anterior?.data_evento ?? hojeSaoPaulo());
  if (fixos.endereco) Object.assign(campos, { logradouro: fixos.endereco, numero_endereco: null, bairro: null, cidade: null, uf: null, cep: null });
  if (fixos.contato && !(campos.contato_local_nome ?? anterior?.contato_local_nome)) campos.contato_local_nome = fixos.contato;
  if (fixos.tabela && !(campos.tabela_preco ?? anterior?.tabela_preco)) campos.tabela_preco = fixos.tabela;

  const [{ novo } = { novo: {} as Evento }] = await tx<{ novo: Evento }[]>`
    select to_jsonb(jsonb_populate_record(${id ? tx`e` : tx`null::eventos`}, ${tx.json(campos)}::jsonb)) novo
    ${id ? tx`from eventos e where e.id = ${id}` : tx``}`;
  if (String(novo.titulo ?? "").trim().length < 2) throw new ErroOperacao("Informe o título do evento.", 409);
  const [inicio, fim] = [novo.horario_inicio, novo.horario_fim] as (string | null)[];
  if (inicio && fim && fim <= inicio) throw new ErroOperacao("Término deve ser posterior ao início.", 409);
  if (["CONTRATO_ENVIADO", "CONTRATO_ASSINADO"].includes(novo.etapa_comercial) && faltaDadoContrato(novo, !!fixos.endereco)) throw new ErroOperacao("Complete os dados obrigatórios antes do contrato.", 409);
  const normalizados = Object.fromEntries(Object.keys(campos).map((k) => [k, novo[k]]));

  const eventoId = id ?? randomUUID();
  if (id) await atualizarEvento(tx, usuario, id, normalizados);
  else await tx`insert into eventos ${tx({ id: eventoId, empresa_id: empresa, cliente_id: clienteId, criado_por: usuario.id, ...normalizados } as never)}`;
  const [evento] = await linhas(tx`select to_jsonb(e) j from eventos e where id = ${eventoId}`);
  const [cliente] = await linhas(tx`select to_jsonb(c) j from clientes c where id = ${clienteId}`);
  await auditar(tx, usuario, { acao: id ? "EVENTO_ATUALIZADO" : "EVENTO_CRIADO", entidade: "evento", entidadeId: eventoId, empresaId: empresa });
  return { evento: evento as Linha, cliente: cliente as Linha };
}

/** Lista do funil com o resumo de artefatos (antigo resumo_artefatos_eventos). Cliente só para perfis comerciais/financeiros. */
/** Eventos encerrados (entregues ou perdidos) há mais que isto só aparecem quando o usuário pede o histórico. */
export const JANELA_EVENTOS_DIAS = 90;
const naJanela = (sql: Leitura, historico: boolean) => historico ? sql``
  : sql`and not (e.data_evento < current_date - ${JANELA_EVENTOS_DIAS}::int and (e.etapa_operacao = 'ENTREGUE' or e.etapa_comercial = 'PERDIDO'))`;

export async function listarEventos(sql: Leitura, usuario: UsuarioAutenticado, empresa: string, historico = false) {
  autorizarEmpresa(usuario, empresa);
  if (!temPapel(usuario, PAPEIS_EVENTO)) throw new ErroOperacao("Acesso negado.", 403);
  const [eventos, clientes, artefatos] = await Promise.all([
    linhas(sql`select to_jsonb(e) j from eventos e where empresa_id = ${empresa} ${naJanela(sql, historico)} order by data_evento nulls last, id`),
    veValores(usuario) ? linhas(sql`select to_jsonb(x) j from (select id, tipo, nome, documento, email, telefone from clientes where empresa_id = ${empresa}) x`) : Promise.resolve([]),
    resumoArtefatos(sql, empresa, historico)
  ]);
  const mapa = new Map(clientes.map((c) => [c.id, c]));
  const resumo = new Map(artefatos.map((a) => [a.eventoId, a]));
  return eventos.map((e) => ({ ...mapearEvento(e, mapa.get(e.cliente_id)), artefatos: resumo.get(String(e.id)) }));
}

/** Indicadores do card. Não expõe fornecedor, custo, valor, foto ou conteúdo de documentos. */
export async function resumoArtefatos(sql: Leitura, empresa: string, historico = true) {
  const fatos = await sql<{
    evento_id: string; versao: number | null; status: string | null; setores: (string | null)[]; comandas: string[]; plaquinhas: boolean;
    demandas: number; demandas_abertas: number; fotos: number; fotos_abertas: number; etapas: number; etapas_abertas: number;
  }[]>`
    select e.id evento_id, p.versao, p.status,
      coalesce((select array_agg(distinct i->>'setor') from jsonb_array_elements(p.itens) i), '{}') setores,
      coalesce((select array_agg(distinct d.setor) from documentos_operacionais d where d.programacao_id = p.id and d.tipo = 'COMANDA'), '{}') comandas,
      exists(select 1 from documentos_operacionais d where d.programacao_id = p.id and d.tipo = 'PLAQUINHAS') plaquinhas,
      (select count(*)::int from compra_demandas d where d.programacao_id = p.id) demandas,
      (select count(*)::int from compra_demandas d where d.programacao_id = p.id and (d.pendencia is not null or d.comprado_em is null)) demandas_abertas,
      (select count(*)::int from operacao_tarefas t where t.programacao_id = p.id and t.tipo = 'CAMPO') fotos,
      (select count(*)::int from operacao_tarefas t where t.programacao_id = p.id and t.tipo = 'CAMPO' and t.estado <> 'PRONTO') fotos_abertas,
      (select count(*)::int from campo_etapas t where t.programacao_id = p.id) etapas,
      (select count(*)::int from campo_etapas t where t.programacao_id = p.id and t.concluido_em is null) etapas_abertas
    from eventos e
    left join lateral (select pr.id, pr.versao, pr.status, pr.itens from programacoes pr where pr.evento_id = e.id order by pr.versao desc limit 1) p on true
    where e.empresa_id = ${empresa} ${naJanela(sql, historico)} order by e.id`;
  return fatos.map((f) => {
    const situacao = (pronto: boolean) => f.status !== "APROVADA" ? "BLOQUEADO" : pronto ? "PRONTO" : "PENDENTE";
    return {
      eventoId: f.evento_id, versao: f.versao, programacao: f.status ?? "PENDENTE",
      comanda: situacao(f.setores.every((s) => s !== null && f.comandas.includes(s))),
      plaquinhas: situacao(f.plaquinhas),
      compras: situacao(f.demandas > 0 && f.demandas_abertas === 0),
      campo: situacao(f.fotos === 4 && f.etapas > 0 && f.etapas_abertas === 0 && f.fotos_abertas === 0)
    };
  });
}
