// Financeiro do evento, contrato assinado e registro de documento operacional.
// Porta de operar_financeiro, registrar_contrato e registrar_documento_operacional. Os efeitos dos antigos triggers
// (proposta_portao_evento, evento_proteger_fluxo, filas, proteger_valor_proposta) vêm do módulo de eventos/propostas.
import { z } from "zod";
import type { PapelUsuario, UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import { auditar, ErroOperacao } from "@/dominios/operacao/http";
import { atualizarEvento, faltaDadoContrato } from "@/dominios/operacao/eventos";
import { fixosDoEvento } from "@/dominios/operacao/clientes";
import { protegerValorProposta } from "@/dominios/operacao/propostas";
import { gerarProgramacaoAutomatica } from "@/dominios/operacao/fluxo";
import type { Sql } from "@/integrations/banco";
import { caminhoValido, emTransacao, exigirAcesso, exigirRevisao, tocarEvento, travarEvento } from "./campo";

// ---------- financeiro ----------
const dinheiro = z.number().nonnegative().max(999999999).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001, "Use duas casas decimais.");
export const financeiroSchema = z.object({ eventoId: z.string().uuid(), revisao: z.number().int().positive(), comando: z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("VALORES_SALVAR"), dados: z.object({ venda: dinheiro, custoEstimado: dinheiro }).strict() }),
  z.object({ acao: z.literal("CUSTO_CRIAR"), dados: z.object({ categoria: z.enum(["ALIMENTACAO", "EQUIPE", "LOCACAO", "LOGISTICA", "OUTROS"]), descricao: z.string().trim().min(2).max(200), valor: dinheiro.refine(v => v > 0), competencia: z.string().date(), referencia: z.string().trim().min(2).max(300), idempotencia: z.string().uuid() }).strict() }),
  z.object({ acao: z.literal("CUSTO_CANCELAR"), dados: z.object({ id: z.string().uuid(), motivo: z.string().trim().min(5).max(500) }).strict() })
]) }).strict();
export const PAPEIS_FINANCEIRO: PapelUsuario[] = ["ADMIN", "FINANCEIRO"];
export const PAPEIS_LEITURA_FINANCEIRO: PapelUsuario[] = ["ADMIN", "FINANCEIRO", "COMERCIAL", "ATENDIMENTO"];

export function operarFinanceiro(sql: Sql, usuario: UsuarioAutenticado, { eventoId, revisao, comando }: z.infer<typeof financeiroSchema>) {
  return emTransacao(sql, async tx => {
    const e = await travarEvento(tx, eventoId);
    exigirAcesso(usuario, e?.empresa_id, PAPEIS_FINANCEIRO, "Perfil sem acesso ao financeiro.");
    const evento = e!;
    if (comando.acao === "CUSTO_CRIAR") {
      const c = comando.dados;
      // Repetição da mesma chave devolve o lançamento já gravado, mesmo após mudança de revisão.
      const [existente] = await tx<{ id: string; igual: boolean }[]>`select id, (evento_id = ${evento.id} and valor = ${c.valor} and descricao = ${c.descricao} and categoria = ${c.categoria}
        and competencia = ${c.competencia}::date and referencia = ${c.referencia}) as igual from evento_custos where idempotencia = ${c.idempotencia}`;
      if (existente) {
        if (!existente.igual) throw new ErroOperacao("Chave já utilizada por outro lançamento.", 409);
        return { id: existente.id };
      }
    }
    exigirRevisao(evento, revisao, "Evento alterado. Atualize antes de lançar.");
    let id: string;
    if (comando.acao === "VALORES_SALVAR") {
      const { venda, custoEstimado } = comando.dados;
      await protegerValorProposta(tx, evento.id, venda, custoEstimado);
      await tx`insert into evento_valores (evento_id, valor_venda, custo_estimado) values (${evento.id}, ${venda}, ${custoEstimado})
        on conflict (evento_id) do update set valor_venda = excluded.valor_venda, custo_estimado = excluded.custo_estimado, atualizado_em = now()`;
      id = evento.id;
    } else if (comando.acao === "CUSTO_CRIAR") {
      const c = comando.dados;
      const [r] = await tx<{ id: string }[]>`insert into evento_custos (id, empresa_id, evento_id, categoria, descricao, valor, competencia, referencia, idempotencia, criado_por)
        values (gen_random_uuid(), ${evento.empresa_id}, ${evento.id}, ${c.categoria}, ${c.descricao}, ${c.valor}, ${c.competencia}, ${c.referencia}, ${c.idempotencia}, ${usuario.id}) returning id`;
      id = r!.id;
    } else {
      const [r] = await tx<{ id: string }[]>`update evento_custos set cancelado_em = now(), cancelado_por = ${usuario.id}, motivo_cancelamento = ${comando.dados.motivo}
        where id = ${comando.dados.id} and evento_id = ${evento.id} and cancelado_em is null returning id`;
      if (!r) throw new ErroOperacao("Lançamento já cancelado ou indisponível.", 409);
      id = r.id;
    }
    await tocarEvento(tx, evento);
    await auditar(tx, usuario, { acao: comando.acao, entidade: "evento", entidadeId: evento.id, empresaId: evento.empresa_id, dados: { lancamentoId: id, dados: comando.dados } });
    return { id };
  });
}

