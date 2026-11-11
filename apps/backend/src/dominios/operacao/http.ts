import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { autenticar, ErroAutorizacao, exigirPapel, type PapelUsuario, type UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import { banco, ErroBancoNaoConfigurado, type Tx } from "@/integrations/banco";

/**
 * Ponto de entrada de toda rota autenticada: valida a sessão, aplica os papéis exigidos e entrega o SQL.
 * Regras, autorização por empresa, versionamento e auditoria são responsabilidade do backend — o banco só guarda.
 */
export async function contexto(request: Request, papeis?: readonly PapelUsuario[]) {
  const usuario = await autenticar(request);
  if (papeis) exigirPapel(usuario, papeis);
  return { usuario, sql: banco() };
}

/** Registro de auditoria (autor, data, antes/depois). Chame dentro da mesma transação da alteração. */
export async function auditar(tx: Tx, usuario: UsuarioAutenticado, a: { acao: string; entidade: string; entidadeId: string; empresaId?: string | null; dados?: Record<string, unknown> }) {
  await tx`insert into auditoria_eventos (id, empresa_id, usuario_id, acao, entidade, entidade_id, dados)
    values (${randomUUID()}, ${a.empresaId ?? null}, ${usuario.id}, ${a.acao}, ${a.entidade}, ${a.entidadeId}, ${tx.json(a.dados ?? {})})`;
}

/** Controle otimista: incrementa `revisao` só se ainda for a revisão que o usuário viu. */
export async function travarRevisao(tx: Tx, tabela: "eventos", id: string, revisao: number) {
  const [linha] = await tx<{ revisao: number; empresa_id: string }[]>`
    update ${tx(tabela)} set revisao = revisao + 1, atualizado_em = now() where id = ${id} and revisao = ${revisao} returning revisao, empresa_id`;
  if (!linha) {
    const [existe] = await tx`select 1 from ${tx(tabela)} where id = ${id}`;
    throw new ErroOperacao(existe ? "Outra pessoa alterou este registro. Atualize a tela e repita." : "Registro não encontrado.", existe ? 409 : 404);
  }
  return linha;
}

export class ErroOperacao extends Error {
  constructor(message: string, readonly status: 400 | 403 | 404 | 409 | 422 | 502) { super(message); }
}

export function erroOperacao(error: unknown) {
  if (error instanceof ErroAutorizacao || error instanceof ErroOperacao || error instanceof ErroBancoNaoConfigurado) {
    const problemas = "problemas" in error && Array.isArray(error.problemas) ? { problemas: error.problemas as string[] } : {};
    return NextResponse.json({ error: { message: error.message, ...problemas } }, { status: error.status });
  }
  if (error instanceof z.ZodError) return NextResponse.json({ error: { message: error.issues[0]?.message ?? "Dados inválidos." } }, { status: 400 });
  if (typeof error === "object" && error !== null && "code" in error) {
    const codigo = String(error.code);
    const mensagem = "message" in error ? String(error.message) : "Operação não permitida.";
    if (["P0001", "40001", "42501"].includes(codigo)) return NextResponse.json({ error: { message: mensagem } }, { status: codigo === "42501" ? 403 : 409 });
    if (codigo === "23505") return NextResponse.json({ error: { message: "Registro duplicado: já existe um cadastro com esses dados." } }, { status: 409 });
    if (codigo === "23503" || codigo === "23514" || codigo === "22P02") return NextResponse.json({ error: { message: "Dados inconsistentes para esta operação." } }, { status: 422 });
    if (["42P01", "42703", "42883", "PGRST202", "PGRST204", "PGRST205"].includes(codigo)) return NextResponse.json({ error: { message: "Banco desatualizado. Rode npm run db:migrar." } }, { status: 503 });
  }
  console.error("[erroOperacao]", error);
  return NextResponse.json({ error: { message: "Não foi possível confirmar o resultado. Atualize os dados antes de repetir a operação." } }, { status: 500 });
}

export const rotuloProgramacaoSchema = z.object({
  nomeEn: z.string().trim().max(200), nomeEs: z.string().trim().max(200),
  descricaoPt: z.string().trim().max(250), descricaoEn: z.string().trim().max(250), descricaoEs: z.string().trim().max(250),
  ficha: z.string().trim().max(100),
  restricoes: z.array(z.enum(["SEM_GLUTEN","VEGANO","VEGETARIANO","SEM_LACTOSE","SEM_ACUCAR"])).max(5),
  confirmado: z.boolean(), exibir: z.boolean()
}).strict();
export const itemProgramacaoSchema = z.object({
  nome: z.string().trim().min(2).max(200), receita: z.string().trim().min(5).max(5000),
  quantidade: z.number().positive().max(1000000), unidade: z.enum(["UN", "KG", "G", "L", "ML"]),
  setor: z.enum(["A_CLASSIFICAR", "COZINHA_QUENTE", "COZINHA_FRIA", "CONFEITARIA", "BEBIDAS", "ESTRUTURA", "FORNECEDOR"]),
  servico: z.string().trim().max(100), produtoId: z.string().uuid().optional(),
  // Vínculo com a programação gerada pelo motor (posição na estrutura) e dados que Compras usa.
  ref: z.string().regex(/^\d+:\d+$/).optional(), cardapioItemId: z.string().uuid().nullish(),
  compradoPronto: z.boolean().optional(), fornecedor: z.string().trim().max(60).nullish()
}).strict();
export const etapaCampoSchema = z.object({tipo:z.enum(["MONTAGEM","REPOSICAO","DESMONTAGEM"]),titulo:z.string().trim().min(2).max(200),orientacao:z.string().trim().min(5).max(2000),previstoEm:z.string().datetime({offset:true})}).strict();

const dinheiro = z.number().nonnegative().max(999999999).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001, "Use no máximo duas casas decimais.");
export const comandoSchema = z.object({
  revisao: z.number().int().positive(),
  comando: z.discriminatedUnion("acao", [
    z.object({ acao: z.literal("PROGRAMACAO_SALVAR"), dados: z.object({ saidaEm: z.string().datetime({ offset: true }), alteracoes: z.string().trim().min(5).max(5000), itens: z.array(itemProgramacaoSchema).min(1).max(500), rotulos: z.array(rotuloProgramacaoSchema).max(500).optional(), roteiroCampo:z.array(etapaCampoSchema).max(200) }).strict() }),
    z.object({ acao: z.literal("PROGRAMACAO_APROVAR"), dados: z.object({}).strict() }),
    z.object({ acao: z.literal("TAREFA_ATUALIZAR"), dados: z.object({ id: z.string().uuid(), estado: z.enum(["EM_ANDAMENTO", "PRONTO"]) }).strict() }),
    z.object({ acao: z.literal("EXPEDIR"), dados: z.object({}).strict() }),
    z.object({ acao: z.literal("ENTREGAR"), dados: z.object({}).strict() }),
    z.object({ acao: z.literal("TITULO_CRIAR"), dados: z.object({ descricao: z.string().trim().min(2).max(200), valor: dinheiro.refine(v => v > 0), vencimento: z.string().date(), forma: z.enum(["PIX", "BOLETO", "TRANSFERENCIA", "CARTAO", "DINHEIRO"]), idempotencia: z.string().uuid() }).strict() }),
    z.object({ acao: z.literal("TITULO_RECEBER"), dados: z.object({ id: z.string().uuid(), recebidoEm: z.string().date(), referencia: z.string().trim().max(200) }).strict() }),
    z.object({ acao: z.literal("POS_VENDA"), dados: z.object({ nota: z.number().int().min(0).max(10), comentario: z.string().trim().max(5000), retornoEm: z.string().date().nullable() }).strict() })
  ])
}).strict();
