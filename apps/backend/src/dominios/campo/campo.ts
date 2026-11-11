// Campo: link temporário (token), fotos e roteiro, evidências de tarefa. Porta fiel das antigas RPCs
// gerenciar_acesso_campo, consultar_campo, registrar_foto_campo, concluir_etapa_campo e concluir_tarefa_evidencia.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getServerEnv } from "@/config/env";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { ErroAutorizacao, type PapelUsuario, type UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import { auditar, ErroOperacao, travarRevisao } from "@/dominios/operacao/http";
import type { Sql, Tx } from "@/integrations/banco";

export const ORDEM_FOTOS = ["Chegada ao local", "Higienização e mesa montada", "Reposição", "Desmontagem"];
const INDISPONIVEL = "Link indisponível, revogado ou fora do dia do evento.";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export const emTransacao = <T>(sql: Sql, fn: (tx: Tx) => Promise<T>) => sql.begin(fn) as Promise<T>;

/** Substitui pieggi.tem_acesso: empresa do usuário + um dos papéis (ADMIN sempre listado pelo chamador). */
export function exigirAcesso(usuario: UsuarioAutenticado, empresaId: string | undefined, papeis: readonly PapelUsuario[], mensagem = "Acesso negado.") {
  if (!empresaId || !usuario.empresas.includes(empresaId) || !usuario.papeis.some(p => papeis.includes(p))) throw new ErroOperacao(mensagem, 403);
}

export interface EventoTravado {
  id: string; empresa_id: string; revisao: number; etapa_operacao: string; contrato_assinado_em: Date | null;
  liberacao_excepcional_motivo: string | null; data_evento: Date | null; hoje: boolean; passado: boolean;
  [coluna: string]: unknown;
}
/** select ... for update do evento, já com "é hoje/já passou" no fuso de São Paulo. */
export async function travarEvento(tx: Tx, id: string | undefined): Promise<EventoTravado | undefined> {
  if (!id) return undefined;
  const [e] = await tx<EventoTravado[]>`select *, coalesce(data_evento = (now() at time zone 'America/Sao_Paulo')::date, false) as hoje,
    coalesce(data_evento < (now() at time zone 'America/Sao_Paulo')::date, false) as passado from eventos where id = ${id} for update`;
  return e;
}

/** O antigo trigger evento_proteger_fluxo incrementava a revisão em todo update de eventos. */
export const tocarEvento = (tx: Tx, e: EventoTravado) => travarRevisao(tx, "eventos", e.id, e.revisao);

export function exigirRevisao(e: EventoTravado, revisao: number, mensagem = "Evento alterado. Atualize a tela.") {
  if (revisao !== e.revisao) throw new ErroOperacao(mensagem, 409);
}

/** Antes a policy de storage e o "exists em storage.objects" garantiam isso. O upload é feito pelo backend
 * (service role) no mesmo request; aqui conferimos que o caminho pertence ao evento (e ao link, no campo). */
export function caminhoValido(path: string, prefixo: string[], extensoes: string[]) {
  return new RegExp(`^${prefixo.join("/")}/${UUID}\\.(${extensoes.join("|")})$`).test(path);
}
export const EXT_FOTO = ["jpg", "png", "webp"];

/** Bucket privado de evidências pelo service role; a autorização acontece antes, no código. */
export function evidencias() {
  const env = getServerEnv();
  if (!env.ok) throw new ErroAutorizacao("Serviço de arquivos não configurado.", 503);
  return createServerSupabaseClient(env.data).storage.from("pieggi-evidencias");
}
export const novoCaminho = (prefixo: string[], extensao: string) => `${prefixo.join("/")}/${randomUUID()}.${extensao}`;

async function auditarCampo(tx: Tx, empresaId: string, acao: string, eventoId: string, dados: Record<string, unknown>) {
  await tx`insert into auditoria_eventos (id, empresa_id, usuario_id, acao, entidade, entidade_id, dados)
    values (${randomUUID()}, ${empresaId}, null, ${acao}, 'evento', ${eventoId}, ${tx.json(dados)})`;
}

// ---------- gestão dos links (usuário interno) ----------
const PAPEIS_LINK: PapelUsuario[] = ["ADMIN", "EXPEDICAO_COMPRAS"];
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function listarAcessosCampo(sql: Sql, usuario: UsuarioAutenticado, eventoId: string) {
  const [e] = await sql<{ empresa_id: string }[]>`select empresa_id from eventos where id = ${eventoId}`;
  exigirAcesso(usuario, e?.empresa_id, PAPEIS_LINK);
  return sql<{ id: string; responsavel: string; expira_em: Date; revogado_em: Date | null; criado_em: Date }[]>`
    select id, responsavel, expira_em, revogado_em, criado_em from campo_acessos where evento_id = ${eventoId} order by criado_em desc limit 20`;
}

