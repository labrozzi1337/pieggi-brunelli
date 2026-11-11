import { NextResponse } from "next/server";
import { z } from "zod";
import { autorizarEmpresa, exigirPapel, type PapelUsuario } from "@/dominios/acesso/autenticacao";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { PAPEIS_FINANCEIROS } from "@/dominios/regras/repositorio";
import { SETORES, setores, unidadesUso } from "@/dominios/compras/calculos";
import {
  atualizarReferenciaCmv, cotacao, fichasTecnicas, gerarPedidosSemana, listarInsumos, listarOfertas, mudarStatusPedido, parametros,
  reprocessarPendencias, salvarCotacao, salvarFicha, salvarFornecedor, salvarInsumo, visaoSemanal
} from "@/dominios/compras/servico";

const LEITURA: PapelUsuario[] = ["ADMIN", "EXPEDICAO_COMPRAS", "PROGRAMACAO", "PRODUCAO", "COMERCIAL"];
const COMPRAS: PapelUsuario[] = ["ADMIN", "EXPEDICAO_COMPRAS"];
const FICHA: PapelUsuario[] = ["ADMIN", "EXPEDICAO_COMPRAS", "PRODUCAO"];
const CMV: PapelUsuario[] = ["ADMIN", "COMERCIAL"];

const texto = z.string().trim().min(2).max(200);
const qtd = z.number().positive().max(1000000);
const periodo = z.object({ inicio: z.string().date(), fim: z.string().date() }).refine((v) => v.inicio <= v.fim, "Período inválido.");
const comando = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("PEDIDOS_GERAR"), dados: periodo }),
  z.object({ acao: z.literal("PENDENCIAS_REPROCESSAR"), dados: periodo }),
  z.object({ acao: z.literal("PEDIDO_STATUS"), dados: z.object({ id: z.string().uuid(), status: z.enum(["ENVIADO", "RECEBIDO", "CANCELADO"]) }).strict() }),
  z.object({ acao: z.literal("FORNECEDOR_SALVAR"), dados: z.object({
    id: z.string().uuid().optional(), nome: texto, contato: z.string().trim().max(300), codigo: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,40}$/).nullable(),
    categorias: z.array(z.enum(setores)).max(10), prazoPagamentoDias: z.number().int().min(0).max(365), pedidoMinimo: z.number().min(0).max(10000000), ativo: z.boolean()
  }).strict() }),
  z.object({ acao: z.literal("INSUMO_SALVAR"), dados: z.object({
    id: z.string().uuid().optional(), nome: texto, marca: z.string().trim().max(100), setor: z.enum(setores), unidade: z.enum(unidadesUso),
    unidadeCompra: z.string().trim().max(100), fatorCompra: qtd, estoqueMinimo: z.number().min(0).max(1000000), perecivel: z.boolean(),
    rendimentoChave: z.string().regex(/^[A-Z0-9_]{2,40}$/).nullable(), ativo: z.boolean()
  }).strict() }),
  z.object({ acao: z.literal("COTACAO_SALVAR"), dados: z.object({
    insumoId: z.string().uuid(), fornecedorId: z.string().uuid(), embalagem: z.string().trim().max(100), quantidadeEmbalagem: qtd,
    unidadeEmbalagem: z.enum(unidadesUso), preco: z.number().min(0).max(10000000), preferido: z.boolean()
  }).strict() }),
  z.object({ acao: z.literal("FICHA_SALVAR"), dados: z.object({
    itemId: z.string().uuid(),
    linhas: z.array(z.object({ insumoId: z.string().uuid(), unidadeItem: z.enum(["UN", "KG", "G", "L", "ML", "GARRAFA", "TRAVESSA", "PACOTE"]), quantidade: qtd, rendimento: z.number().positive().max(100).nullable() }).strict()).max(60)
  }).strict() }),
  z.object({ acao: z.literal("CMV_REFERENCIA"), dados: z.object({ itemId: z.string().uuid() }).strict() })
]);
const entrada = z.object({ empresaId: z.string().uuid(), comando }).strict();

export async function GET(request: Request) {
  try {
    const q = z.object({ empresaId: z.string().uuid(), visao: z.enum(["semana", "cotacao", "cadastros", "fichas"]).default("semana"), inicio: z.string().date().optional(), fim: z.string().date().optional() })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    const { usuario, sql } = await contexto(request, LEITURA);
    autorizarEmpresa(usuario, q.empresaId);
    let data: unknown;
    if (q.visao === "semana") {
      const p = periodo.parse({ inicio: q.inicio, fim: q.fim });
      data = await visaoSemanal(sql, q.empresaId, p.inicio, p.fim);
    } else if (q.visao === "cotacao") data = await cotacao(sql, q.empresaId);
    else if (q.visao === "cadastros") {
      const [fornecedores, insumos, ofertas, { rendimentos }] = await Promise.all([
        sql`select id, nome, contato, codigo, categorias, prazo_pagamento_dias, pedido_minimo, ativo from fornecedores where empresa_id = ${q.empresaId} order by nome`,
        listarInsumos(sql, q.empresaId), listarOfertas(sql, q.empresaId), parametros(sql)
      ]);
      data = { fornecedores, insumos, ofertas, setores: SETORES, rendimentos };
    } else {
      const comCusto = usuario.papeis.some((p) => (PAPEIS_FINANCEIROS as readonly string[]).includes(p));
      const [itens, insumos] = await Promise.all([fichasTecnicas(sql, q.empresaId), listarInsumos(sql, q.empresaId)]);
      data = { itens: comCusto ? itens : itens.map((i) => ({ ...i, custo: null })), insumos: insumos.filter((i) => i.ativo).map((i) => ({ id: i.id, nome: i.nome, unidade: i.unidade, setor: i.setor, rendimentoChave: i.rendimento_chave })) };
    }
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return erroOperacao(error); }
}

export async function POST(request: Request) {
  try {
    const { empresaId, comando: c } = entrada.parse(await request.json());
    const { usuario, sql } = await contexto(request);
    autorizarEmpresa(usuario, empresaId);
    exigirPapel(usuario, c.acao === "FICHA_SALVAR" ? FICHA : c.acao === "CMV_REFERENCIA" ? CMV : COMPRAS);
    const data = await sql.begin(async (tx) => {
      switch (c.acao) {
        case "PEDIDOS_GERAR": return gerarPedidosSemana(tx, usuario, empresaId, c.dados.inicio, c.dados.fim);
        case "PENDENCIAS_REPROCESSAR": return reprocessarPendencias(tx, usuario, empresaId, c.dados.inicio, c.dados.fim);
        case "PEDIDO_STATUS": await mudarStatusPedido(tx, usuario, empresaId, c.dados.id, c.dados.status); return { id: c.dados.id };
        case "FORNECEDOR_SALVAR": return salvarFornecedor(tx, usuario, empresaId, c.dados);
        case "INSUMO_SALVAR": return salvarInsumo(tx, usuario, empresaId, c.dados);
        case "COTACAO_SALVAR": await salvarCotacao(tx, usuario, empresaId, c.dados); return { ok: true };
        case "FICHA_SALVAR": await salvarFicha(tx, usuario, empresaId, c.dados.itemId, c.dados.linhas); return { ok: true };
        case "CMV_REFERENCIA": await atualizarReferenciaCmv(tx, usuario, c.dados.itemId); return { ok: true };
      }
    });
    return NextResponse.json({ data });
  } catch (error) { return erroOperacao(error); }
}
