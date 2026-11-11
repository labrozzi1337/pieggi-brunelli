// Balanço de consumo/retorno/descarte e termo de remanescentes. Porta de salvar_balanco e registrar_termo_remanescentes.
import { z } from "zod";
import type { PapelUsuario, UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import { auditar, ErroOperacao } from "@/dominios/operacao/http";
import type { Sql } from "@/integrations/banco";
import { caminhoValido, emTransacao, exigirAcesso, exigirRevisao, tocarEvento, travarEvento } from "./campo";

export const PAPEIS_BALANCO: PapelUsuario[] = ["ADMIN", "EXPEDICAO_COMPRAS"];
export const PAPEIS_LEITURA_BALANCO: PapelUsuario[] = ["ADMIN", "EXPEDICAO_COMPRAS", "COMERCIAL", "ATENDIMENTO"];

export const linhaBalancoSchema = z.object({ indice: z.number().int().nonnegative(), remanescentes: z.number().nonnegative().max(1000000), retorno: z.number().nonnegative().max(1000000), descarte: z.number().nonnegative().max(1000000) }).strict();
export type LinhaBalanco = z.infer<typeof linhaBalancoSchema>;
export interface EntradaBalanco { eventoId: string; revisao: number; balancoRevisao: number; linhas: LinhaBalanco[]; recebedor: string; observacoes: string }

// Quantidades com até 3 casas: conta em milésimos para não errar com ponto flutuante (o banco usava numeric).
const mil = (v: number) => Math.round(v * 1000);
const tresCasas = (v: number) => Math.abs(v * 1000 - mil(v)) < 1e-6;

export function salvarBalanco(sql: Sql, usuario: UsuarioAutenticado, d: EntradaBalanco) {
  return emTransacao(sql, async tx => {
    const e = await travarEvento(tx, d.eventoId);
    exigirAcesso(usuario, e?.empresa_id, PAPEIS_BALANCO);
    const evento = e!;
    exigirRevisao(evento, d.revisao);
    if (evento.etapa_operacao !== "EM_CAMPO") throw new ErroOperacao("Balanço disponível durante campo e retorno, antes de encerrar.", 409);
    const [p] = await tx<{ id: string; itens: { nome: string; unidade: string; setor: string; quantidade: number }[] }[]>`select id, itens from programacoes where evento_id = ${evento.id} and status = 'APROVADA'`;
    if (!p) throw new ErroOperacao("Programação ainda não aprovada.", 409);
    const [b] = await tx<Record<string, unknown>[]>`select * from evento_balancos where programacao_id = ${p.id} for update`;
    const revisaoAtual = (b?.revisao as number | undefined) ?? 0;
    if (revisaoAtual !== d.balancoRevisao) throw new ErroOperacao("Balanço alterado. Atualize antes de salvar.", 409);
    if (d.recebedor.length > 200 || d.observacoes.length > 3000) throw new ErroOperacao("Texto excede o limite.", 409);
    const linhas = p.itens.flatMap((item, indice) => {
      if (item.setor === "ESTRUTURA") return [];
      const achadas = d.linhas.filter(l => l.indice === indice);
      if (achadas.length !== 1) throw new ErroOperacao("Confira todos os itens, sem duplicações.", 409);
      const { remanescentes: rem, retorno: ret, descarte: des } = achadas[0]!;
      const qtd = Number(item.quantidade);
      if ([rem, ret, des].some(v => typeof v !== "number" || v < 0 || !tresCasas(v) || (item.unidade === "UN" && !Number.isInteger(v))) || mil(rem) + mil(ret) + mil(des) > mil(qtd))
        throw new ErroOperacao("Sobras e descarte devem caber na quantidade programada, respeitando a unidade.", 409);
      return [{ indice, nome: item.nome, unidade: item.unidade, programado: qtd, consumido: (mil(qtd) - mil(rem) - mil(ret) - mil(des)) / 1000, remanescentes: rem, retorno: ret, descarte: des }];
    });
    if (linhas.length !== d.linhas.length) throw new ErroOperacao("Itens extras no balanço.", 409);
    const recebedor = d.recebedor.trim();
    if (linhas.some(l => l.remanescentes > 0) && recebedor.length < 2) throw new ErroOperacao("Informe quem recebeu os remanescentes.", 409);
    await tx`insert into evento_balancos (programacao_id, evento_id, empresa_id, revisao, linhas, recebedor, observacoes, atualizado_por)
      values (${p.id}, ${evento.id}, ${evento.empresa_id}, ${revisaoAtual + 1}, ${tx.json(linhas)}, ${recebedor}, ${d.observacoes}, ${usuario.id})
      on conflict (programacao_id) do update set revisao = excluded.revisao, linhas = excluded.linhas, recebedor = excluded.recebedor,
        observacoes = excluded.observacoes, atualizado_por = excluded.atualizado_por, atualizado_em = now()`;
    await tocarEvento(tx, evento);
    await auditar(tx, usuario, { acao: "BALANCO_REGISTRADO", entidade: "evento", entidadeId: evento.id, empresaId: evento.empresa_id, dados: { anterior: b ?? null, linhas, revisao: revisaoAtual + 1 } });
    return { id: p.id };
  });
}

export function registrarTermoRemanescentes(sql: Sql, usuario: UsuarioAutenticado, d: { eventoId: string; revisao: number; balancoRevisao: number; path: string; assinadoEm: string }) {
  return emTransacao(sql, async tx => {
    const e = await travarEvento(tx, d.eventoId);
    exigirAcesso(usuario, e?.empresa_id, PAPEIS_BALANCO);
    const evento = e!;
    const [b] = await tx<{ programacao_id: string; revisao: number; remanescentes: boolean }[]>`
      select b1.programacao_id, b1.revisao, exists(select 1 from jsonb_array_elements(b1.linhas) x where (x->>'remanescentes')::numeric > 0) as remanescentes
      from evento_balancos b1 join programacoes p on p.id = b1.programacao_id and p.status = 'APROVADA' where b1.evento_id = ${evento.id} for update of b1`;
    if (d.revisao !== evento.revisao || !b || d.balancoRevisao !== b.revisao) throw new ErroOperacao("Balanço alterado. Gere o termo atualizado.", 409);
    if (evento.etapa_operacao !== "EM_CAMPO" || new Date(d.assinadoEm) > new Date()) throw new ErroOperacao("Evento ou data de assinatura inválido.", 409);
    if (!b.remanescentes) throw new ErroOperacao("Não há remanescentes entregues ao cliente.", 409);
    if (!caminhoValido(d.path, [evento.id], ["pdf"])) throw new ErroOperacao("Envie o termo assinado em PDF.", 409);
    const [t] = await tx<{ id: string }[]>`insert into remanescentes_termos (id, programacao_id, evento_id, empresa_id, revisao_balanco, snapshot, arquivo_path, assinado_em, registrado_por)
      select gen_random_uuid(), b1.programacao_id, b1.evento_id, b1.empresa_id, b1.revisao, to_jsonb(b1), ${d.path}, ${d.assinadoEm}, ${usuario.id}
      from evento_balancos b1 where b1.programacao_id = ${b.programacao_id} returning id`;
    await tocarEvento(tx, evento);
    await auditar(tx, usuario, { acao: "TERMO_REMANESCENTES_REGISTRADO", entidade: "evento", entidadeId: evento.id, empresaId: evento.empresa_id, dados: { termoId: t!.id, revisaoBalanco: b.revisao } });
    return { id: t!.id };
  });
}

/** Leitura do balanço da programação aprovada (JSON no formato que o PostgREST devolvia). */
export async function consultarBalanco(sql: Sql, usuario: UsuarioAutenticado, eventoId: string) {
  const [p] = await sql<{ id: string; versao: number; empresa_id: string; evento: { titulo: string; data_evento: string } }[]>`
    select p.id, p.versao, p.empresa_id, jsonb_build_object('titulo', e.titulo, 'data_evento', e.data_evento) as evento
    from programacoes p join eventos e on e.id = p.evento_id where p.evento_id = ${eventoId} and p.status = 'APROVADA'`;
  if (p) exigirAcesso(usuario, p.empresa_id, PAPEIS_LEITURA_BALANCO);
  else {
    const [e] = await sql<{ empresa_id: string }[]>`select empresa_id from eventos where id = ${eventoId}`;
    exigirAcesso(usuario, e?.empresa_id, PAPEIS_LEITURA_BALANCO);
    throw new ErroOperacao("Aprove a programação antes de conferir o retorno.", 409);
  }
  const [[b], termos] = await Promise.all([
    sql<{ dados: Record<string, unknown> }[]>`select to_jsonb(b) as dados from evento_balancos b where programacao_id = ${p.id}`,
    sql<{ dados: Record<string, unknown> }[]>`select jsonb_build_object('id', id, 'revisao_balanco', revisao_balanco, 'assinado_em', assinado_em) as dados
      from remanescentes_termos where programacao_id = ${p.id} order by criado_em desc`
  ]);
  return { programacao: p, balanco: b?.dados ?? null, termos: termos.map(t => t.dados) };
}