/** Cria (revogando os anteriores) ou revoga o link de campo. Só o hash do token vai ao banco. */
export function gerenciarAcessoCampo(sql: Sql, usuario: UsuarioAutenticado, entrada: { eventoId: string; responsavel?: string; revogarId?: string }) {
  return emTransacao(sql, async tx => {
    const e = await travarEvento(tx, entrada.eventoId);
    exigirAcesso(usuario, e?.empresa_id, PAPEIS_LINK);
    const evento = e!;
    let id: string; let expiraEm: Date | null = null; let token: string | null = null;
    if (entrada.revogarId) {
      const [r] = await tx<{ id: string }[]>`update campo_acessos set revogado_em = now() where id = ${entrada.revogarId} and evento_id = ${evento.id} and revogado_em is null returning id`;
      if (!r) throw new ErroOperacao("Link já revogado ou indisponível.", 409);
      id = r.id;
    } else {
      if (!evento.data_evento || evento.passado || evento.etapa_operacao === "ENTREGUE") throw new ErroOperacao("Informe uma data válida para o evento.", 409);
      const responsavel = entrada.responsavel?.trim() ?? "";
      if (responsavel.length < 2 || responsavel.length > 100) throw new ErroOperacao("Responsável ou token inválido.", 409);
      if (!evento.contrato_assinado_em && !evento.liberacao_excepcional_motivo?.trim()) throw new ErroOperacao("Formalize o contrato antes de compartilhar o campo.", 409);
      token = randomBytes(32).toString("base64url");
      await tx`update campo_acessos set revogado_em = now() where evento_id = ${evento.id} and revogado_em is null`;
      const [a] = await tx<{ id: string; expira_em: Date }[]>`insert into campo_acessos (id, evento_id, empresa_id, token_hash, responsavel, expira_em, criado_por)
        select ${randomUUID()}, id, empresa_id, ${hashToken(token)}, ${responsavel}, (data_evento + 1)::timestamp at time zone 'America/Sao_Paulo', ${usuario.id}
        from eventos where id = ${evento.id} returning id, expira_em`;
      id = a!.id; expiraEm = a!.expira_em;
    }
    await auditar(tx, usuario, { acao: entrada.revogarId ? "CAMPO_LINK_REVOGADO" : "CAMPO_LINK_CRIADO", entidade: "evento", entidadeId: evento.id, empresaId: evento.empresa_id, dados: { acessoId: id } });
    return { id, expiraEm, token };
  });
}

// ---------- acesso público pelo token ----------
/** Camada 1: consulta pelo hash; recusa link revogado, expirado ou fora do dia do evento. */
export async function consultarCampo(sql: Sql, hash: string): Promise<Record<string, unknown>> {
  const [r] = await sql<{ dados: Record<string, unknown> }[]>`
    with a as (select * from campo_acessos where token_hash = ${hash} and revogado_em is null and expira_em > now()),
    e as (select ev.* from eventos ev join a on a.evento_id = ev.id where ev.data_evento = (now() at time zone 'America/Sao_Paulo')::date),
    p as (select * from programacoes where evento_id = (select id from e) and status = 'APROVADA')
    select jsonb_build_object('acessoId', a.id, 'responsavel', a.responsavel, 'expiraEm', a.expira_em,
      'evento', jsonb_build_object('id', e.id, 'titulo', e.titulo, 'revisao', e.revisao, 'etapa', e.etapa_operacao, 'data', e.data_evento, 'inicio', e.horario_inicio, 'fim', e.horario_fim, 'pax', e.pax,
        'logradouro', e.logradouro, 'numero', e.numero_endereco, 'complemento', e.complemento, 'bairro', e.bairro, 'cidade', e.cidade, 'uf', e.uf, 'contato', e.contato_local_nome, 'telefone', e.contato_local_telefone),
      'programacao', case when p.id is not null then jsonb_build_object('id', p.id, 'versao', p.versao, 'alteracoes', p.alteracoes, 'saidaEm', p.saida_em, 'itens', p.itens) end,
      'tarefas', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'titulo', t.titulo, 'estado', t.estado, 'atualizadoEm', t.atualizado_em)
          order by array_position(${ORDEM_FOTOS}::text[], t.titulo)), '[]') from operacao_tarefas t where t.programacao_id = p.id and t.tipo = 'CAMPO'),
      'etapas', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'ordem', t.ordem, 'tipo', t.tipo, 'titulo', t.titulo, 'orientacao', t.orientacao, 'previstoEm', t.previsto_em,
          'concluidoEm', t.concluido_em, 'observacao', t.observacao) order by t.ordem), '[]') from campo_etapas t where t.programacao_id = p.id)) as dados
    from a join e on true left join p on true`;
  if (!r) throw new ErroOperacao(INDISPONIVEL, 403);
  return r.dados;
}

