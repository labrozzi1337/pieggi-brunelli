import { NextResponse } from "next/server";
import { autorizarDocumentoFiscal, respostaErro } from "@/dominios/fiscal/http";

/** Valida o rascunho no domínio e no motor fiscal antes de qualquer emissão. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const { servico } = await autorizarDocumentoFiscal(request, id, ["ADMIN", "FINANCEIRO"]);
    const resultados = await servico.validar(id);
    return NextResponse.json({ data: { resultados }, meta: { requestId: request.headers.get("x-request-id") } });
  } catch (error) { return respostaErro(error); }
}
