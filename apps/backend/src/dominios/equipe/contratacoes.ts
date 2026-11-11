import { randomUUID } from "node:crypto";
import { z } from "zod";
import { autorizarEmpresa, ErroAutorizacao, exigirPapel, type PapelUsuario, type UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import { auditar, ErroOperacao, travarRevisao } from "@/dominios/operacao/http";
import { dataSaoPaulo } from "@/dominios/regras/repositorio";
import type { Sql, Tx } from "@/integrations/banco";
import { custoEquipeDoEvento, freelancersDoEvento, verbaDoEvento } from "./freelancers";
import { centavos, compararVerba } from "./regras-freelancer";

// Contratações de equipe/locação/insumo por evento (porte da antiga função operar_equipe):
// solicitação → verba aprovada pelo financeiro → aceite do fornecedor → despesa realizada.

const LER: readonly PapelUsuario[] = ["ADMIN", "PROGRAMACAO", "EXPEDICAO_COMPRAS", "FINANCEIRO", "ATENDIMENTO", "COMERCIAL"];
const VALORES: readonly PapelUsuario[] = ["ADMIN", "FINANCEIRO", "COMERCIAL", "ATENDIMENTO"];
const OPERACIONAL: readonly PapelUsuario[] = ["ADMIN", "PROGRAMACAO", "EXPEDICAO_COMPRAS"];
const FINANCEIRO: readonly PapelUsuario[] = ["ADMIN", "FINANCEIRO"];

const dinheiro = z.number().nonnegative().max(999999999).refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001, "Use duas casas decimais.");
const escala = z.object({ fornecedorId: z.string().uuid(), categoria: z.enum(["EQUIPE", "LOCACAO", "INSUMO"]), funcao: z.string().trim().min(2).max(200), inicio: z.string().datetime({ offset: true }), fim: z.string().datetime({ offset: true }), orientacoes: z.string().trim().max(5000) });
const referencia = z.string().trim().min(2).max(300);
export const comandoEquipe = z.object({
  eventoId: z.string().uuid(), revisao: z.number().int().positive(), comando: z.discriminatedUnion("acao", [
    z.object({ acao: z.literal("SOLICITAR"), dados: escala.extend({ id: z.string().uuid() }).strict() }),
    z.object({ acao: z.literal("EDITAR"), dados: escala.extend({ id: z.string().uuid() }).strict() }),
    z.object({ acao: z.literal("VERBA"), dados: z.object({ limite: dinheiro }).strict() }),
    z.object({ acao: z.literal("APROVAR"), dados: z.object({ id: z.string().uuid(), valor: dinheiro.refine((v) => v > 0), referencia }).strict() }),
    z.object({ acao: z.literal("CONFIRMAR"), dados: z.object({ id: z.string().uuid(), referencia }).strict() }),
    z.object({ acao: z.literal("REALIZAR"), dados: z.object({ id: z.string().uuid(), referencia, competencia: z.string().date() }).strict() }),
    z.object({ acao: z.literal("CANCELAR"), dados: z.object({ id: z.string().uuid(), motivo: z.string().trim().min(5).max(500) }).strict() })
  ])
}).strict();
export type ComandoEquipe = z.infer<typeof comandoEquipe>;

interface Contratacao {
  id: string; empresa_id: string; evento_id: string; programacao_id: string; fornecedor_id: string; categoria: "EQUIPE" | "LOCACAO" | "INSUMO";
  funcao: string; inicio: Date; fim: Date; orientacoes: string; estado: string; referencia: string | null; motivo: string | null;
}

const tem = (u: UsuarioAutenticado, papeis: readonly PapelUsuario[]) => u.papeis.some((p) => papeis.includes(p));