export async function listarCustos(sql: Sql, usuario: UsuarioAutenticado, empresaId: string) {
  exigirAcesso(usuario, empresaId, PAPEIS_LEITURA_FINANCEIRO, "Perfil sem acesso ao financeiro.");
  const linhas = await sql<{ dados: Record<string, unknown> }[]>`select to_jsonb(c) as dados from evento_custos c where empresa_id = ${empresaId} order by criado_em desc, id`;
  return linhas.map(l => l.dados);
}

// ---------- contrato ----------
export const PAPEIS_CONTRATO: PapelUsuario[] = ["ADMIN", "COMERCIAL", "ATENDIMENTO"];
export const PAPEIS_LEITURA_CONTRATO: PapelUsuario[] = ["ADMIN", "COMERCIAL", "ATENDIMENTO", "FINANCEIRO"];

export function registrarContrato(sql: Sql, usuario: UsuarioAutenticado, d: { eventoId: string; revisao: number; path: string; assinadoEm: string }) {
  return emTransacao(sql, async tx => {
    const e = await travarEvento(tx, d.eventoId);
    exigirAcesso(usuario, e?.empresa_id, PAPEIS_CONTRATO);
    const evento = e!;
    exigirRevisao(evento, d.revisao);
    if (evento.contrato_assinado_em) throw new ErroOperacao("Contrato já registrado.", 409);
    if (Number.isNaN(Date.parse(d.assinadoEm)) || new Date(d.assinadoEm) > new Date()) throw new ErroOperacao("Data de assinatura inválida.", 409);
    if (faltaDadoContrato(evento, !!(await fixosDoEvento(tx, usuario, evento.id)).endereco)) throw new ErroOperacao("Complete tabela, pax, data, horários, endereço e contato local no evento.", 409);
    if (!caminhoValido(d.path, [evento.id], ["pdf"])) throw new ErroOperacao("Envie o PDF assinado antes de registrar.", 409);
    await tx`insert into evento_contratos (id, evento_id, empresa_id, arquivo_path, assinado_em, registrado_por) values (gen_random_uuid(), ${evento.id}, ${evento.empresa_id}, ${d.path}, ${d.assinadoEm}, ${usuario.id})`;
    // Porta única de escrita do evento: portão da proposta vigente, etapas da assinatura, revisão e filas AGENDA/FATURAMENTO.
    await atualizarEvento(tx, usuario, evento.id, { contrato_assinado_em: d.assinadoEm });
    await auditar(tx, usuario, { acao: "CONTRATO_REGISTRADO", entidade: "evento", entidadeId: evento.id, empresaId: evento.empresa_id });
    // Contrato fechado: a programação sai sozinha da proposta aprovada (quantidades, receitas, roteiro e horários).
    const programacao = await gerarProgramacaoAutomatica(tx, usuario, evento.id);
    return { id: evento.id, programacao };
  });
}

// ---------- documento operacional ----------
export const PAPEIS_DOCUMENTOS: PapelUsuario[] = ["ADMIN", "PROGRAMACAO", "PRODUCAO", "EXPEDICAO_COMPRAS", "ATENDIMENTO"];

/** Confirma, sob lock, que a versão usada no arquivo ainda é a aprovada, e registra o hash. */
export function registrarDocumentoOperacional(sql: Sql, usuario: UsuarioAutenticado, d: { programacaoId: string; tipo: "PROGRAMACAO" | "COMANDA" | "PLAQUINHAS"; setor: string; sha256: string }) {
  return emTransacao(sql, async tx => {
    const [p] = await tx<{ id: string; empresa_id: string; status: string; versao: number }[]>`select id, empresa_id, status, versao from programacoes where id = ${d.programacaoId} for share`;
    exigirAcesso(usuario, p?.empresa_id, PAPEIS_DOCUMENTOS);
    if (p!.status !== "APROVADA") throw new ErroOperacao("Programação invalidada ou ainda não aprovada. Atualize a tela.", 409);
    const [r] = await tx<{ id: string }[]>`insert into documentos_operacionais (id, empresa_id, programacao_id, tipo, setor, sha256, criado_por)
      values (gen_random_uuid(), ${p!.empresa_id}, ${p!.id}, ${d.tipo}, ${d.setor}, ${d.sha256}, ${usuario.id}) returning id`;
    await auditar(tx, usuario, { acao: "DOCUMENTO_GERADO", entidade: "programacao", entidadeId: p!.id, empresaId: p!.empresa_id, dados: { tipo: d.tipo, setor: d.setor, versao: p!.versao, sha256: d.sha256 } });
    return r!.id;
  });
}
