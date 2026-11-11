import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { PapelUsuario, UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import * as compras from "@/dominios/compras/ganchos";
import { alterarStatusProgramacoes, atualizarEvento, hojeSaoPaulo, liberadoParaOperar, notificar, podeAcessar, travarEvento, type Evento } from "@/dominios/operacao/eventos";
import { auditar, ErroOperacao, type comandoSchema } from "@/dominios/operacao/http";
import type { Tx } from "@/integrations/banco";
import type { Programacao } from "@/dominios/documentos/tipos";
import { gravarEstrutura } from "./estrutura";

export type Comando = z.infer<typeof comandoSchema>["comando"];
type Dados<A extends Comando["acao"]> = Extract<Comando, { acao: A }>["dados"];

const PAPEIS_ACAO: Record<Comando["acao"], PapelUsuario[]> = {
  PROGRAMACAO_SALVAR: ["ADMIN", "PROGRAMACAO"], PROGRAMACAO_APROVAR: ["ADMIN", "PROGRAMACAO"],
  TITULO_CRIAR: ["ADMIN", "FINANCEIRO"], TITULO_RECEBER: ["ADMIN", "FINANCEIRO"],
  POS_VENDA: ["ADMIN", "ATENDIMENTO", "COMERCIAL"],
  EXPEDIR: ["ADMIN", "EXPEDICAO_COMPRAS"], ENTREGAR: ["ADMIN", "EXPEDICAO_COMPRAS"],
  TAREFA_ATUALIZAR: ["ADMIN", "PRODUCAO", "EXPEDICAO_COMPRAS", "PROGRAMACAO"]
};
const FASES = ["MONTAGEM", "REPOSICAO", "DESMONTAGEM"];
const erro = (mensagem: string) => new ErroOperacao(mensagem, 409);

/** Regras de rótulos e roteiro de campo da programação (antigos salvar_programacao_campo/documentos). */
export function validarProgramacao(d: Dados<"PROGRAMACAO_SALVAR">) {
  let fase = 0, horario = -Infinity;
  for (const etapa of d.roteiroCampo) {
    const atual = FASES.indexOf(etapa.tipo);
    if (atual < fase) throw erro("Ordene montagem, reposição e desmontagem nesta sequência.");
    fase = atual;
    const instante = Date.parse(etapa.previstoEm);
    if (!Number.isFinite(instante) || instante < horario) throw erro("Organize as etapas em ordem de horário.");
    horario = instante;
  }
  const rotulos = d.rotulos ?? [];
  if (rotulos.length !== 0 && rotulos.length !== d.itens.length) throw erro("Cada item deve ter seu próprio rótulo.");
}

/**
 * Antigo operar_evento (+ salvar_programacao_campo para PROGRAMACAO_SALVAR): máquina de estados operacional do evento.
 * Trava o evento, confere empresa, papel e revisão, executa a ação e audita.
 */
export async function operarEvento(tx: Tx, usuario: UsuarioAutenticado, eventoId: string, revisao: number, comando: Comando, opcoes: { estrutura?: Programacao } = {}): Promise<{ id: string }> {
  if (comando.acao === "PROGRAMACAO_SALVAR") validarProgramacao(comando.dados);
  const e = await travarEvento(tx, eventoId);
  if (!e || !podeAcessar(usuario, e.empresa_id)) throw new ErroOperacao("Evento indisponível.", 403);
  if (!podeAcessar(usuario, e.empresa_id, PAPEIS_ACAO[comando.acao])) throw new ErroOperacao("Perfil sem permissão.", 403);
  if (e.revisao !== revisao) throw new ErroOperacao("Evento alterado por outra pessoa. Atualize a tela.", 409);

  let id: string | undefined;
  switch (comando.acao) {
    case "PROGRAMACAO_SALVAR": id = await salvarProgramacao(tx, usuario, e, comando.dados, opcoes.estrutura); break;
    case "PROGRAMACAO_APROVAR": id = await aprovarProgramacao(tx, usuario, e); break;
    case "TAREFA_ATUALIZAR": id = await atualizarTarefa(tx, usuario, e, comando.dados); break;
    case "EXPEDIR": case "ENTREGAR": await expedirOuEntregar(tx, usuario, e, comando.acao); break;
    case "TITULO_CRIAR": {
      const d = comando.dados;
      if (!e.contrato_assinado_em) throw erro("Contrato assinado obrigatório para contas a receber.");
      id = (await tx<{ id: string }[]>`
        insert into financeiro_titulos (id, empresa_id, evento_id, descricao, valor, vencimento, forma, idempotencia)
        values (${randomUUID()}, ${e.empresa_id}, ${e.id}, ${d.descricao}, ${d.valor}, ${d.vencimento}, ${d.forma}, ${d.idempotencia})
        on conflict (idempotencia) do nothing returning id`)[0]?.id;
      if (!id) throw erro("Esta solicitação já foi registrada. Atualize a tela.");
      await atualizarEvento(tx, usuario, e.id);
      break;
    }
    case "TITULO_RECEBER": {
      const d = comando.dados;
      if (!d.referencia.trim() || !d.recebidoEm) throw erro("Informe data e referência do recebimento.");
      if (d.recebidoEm > hojeSaoPaulo()) throw erro("Recebimento não pode estar no futuro.");
      id = (await tx<{ id: string }[]>`
        update financeiro_titulos set recebido_em = ${d.recebidoEm}, referencia = ${d.referencia || null}
        where id = ${d.id} and evento_id = ${e.id} and recebido_em is null returning id`)[0]?.id;
      if (!id) throw erro("Título indisponível ou já recebido.");
      await atualizarEvento(tx, usuario, e.id);
      break;
    }
    case "POS_VENDA": {
      const d = comando.dados;
      if (e.etapa_operacao !== "ENTREGUE") throw erro("Pós-venda disponível após entrega.");
      await tx`insert into evento_pos_venda (evento_id, empresa_id, nota, comentario, retorno_em) values (${e.id}, ${e.empresa_id}, ${d.nota}, ${d.comentario}, ${d.retornoEm})
        on conflict (evento_id) do update set nota = excluded.nota, comentario = excluded.comentario, retorno_em = excluded.retorno_em, atualizado_em = now()`;
      await atualizarEvento(tx, usuario, e.id);
      break;
    }
  }
  await auditar(tx, usuario, { acao: comando.acao, entidade: "evento", entidadeId: e.id, empresaId: e.empresa_id, dados: { revisaoAnterior: e.revisao, registroId: id ?? null } });
  return { id: id ?? e.id };
}

async function salvarProgramacao(tx: Tx, usuario: UsuarioAutenticado, e: Evento, d: Dados<"PROGRAMACAO_SALVAR">, estrutura?: Programacao) {
  if (!liberadoParaOperar(e)) throw erro("Contrato ainda não formalizado.");
  if (["EM_CAMPO", "ENTREGUE"].includes(e.etapa_operacao)) throw erro("Evento já saiu. Registre a ocorrência antes de reprogramar.");
  const versao = (await tx<{ versao: number }[]>`select coalesce(max(versao), 0) + 1 versao from programacoes where evento_id = ${e.id}`)[0]?.versao ?? 1;
  await alterarStatusProgramacoes(tx, usuario, { eventoId: e.id, de: ["APROVADA", "RASCUNHO"] }, "INVALIDADA");
  const id = randomUUID();
  await tx`insert into programacoes ${tx({
    id, evento_id: e.id, empresa_id: e.empresa_id, versao, saida_em: d.saidaEm, itens: tx.json(d.itens as never), alteracoes: d.alteracoes,
    criado_por: usuario.id, rotulos: tx.json((d.rotulos ?? []) as never), roteiro_campo: tx.json(d.roteiroCampo as never)
  })}`;
  // Estrutura do motor: a nova (gerada) ou a anterior com as sobrescritas manuais, auditadas com antes/depois.
  await gravarEstrutura(tx, usuario, e, id, d.itens, estrutura);
  await atualizarEvento(tx, usuario, e.id, { etapa_operacao: "PROGRAMACAO" });
  await notificar(tx, e, `Nova programação v${versao}. Derivados bloqueados até aprovação.`);
  return id;
}

async function aprovarProgramacao(tx: Tx, usuario: UsuarioAutenticado, e: Evento) {
  const [p] = await tx<{ id: string; itens: { nome: string; receita: string; quantidade: number; unidade: string; setor: string }[] }[]>`
    select id, itens from programacoes where evento_id = ${e.id} and status = 'RASCUNHO' order by versao desc limit 1`;
  if (!p) throw erro("Não há rascunho para aprovar.");
  if (!liberadoParaOperar(e)) throw erro("Contrato ainda não formalizado.");
  if (p.itens.some((i) => i.setor === "A_CLASSIFICAR")) throw erro("Classifique todos os itens antes de aprovar.");
  await alterarStatusProgramacoes(tx, usuario, { eventoId: e.id, de: ["RASCUNHO"], id: p.id }, "APROVADA");
  const tarefa = (tipo: string, setor: string, titulo: string, extra: { descricao?: string; quantidade?: number; unidade?: string; evidencia?: boolean } = {}) => ({
    id: randomUUID(), evento_id: e.id, programacao_id: p.id, empresa_id: e.empresa_id, tipo, setor, titulo,
    descricao: extra.descricao ?? "", quantidade: extra.quantidade ?? null, unidade: extra.unidade ?? null, evidencia_obrigatoria: extra.evidencia ?? false
  });
  const tarefas = [
    ...p.itens.flatMap((i) => {
      const dados = { descricao: i.receita, quantidade: i.quantidade, unidade: i.unidade };
      return [...(["ESTRUTURA", "FORNECEDOR"].includes(i.setor) ? [] : [tarefa("PRODUCAO", i.setor, i.nome, dados)]), tarefa("EXPEDICAO", i.setor, i.nome, dados)];
    }),
    ...["Conferência da programação", "Conferência da produção", "Conferência de carregamento"].map((t) => tarefa("CONFERENCIA", "GERAL", t)),
    ...["Chegada ao local", "Higienização e mesa montada", "Reposição", "Desmontagem"].map((t) => tarefa("CAMPO", "CAMPO", t, { evidencia: true })),
    tarefa("RETORNO", "EXPEDICAO", "Conferência de retorno na Pieggi")
  ];
  await tx`insert into operacao_tarefas ${tx(tarefas)}`;
  await atualizarEvento(tx, usuario, e.id, { etapa_operacao: "PRODUCAO" });
  return p.id;
}

async function atualizarTarefa(tx: Tx, usuario: UsuarioAutenticado, e: Evento, d: Dados<"TAREFA_ATUALIZAR">) {
  const [t] = await tx<{ id: string; programacao_id: string; tipo: string; titulo: string; estado: string; evidencia_obrigatoria: boolean }[]>`
    select t.id, t.programacao_id, t.tipo, t.titulo, t.estado, t.evidencia_obrigatoria from operacao_tarefas t
    join programacoes p on p.id = t.programacao_id and p.status = 'APROVADA' where t.id = ${d.id} and t.evento_id = ${e.id} for update of t`;
  if (!t) throw erro("Tarefa indisponível ou programação invalidada.");
  const papeis: PapelUsuario[] = t.tipo === "PRODUCAO" ? ["ADMIN", "PRODUCAO"] : t.tipo === "CONFERENCIA" ? ["ADMIN", "PROGRAMACAO", "PRODUCAO", "EXPEDICAO_COMPRAS"] : ["ADMIN", "EXPEDICAO_COMPRAS"];
  if (!podeAcessar(usuario, e.empresa_id, papeis)) throw new ErroOperacao("Perfil sem permissão para esta tarefa.", 403);
  if (t.estado === "PRONTO") throw erro("Tarefa concluída. Reprogramação é necessária para alterar.");
  const irmas = await tx<{ id: string; tipo: string; titulo: string; estado: string }[]>`select id, tipo, titulo, estado from operacao_tarefas where programacao_id = ${t.programacao_id}`;
  const pendente = (filtro: (x: { tipo: string; titulo: string }) => boolean) => irmas.some((x) => filtro(x) && x.estado !== "PRONTO");
  if (t.tipo === "RETORNO" && (e.etapa_operacao !== "EM_CAMPO" || pendente((x) => x.tipo === "CAMPO"))) throw erro("Conclua o campo antes da conferência de retorno.");
  if (t.tipo === "EXPEDICAO" && d.estado === "PRONTO" && pendente((x) => x.tipo === "PRODUCAO")) throw erro("Conclua a produção antes do carregamento.");
  if (d.estado !== (t.estado === "PENDENTE" && ["PRODUCAO", "EXPEDICAO"].includes(t.tipo) ? "EM_ANDAMENTO" : "PRONTO")) throw erro("Respeite a sequência de conferência.");
  if (t.evidencia_obrigatoria) throw erro("Envie a evidência pelo fluxo de campo antes de concluir.");
  if (t.tipo === "PRODUCAO" && pendente((x) => x.tipo === "CONFERENCIA" && x.titulo === "Conferência da programação")) throw erro("Confira a programação antes de iniciar a produção.");
  if (t.tipo === "CONFERENCIA" && t.titulo === "Conferência da produção" && pendente((x) => x.tipo === "PRODUCAO")) throw erro("Conclua a produção antes de conferi-la.");
  if (t.tipo === "CONFERENCIA" && t.titulo === "Conferência de carregamento" && pendente((x) => ["PRODUCAO", "EXPEDICAO"].includes(x.tipo) || x.titulo === "Conferência da produção"))
    throw erro("Conclua a produção e o carregamento antes da conferência final.");
  await tx`update operacao_tarefas set estado = ${d.estado}, concluido_por = ${usuario.id}, atualizado_em = now() where id = ${t.id}`;
  const producaoPendente = irmas.some((x) => x.tipo === "PRODUCAO" && (x.id === t.id ? d.estado : x.estado) !== "PRONTO");
  await atualizarEvento(tx, usuario, e.id, !producaoPendente && e.etapa_operacao === "PRODUCAO" ? { etapa_operacao: "EXPEDICAO" } : {});
  return t.id;
}

async function expedirOuEntregar(tx: Tx, usuario: UsuarioAutenticado, e: Evento, acao: "EXPEDIR" | "ENTREGAR") {
  const [p] = await tx<{ id: string }[]>`select id from programacoes where evento_id = ${e.id} and status = 'APROVADA'`;
  if (!p) throw erro("Aprovação da programação necessária.");
  const tarefas = await tx<{ tipo: string; estado: string }[]>`select tipo, estado from operacao_tarefas where programacao_id = ${p.id}`;
  if (acao === "EXPEDIR") {
    if (e.etapa_operacao !== "EXPEDICAO") throw erro("Conclua a produção primeiro.");
    if (tarefas.some((t) => ["PRODUCAO", "EXPEDICAO", "CONFERENCIA"].includes(t.tipo) && t.estado !== "PRONTO")) throw erro("Existem itens ou conferências pendentes. Saída bloqueada.");
    await atualizarEvento(tx, usuario, e.id, { etapa_operacao: "EM_CAMPO" });
    await compras.aoExpedirEvento(tx, usuario, e.id);
  } else {
    if (e.etapa_operacao !== "EM_CAMPO") throw erro("Evento não está em campo.");
    if (tarefas.some((t) => t.estado !== "PRONTO")) throw erro("Conclua campo, evidências e retorno antes de entregar.");
    await atualizarEvento(tx, usuario, e.id, { etapa_operacao: "ENTREGUE" });
  }
}