export async function consultarEquipe(sql: Sql, usuario: UsuarioAutenticado, eventoId: string) {
  exigirPapel(usuario, LER);
  const [e] = await sql<{ empresa_id: string }[]>`select empresa_id from eventos where id = ${eventoId}`;
  if (!e) throw new ErroOperacao("Evento não encontrado.", 404);
  autorizarEmpresa(usuario, e.empresa_id);
  const podeValores = tem(usuario, VALORES);
  const [equipe, fornecedores, verba, valores, pessoas] = await Promise.all([
    sql`select * from evento_equipe where evento_id = ${eventoId} order by inicio, id`,
    sql`select id, nome, contato, ativo from fornecedores where empresa_id = ${e.empresa_id} order by nome, id`,
    podeValores ? sql<{ limite: number }[]>`select limite from evento_verbas where evento_id = ${eventoId}` : Promise.resolve([]),
    podeValores ? sql`select v.equipe_id, v.valor, v.referencia from equipe_valores v join evento_equipe q on q.id = v.equipe_id where q.evento_id = ${eventoId}` : Promise.resolve([]),
    freelancersDoEvento(sql, eventoId)
  ]);
  // Resumo da escala de freelancers (módulo 7). Valores só para quem vê custo.
  const freelancers = { pessoas, verba: podeValores || tem(usuario, ["EXPEDICAO_COMPRAS"]) ? compararVerba(await verbaDoEvento(sql, eventoId), await custoEquipeDoEvento(sql, eventoId)) : null };
  return { equipe, fornecedores, verba: verba[0]?.limite ?? null, valores, podeValores, freelancers };
}

async function totalAprovado(tx: Tx, eventoId: string, exceto?: string) {
  const [r] = await tx<{ total: number }[]>`select coalesce(sum(v.valor), 0) as total from equipe_valores v join evento_equipe q on q.id = v.equipe_id
    where q.evento_id = ${eventoId} and q.estado <> 'CANCELADA' ${exceto ? tx`and q.id <> ${exceto}` : tx``}`;
  return centavos(r?.total ?? 0);
}

