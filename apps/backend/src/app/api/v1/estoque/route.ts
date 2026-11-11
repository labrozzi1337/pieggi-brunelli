import { NextResponse } from "next/server";
import { z } from "zod";
import { autorizarEmpresa, exigirPapel, type PapelUsuario } from "@/dominios/acesso/autenticacao";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { PAPEIS_FINANCEIROS } from "@/dominios/regras/repositorio";
import { SETORES, setores } from "@/dominios/compras/calculos";
import { lancarNotas, painelEstoque, registrarDevolucao, registrarInventario, sugerir } from "@/dominios/compras/servico";

const LEITURA: PapelUsuario[] = ["ADMIN", "EXPEDICAO_COMPRAS", "PRODUCAO", "PROGRAMACAO", "COMERCIAL"];
const ESCRITA: PapelUsuario[] = ["ADMIN", "EXPEDICAO_COMPRAS"];
const INVENTARIO: PapelUsuario[] = ["ADMIN", "EXPEDICAO_COMPRAS", "PRODUCAO"];

const qtd = z.number().positive().max(1000000);
const comando = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("NOTAS_LANCAR"), dados: z.object({ notas: z.array(z.object({
    fornecedorId: z.string().uuid(), numero: z.string().trim().max(60), emitidaEm: z.string().date(),
    fotoPath: z.string().max(300).nullable().optional(), pedidoId: z.string().uuid().nullable().optional(),
    itens: z.array(z.object({
      insumoId: z.string().uuid(), descricao: z.string().trim().min(1).max(300), quantidade: qtd, fator: qtd, valorTotal: z.number().min(0).max(10000000),
      lote: z.string().trim().max(60).optional(), validade: z.string().date().nullable().optional()
    }).strict()).min(1).max(200)
  }).strict()).min(1).max(30) }).strict() }),
  z.object({ acao: z.literal("DEVOLUCAO"), dados: z.object({ eventoId: z.string().uuid(), itens: z.array(z.object({ insumoId: z.string().uuid(), quantidade: qtd }).strict()).min(1).max(200) }).strict() }),
  z.object({ acao: z.literal("INVENTARIO"), dados: z.object({
    setor: z.enum(setores),
    contagens: z.array(z.object({ insumoId: z.string().uuid(), contado: z.number().min(0).max(1000000), justificativa: z.string().trim().max(500).optional() }).strict()).min(1).max(1000)
  }).strict() })
]);

export async function GET(request: Request) {
  try {
    const q = z.object({ empresaId: z.string().uuid(), sugerir: z.string().trim().min(2).max(300).optional(), fornecedorId: z.string().uuid().optional() })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    const { usuario, sql } = await contexto(request, LEITURA);
    autorizarEmpresa(usuario, q.empresaId);
    if (q.sugerir) return NextResponse.json({ data: await sugerir(sql, q.empresaId, q.fornecedorId ?? null, q.sugerir) }, { headers: { "Cache-Control": "private, no-store" } });
    const financeiro = usuario.papeis.some((p) => (PAPEIS_FINANCEIROS as readonly string[]).includes(p));
    const [painel, fornecedores, pedidos] = await Promise.all([
      painelEstoque(sql, q.empresaId, financeiro),
      sql`select id, nome from fornecedores where empresa_id = ${q.empresaId} and ativo order by nome`,
      sql`select pc.id, f.nome fornecedor, pc.semana::text semana, pc.fornecedor_id from pedidos_compra pc join fornecedores f on f.id = pc.fornecedor_id
        where pc.empresa_id = ${q.empresaId} and pc.status in ('ABERTO','ENVIADO') order by pc.semana desc`
    ]);
    return NextResponse.json({ data: { ...painel, fornecedores, pedidos, setores: SETORES } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return erroOperacao(error); }
}

export async function POST(request: Request) {
  try {
    const { empresaId, comando: c } = z.object({ empresaId: z.string().uuid(), comando }).strict().parse(await request.json());
    const { usuario, sql } = await contexto(request);
    autorizarEmpresa(usuario, empresaId);
    exigirPapel(usuario, c.acao === "INVENTARIO" ? INVENTARIO : ESCRITA);
    const data = await sql.begin(async (tx) => {
      if (c.acao === "NOTAS_LANCAR") return lancarNotas(tx, usuario, empresaId, c.dados.notas);
      if (c.acao === "DEVOLUCAO") { await registrarDevolucao(tx, usuario, empresaId, c.dados.eventoId, c.dados.itens); return { ok: true }; }
      return registrarInventario(tx, usuario, empresaId, c.dados.setor, c.dados.contagens);
    });
    return NextResponse.json({ data });
  } catch (error) { return erroOperacao(error); }
}
