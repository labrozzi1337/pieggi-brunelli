import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticar, autorizarEmpresa } from "@/dominios/acesso/autenticacao";
import { obterServicoDocumentosFiscais, respostaErro } from "@/dominios/fiscal/http";
import { documentoFiscalEntradaSchema } from "@/dominios/fiscal/validacao";

export const runtime = "nodejs";

/** Cria rascunhos e lista documentos fiscais de uma empresa. */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const consulta = z.object({ empresaId: z.string().uuid(), pagina: z.coerce.number().int().min(1).default(1), tamanhoPagina: z.coerce.number().int().min(1).max(100).default(20) }).parse(Object.fromEntries(new URL(request.url).searchParams));
    autorizarEmpresa(await autenticar(request, ["ADMIN", "FINANCEIRO", "COMERCIAL", "ATENDIMENTO"]), consulta.empresaId);
    const resultado = await obterServicoDocumentosFiscais().listar(consulta.empresaId, consulta.pagina, consulta.tamanhoPagina);
    return NextResponse.json({ data: resultado, meta: { requestId: request.headers.get("x-request-id") } });
  } catch (error) { return respostaErro(error); }
}

/** Cria um documento em RASCUNHO; totais enviados pelo cliente não são aceitos no contrato. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const entrada = documentoFiscalEntradaSchema.parse(await request.json());
    autorizarEmpresa(await autenticar(request, ["ADMIN", "FINANCEIRO"]), entrada.empresaId);
    const documento = await obterServicoDocumentosFiscais().criar(entrada);
    return NextResponse.json({ data: documento, meta: { requestId: request.headers.get("x-request-id") } }, { status: 201 });
  } catch (error) { return respostaErro(error); }
}
