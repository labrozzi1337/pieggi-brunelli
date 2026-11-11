import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticar, autorizarEmpresa } from "@/dominios/acesso/autenticacao";
import { obterServicoDocumentosFiscais, respostaErro } from "@/dominios/fiscal/http";

export const runtime = "nodejs";

/** Lista produtos fiscais ativos para seleção no rascunho de NF-e. */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const consulta = z.object({ empresaId: z.string().uuid(), busca: z.string().trim().min(1).max(100).optional() }).parse(Object.fromEntries(new URL(request.url).searchParams));
    autorizarEmpresa(await autenticar(request, ["ADMIN", "FINANCEIRO", "COMERCIAL", "ATENDIMENTO"]), consulta.empresaId);
    const produtos = await obterServicoDocumentosFiscais().listarProdutos(consulta.empresaId, consulta.busca);
    return NextResponse.json({ data: produtos, meta: { requestId: request.headers.get("x-request-id") } });
  } catch (error) { return respostaErro(error); }
}
