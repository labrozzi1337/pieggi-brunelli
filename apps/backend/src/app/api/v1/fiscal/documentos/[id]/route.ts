import { NextResponse } from "next/server";
import { autorizarDocumentoFiscal, respostaErro } from "@/dominios/fiscal/http";

/** Retorna o snapshot do documento, inclusive itens fiscais persistidos. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const { documento } = await autorizarDocumentoFiscal(request, id, ["ADMIN", "FINANCEIRO", "COMERCIAL", "ATENDIMENTO"]);
    return NextResponse.json({ data: documento, meta: { requestId: request.headers.get("x-request-id") } });
  } catch (error) { return respostaErro(error); }
}