export async function operarEquipe(tx: Tx, usuario: UsuarioAutenticado, { eventoId, revisao, comando }: ComandoEquipe): Promise<{ id: string }> {
  exigirPapel(usuario, ["PROGRAMACAO", "EXPEDICAO_COMPRAS", "FINANCEIRO"]);
  const [e] = await tx<{ id: string; empresa_id: string; revisao: number; etapa_operacao: string; contrato_assinado_em: Date | null; liberacao_excepcional_motivo: string | null }[]>`
    select id, empresa_id, revisao, etapa_operacao, contrato_assinado_em, liberacao_excepcional_motivo from eventos where id = ${eventoId} for update`;
  if (!e) throw new ErroOperacao("Evento não encontrado.", 404);
  autorizarEmpresa(usuario, e.empresa_id);
  const { acao } = comando;
  const negar = (msg: string) => { throw new ErroAutorizacao(msg, 403); };

  if (comando.acao === "SOLICITAR") {
    // Reenvio da mesma chave (rede instável) devolve o registro, sem duplicar.
    const [r] = await tx<Contratacao[]>`select * from evento_equipe where id = ${comando.dados.id}`;
    if (r) {
      const d = comando.dados;
      if (r.evento_id !== e.id || r.fornecedor_id !== d.fornecedorId || r.categoria !== d.categoria || r.funcao !== d.funcao
        || r.inicio.getTime() !== new Date(d.inicio).getTime() || r.fim.getTime() !== new Date(d.fim).getTime() || r.orientacoes !== d.orientacoes) throw new ErroOperacao("Chave já utilizada por outra solicitação.", 409);
      if (!tem(usuario, OPERACIONAL)) negar("Perfil sem acesso à escala.");
      return { id: r.id };
    }
  }
  if (revisao !== e.revisao) throw new ErroOperacao("Evento alterado. Atualize a escala.", 409);
  if (["VERBA", "APROVAR", "REALIZAR"].includes(acao) && !tem(usuario, FINANCEIRO)) negar("Somente o financeiro aprova ou realiza despesas.");
  if (["SOLICITAR", "EDITAR", "CONFIRMAR"].includes(acao) && !tem(usuario, OPERACIONAL)) negar("Perfil sem acesso à escala.");

  let id: string = e.id; let anterior: unknown = null;
  if (comando.acao === "VERBA") {
    // Revisão não cancela compromisso financeiro: só cancelamento explícito libera a reserva.
    if (centavos(comando.dados.limite) < await totalAprovado(tx, e.id)) throw new ErroOperacao("A verba não pode ser menor que as contratações já aprovadas.", 409);
    [anterior] = await tx`select * from evento_verbas where evento_id = ${e.id}`;
    await tx`insert into evento_verbas (evento_id, empresa_id, limite) values (${e.id}, ${e.empresa_id}, ${comando.dados.limite})
      on conflict (evento_id) do update set limite = excluded.limite, atualizado_em = now()`;
  } else {
    if (!e.contrato_assinado_em && !e.liberacao_excepcional_motivo?.trim()) throw new ErroOperacao("Contrato pendente.", 409);
    const [pr] = await tx<{ id: string }[]>`select id from programacoes where evento_id = ${e.id} and status = 'APROVADA' order by versao desc limit 1 for share`;
    if (acao !== "CANCELAR" && !pr) throw new ErroOperacao("Aprove a programação antes de alterar a escala.", 409);
    let r: Contratacao | undefined;
    if (comando.acao !== "SOLICITAR") {
      [r] = await tx<Contratacao[]>`select * from evento_equipe where id = ${comando.dados.id} and evento_id = ${e.id} for update`;
      if (!r) negar("Contratação indisponível.");
      r = r!; anterior = r; id = r.id;
      if (r.estado === "CANCELADA") throw new ErroOperacao("Contratação cancelada. Crie uma nova solicitação.", 409);
      if (acao !== "EDITAR" && acao !== "CANCELAR" && r.programacao_id !== pr?.id) throw new ErroOperacao("Escala de versão anterior. Revise e solicite nova aprovação.", 409);
    }
    if (comando.acao === "SOLICITAR" || comando.acao === "EDITAR") {
      const d = comando.dados;
      if (["EM_CAMPO", "ENTREGUE"].includes(e.etapa_operacao) || r?.estado === "EXECUTADA") throw new ErroOperacao("Não altere uma contratação após a saída/execução. Registre ajuste separado.", 409);
      if (new Date(d.fim) <= new Date(d.inicio)) throw new ErroOperacao("Informe função, categoria e horários válidos. O fim deve ser posterior ao início.", 422);
      const [f] = await tx`select 1 from fornecedores where id = ${d.fornecedorId} and empresa_id = ${e.empresa_id} and ativo`;
      if (!f) throw new ErroOperacao("Fornecedor indisponível.", 422);
      if (comando.acao === "SOLICITAR") {
        id = d.id;
        await tx`insert into evento_equipe (id, empresa_id, evento_id, programacao_id, fornecedor_id, categoria, funcao, inicio, fim, orientacoes, criado_por)
          values (${d.id}, ${e.empresa_id}, ${e.id}, ${pr!.id}, ${d.fornecedorId}, ${d.categoria}, ${d.funcao}, ${d.inicio}, ${d.fim}, ${d.orientacoes}, ${usuario.id})`;
      } else {
        await tx`update evento_equipe set programacao_id = ${pr!.id}, fornecedor_id = ${d.fornecedorId}, categoria = ${d.categoria}, funcao = ${d.funcao}, inicio = ${d.inicio}, fim = ${d.fim},
          orientacoes = ${d.orientacoes}, estado = 'SOLICITADA', referencia = null, motivo = 'Alterada: exige nova aprovação financeira.', atualizado_em = now() where id = ${id}`;
      }
    } else if (comando.acao === "APROVAR") {
      if (r!.estado !== "SOLICITADA") throw new ErroOperacao("Somente uma solicitação revisada pode ser aprovada.", 409);
      const [v] = await tx<{ limite: number }[]>`select limite from evento_verbas where evento_id = ${e.id}`;
      if (!v || await totalAprovado(tx, e.id, id) + centavos(comando.dados.valor) > centavos(v.limite)) throw new ErroOperacao("Verba não definida ou insuficiente. Ajuste a alçada financeira antes de aprovar.", 409);
      if (r!.categoria === "EQUIPE") {
        // Serializa só a pessoa/fornecedor, inclusive aprovações em eventos diferentes.
        await tx`select pg_advisory_xact_lock(hashtextextended(${r!.fornecedor_id}::text, 0))`;
        const [choque] = await tx`select 1 from evento_equipe q where q.fornecedor_id = ${r!.fornecedor_id} and q.id <> ${id} and q.categoria = 'EQUIPE'
          and q.estado not in ('CANCELADA', 'EXECUTADA') and exists (select 1 from equipe_valores v where v.equipe_id = q.id) and q.inicio < ${r!.fim} and q.fim > ${r!.inicio}`;
        if (choque) throw new ErroOperacao("Profissional já reservado neste horário. Ajuste a escala.", 409);
      }
      await tx`insert into equipe_valores (equipe_id, empresa_id, valor, aprovado_por, referencia) values (${id}, ${e.empresa_id}, ${comando.dados.valor}, ${usuario.id}, ${comando.dados.referencia})
        on conflict (equipe_id) do update set valor = excluded.valor, aprovado_por = excluded.aprovado_por, aprovado_em = now(), referencia = excluded.referencia`;
      await tx`update evento_equipe set estado = 'APROVADA', motivo = null, atualizado_em = now() where id = ${id}`;
    } else if (comando.acao === "CONFIRMAR") {
      if (r!.estado !== "APROVADA") throw new ErroOperacao("Aprovação financeira e referência de aceite são obrigatórias.", 409);
      await tx`update evento_equipe set estado = 'CONFIRMADA', referencia = ${comando.dados.referencia}, atualizado_em = now() where id = ${id}`;
    } else if (comando.acao === "REALIZAR") {
      if (r!.estado !== "CONFIRMADA" || comando.dados.competencia > dataSaoPaulo(new Date())) throw new ErroOperacao("Confirme a prestação e informe referência/data efetiva.", 409);
      const [v] = await tx<{ valor: number }[]>`select valor from equipe_valores where equipe_id = ${id}`;
      await tx`insert into evento_custos (id, empresa_id, evento_id, categoria, descricao, valor, competencia, referencia, idempotencia, criado_por)
        values (${randomUUID()}, ${e.empresa_id}, ${e.id}, ${r!.categoria === "INSUMO" ? "ALIMENTACAO" : r!.categoria}, ${r!.funcao}, ${v!.valor}, ${comando.dados.competencia}, ${comando.dados.referencia}, ${id}, ${usuario.id})`;
      await tx`update evento_equipe set estado = 'EXECUTADA', atualizado_em = now() where id = ${id}`;
    } else if (comando.acao === "CANCELAR") {
      if (r!.estado === "EXECUTADA") throw new ErroOperacao("Despesa já realizada. Estorne no financeiro com motivo; não apague a execução.", 409);
      await tx`update evento_equipe set estado = 'CANCELADA', motivo = ${comando.dados.motivo}, atualizado_em = now() where id = ${id}`;
    }
  }
  await travarRevisao(tx, "eventos", e.id, revisao);
  await tx`insert into operacao_notificacoes (id, empresa_id, evento_id, mensagem) values (${randomUUID()}, ${e.empresa_id}, ${e.id}, ${`Equipe/extra: ${acao}. Consulte a escala atualizada.`})`;
  await auditar(tx, usuario, { acao: `EQUIPE_${acao}`, entidade: "evento", entidadeId: e.id, empresaId: e.empresa_id, dados: { id, antes: anterior, dados: comando.dados } });
  return { id };
}
