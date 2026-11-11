import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticar, autorizarEmpresa } from "@/dominios/acesso/autenticacao";
import { obterServicoDocumentosFiscais, respostaErro } from "@/dominios/fiscal/http";

export const runtime = "nodejs";

const certificadoSchema = z.object({
  empresaId: z.string().uuid(),
  nomeArquivo: z.string().trim().min(1).max(255).refine((nome) => !/[\\/]/.test(nome) && /\.(pfx|p12)$/i.test(nome), "Informe um arquivo .pfx ou .p12 sem caminho."),
  senha: z.string().min(1).max(1000)
});

/** Registra um A1 que já esteja no armazenamento fiscal privado. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const entrada = certificadoSchema.parse(await request.json());
    autorizarEmpresa(await autenticar(request, ["ADMIN"]), entrada.empresaId);
    const certificado = await obterServicoDocumentosFiscais().registrarCertificado(entrada.empresaId, entrada.nomeArquivo, entrada.senha);
    return NextResponse.json({ data: certificado, meta: { requestId: request.headers.get("x-request-id") } }, { status: 201 });
  } catch (error) { return respostaErro(error); }
}
