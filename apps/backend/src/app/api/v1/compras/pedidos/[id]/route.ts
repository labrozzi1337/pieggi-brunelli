import { z } from "zod";
import { autorizarEmpresa } from "@/dominios/acesso/autenticacao";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { dadosPedido } from "@/dominios/compras/servico";
import { gerarPdfTabela } from "@/dominios/documentos/pdf-tabela";
import { gerarXlsx } from "@/dominios/documentos/planilha-xlsx";

/** Exporta o pedido de compra para mandar ao fornecedor: ?empresaId=…&formato=pdf|xlsx */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = z.string().uuid().parse((await context.params).id);
    const q = z.object({ empresaId: z.string().uuid(), formato: z.enum(["pdf", "xlsx"]) }).parse(Object.fromEntries(new URL(request.url).searchParams));
    const { usuario, sql } = await contexto(request, ["ADMIN", "EXPEDICAO_COMPRAS"]);
    autorizarEmpresa(usuario, q.empresaId);
    const p = await dadosPedido(sql, q.empresaId, id);
    const arquivo = q.formato === "pdf"
      ? await gerarPdfTabela(p.titulo, p.colunas, p.linhas, p.totais)
      : await gerarXlsx([{ nome: "Pedido", colunas: p.colunas, linhas: [...p.linhas, p.totais] }]);
    return new Response(new Uint8Array(arquivo), {
      headers: {
        "Content-Type": q.formato === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${p.nome}.${q.formato}"`, "Cache-Control": "private, no-store"
      }
    });
  } catch (error) { return erroOperacao(error); }
}