/** Camada 2: revalida o token sob lock do evento e do acesso, dentro da transação da escrita. */
async function travarCampo(tx: Tx, hash: string) {
  const [a0] = await tx<{ id: string; evento_id: string }[]>`select id, evento_id from campo_acessos where token_hash = ${hash}`;
  const e = await travarEvento(tx, a0?.evento_id);
  const [a] = a0 ? await tx<{ id: string; responsavel: string; valido: boolean }[]>`
    select id, responsavel, (revogado_em is null and expira_em > now()) as valido from campo_acessos where id = ${a0.id} for share` : [];
  if (!e || !a || !a.valido || !e.hoje) throw new ErroOperacao(INDISPONIVEL, 403);
  return { a, e };
}

/** Antigo trigger campo_foto_exige_roteiro: foto de fase só depois das etapas daquela fase do roteiro. */
async function exigirRoteiroDaFoto(tx: Tx, t: { tipo: string; titulo: string; programacao_id: string }) {
  if (t.tipo !== "CAMPO") return;
  const fase = ({ "Higienização e mesa montada": "MONTAGEM", "Reposição": "REPOSICAO", "Desmontagem": "DESMONTAGEM" } as Record<string, string>)[t.titulo];
  if (!fase) return;
  const [pendente] = await tx`select 1 from campo_etapas where programacao_id = ${t.programacao_id} and tipo = ${fase} and concluido_em is null limit 1`;
  if (pendente) throw new ErroOperacao("Conclua as etapas correspondentes do roteiro antes de enviar esta foto.", 409);
}

interface Tarefa { id: string; evento_id: string; programacao_id: string; tipo: string; titulo: string; estado: string; evidencia_obrigatoria: boolean; aprovada: boolean }
const tarefaTravada = (tx: Tx, id: string, eventoId: string) => tx<Tarefa[]>`
  select t.*, exists(select 1 from programacoes p where p.id = t.programacao_id and p.status = 'APROVADA') as aprovada
  from operacao_tarefas t where t.id = ${id} and t.evento_id = ${eventoId} for update of t`;

export function registrarFotoCampo(sql: Sql, hash: string, entrada: { tarefaId: string; revisao: number; path: string }) {
  return emTransacao(sql, async tx => {
    const { a, e } = await travarCampo(tx, hash);
    exigirRevisao(e, entrada.revisao, "Evento alterado. Atualize antes de enviar.");
    if (e.etapa_operacao !== "EM_CAMPO") throw new ErroOperacao("A expedição ainda não liberou o evento ou ele já foi encerrado.", 409);
    const [t] = await tarefaTravada(tx, entrada.tarefaId, e.id);
    if (!t || t.tipo !== "CAMPO" || !t.evidencia_obrigatoria || !t.aprovada) throw new ErroOperacao("Tarefa indisponível nesta programação.", 403);
    if (t.estado === "PRONTO") throw new ErroOperacao("Foto já registrada. Atualize a tela.", 409);
    const ordem = ORDEM_FOTOS.indexOf(t.titulo);
    const [anteriorPendente] = ordem < 0 ? [true] : await tx`select 1 from operacao_tarefas where programacao_id = ${t.programacao_id} and tipo = 'CAMPO'
      and array_position(${ORDEM_FOTOS}::text[], titulo) < ${ordem + 1} and estado <> 'PRONTO' limit 1`;
    if (anteriorPendente) throw new ErroOperacao("Conclua a etapa anterior antes de continuar.", 409);
    if (!caminhoValido(entrada.path, [e.id, a.id], EXT_FOTO)) throw new ErroOperacao("Foto inválida para este evento.", 409);
    await exigirRoteiroDaFoto(tx, t);
    await tx`update operacao_tarefas set estado = 'PRONTO', evidencia_path = ${entrada.path}, concluido_por = null, atualizado_em = now() where id = ${t.id}`;
    await tocarEvento(tx, e);
    await auditarCampo(tx, e.empresa_id, "CAMPO_FOTO_REGISTRADA", e.id, { acessoId: a.id, responsavel: a.responsavel, tarefaId: t.id });
    return { id: t.id };
  });
}

