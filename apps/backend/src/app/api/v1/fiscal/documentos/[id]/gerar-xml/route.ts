import { NextResponse } from "next/server";
import { autorizarDocumentoFiscal, respostaErro } from "@/dominios/fiscal/http";

/** Gera o XML técnico não assinado e grava o artefato privado com hash. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const { servico } = await autorizarDocumentoFiscal(request, id, ["ADMIN", "FINANCEIRO"]);
    const documento = await servico.gerarXml(id);
    return NextResponse.json({ data: documento, meta: { requestId: request.headers.get("x-request-id") } });
  } catch (error) { return respostaErro(error); }
}
