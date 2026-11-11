import { autorizarDocumentoFiscal, respostaErro } from "@/dominios/fiscal/http";
import type { TipoArquivoFiscal } from "@/dominios/fiscal/repositorio";

const tipos: Record<string, TipoArquivoFiscal> = { xml: "XML_AUTORIZADO", pdf: "DANFE" };

export async function GET(request: Request, context: { params: Promise<{ id: string; tipo: string }> }): Promise<Response> {
  try {
    const { id, tipo } = await context.params;
    const tipoArquivo = tipos[tipo];
    if (!tipoArquivo) return Response.json({ error: { code: "VALIDATION_ERROR", message: "Tipo de arquivo inválido." } }, { status: 400 });
    const { servico, documento } = await autorizarDocumentoFiscal(request, id, ["ADMIN", "FINANCEIRO", "COMERCIAL", "ATENDIMENTO"]);
    const arquivo = await servico.baixarArquivo(documento, tipoArquivo);
    const nome = `nfe-${documento.numero ?? documento.id}.${tipo}`;
    return new Response(Buffer.from(arquivo.conteudo), {
      headers: {
        "Content-Type": arquivo.mimeType,
        "Content-Disposition": `attachment; filename="${nome}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    return respostaErro(error);
  }
}