export function concluirEtapaCampo(sql: Sql, hash: string, entrada: { etapaId: string; revisao: number; observacao: string }) {
  return emTransacao(sql, async tx => {
    const { a, e } = await travarCampo(tx, hash);
    const [t] = await tx<{ id: string; programacao_id: string; ordem: number; tipo: string; concluido_em: Date | null; aprovada: boolean }[]>`
      select t.*, exists(select 1 from programacoes p where p.id = t.programacao_id and p.status = 'APROVADA') as aprovada
      from campo_etapas t where t.id = ${entrada.etapaId} and t.evento_id = ${e.id} for update of t`;
    if (!t || !t.aprovada) throw new ErroOperacao("Etapa indisponível nesta programação.", 403);
    if (t.concluido_em) return { id: t.id };
    exigirRevisao(e, entrada.revisao, "Evento alterado. Atualize antes de continuar.");
    if (e.etapa_operacao !== "EM_CAMPO") throw new ErroOperacao("A expedição ainda não liberou o evento ou ele já foi encerrado.", 409);
    if (entrada.observacao.length > 1000) throw new ErroOperacao("Observação excede o limite.", 409);
    const foto = async (titulo: string) => (await tx`select 1 from operacao_tarefas where programacao_id = ${t.programacao_id} and tipo = 'CAMPO' and titulo = ${titulo} and estado = 'PRONTO'`).length > 0;
    if (!await foto("Chegada ao local")) throw new ErroOperacao("Registre a foto de chegada antes de iniciar o roteiro.", 409);
    if (t.tipo !== "MONTAGEM" && !await foto(t.tipo === "REPOSICAO" ? "Higienização e mesa montada" : "Reposição")) throw new ErroOperacao("Registre a foto da fase anterior antes de continuar o roteiro.", 409);
    const [anterior] = await tx`select 1 from campo_etapas where programacao_id = ${t.programacao_id} and ordem < ${t.ordem} and concluido_em is null limit 1`;
    if (anterior) throw new ErroOperacao("Conclua a etapa anterior do roteiro.", 409);
    await tx`update campo_etapas set concluido_em = now(), acesso_id = ${a.id}, observacao = ${entrada.observacao.trim() || null} where id = ${t.id}`;
    await tocarEvento(tx, e);
    await auditarCampo(tx, e.empresa_id, "CAMPO_ETAPA_CONCLUIDA", e.id, { etapaId: t.id, acessoId: a.id, responsavel: a.responsavel });
    return { id: t.id };
  });
}

// ---------- evidência de tarefa (usuário interno) ----------
export const PAPEIS_EVIDENCIA: PapelUsuario[] = ["ADMIN", "EXPEDICAO_COMPRAS"];
export const PAPEIS_LEITURA_OPERACAO: PapelUsuario[] = ["ADMIN", "COMERCIAL", "ATENDIMENTO", "FINANCEIRO", "PROGRAMACAO", "PRODUCAO", "EXPEDICAO_COMPRAS"];

export function concluirTarefaEvidencia(sql: Sql, usuario: UsuarioAutenticado, entrada: { tarefaId: string; revisao: number; path: string }) {
  return emTransacao(sql, async tx => {
    const [t0] = await tx<{ evento_id: string }[]>`select evento_id from operacao_tarefas where id = ${entrada.tarefaId}`;
    const e = await travarEvento(tx, t0?.evento_id);
    exigirAcesso(usuario, e?.empresa_id, PAPEIS_EVIDENCIA);
    const evento = e!;
    exigirRevisao(evento, entrada.revisao);
    const [t] = await tarefaTravada(tx, entrada.tarefaId, evento.id);
    if (evento.etapa_operacao !== "EM_CAMPO" || !t!.evidencia_obrigatoria) throw new ErroOperacao("Evidência disponível apenas para tarefa de campo em andamento.", 409);
    if (!t!.aprovada) throw new ErroOperacao("Programação invalidada.", 409);
    if (!caminhoValido(entrada.path, [evento.id], EXT_FOTO)) throw new ErroOperacao("Envie uma foto válida antes de concluir.", 409);
    if (t!.estado === "PRONTO") throw new ErroOperacao("Evidência já registrada.", 409);
    await exigirRoteiroDaFoto(tx, t!);
    await tx`update operacao_tarefas set estado = 'PRONTO', evidencia_path = ${entrada.path}, concluido_por = ${usuario.id}, atualizado_em = now() where id = ${t!.id}`;
    await tocarEvento(tx, evento);
    await auditar(tx, usuario, { acao: "EVIDENCIA_REGISTRADA", entidade: "evento", entidadeId: evento.id, empresaId: evento.empresa_id, dados: { tarefaId: t!.id } });
    return { id: t!.id };
  });
}
