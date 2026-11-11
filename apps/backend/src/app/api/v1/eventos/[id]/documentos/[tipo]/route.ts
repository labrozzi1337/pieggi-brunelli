import { createHash } from "node:crypto";
import { z } from "zod";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { disposicao, documentoDoEvento, TIPOS_DOCUMENTO } from "@/dominios/operacao/documentos-evento";
import { registrarDocumentoOperacional } from "@/dominios/campo/registros";

const TIPO_REGISTRO = { programacao: "PROGRAMACAO", comanda: "COMANDA", plaquinha: "PLAQUINHAS" } as const;

/** Baixa um dos 4 arquivos do evento. 409 com `problemas` quando há bloqueio, regra/tradução faltando ou render reprovado. */
export async function GET(request: Request, context: { params: Promise<{ id: string; tipo: string }> }) {
  try {
    const params = await context.params;
    const id = z.string().uuid().parse(params.id);
    const tipo = z.enum(TIPOS_DOCUMENTO).parse(params.tipo);
    const { sql, usuario } = await contexto(request);
    const arquivo = await documentoDoEvento(sql, usuario, id, tipo);
    const sha256 = createHash("sha256").update(arquivo.buffer).digest("hex");
    // Rastreabilidade: hash do arquivo entregue, ligado à versão aprovada da programação.
    if (tipo !== "proposta" && arquivo.programacaoId && arquivo.aprovada) await registrarDocumentoOperacional(sql, usuario, { programacaoId: arquivo.programacaoId, tipo: TIPO_REGISTRO[tipo], setor: "", sha256 });
    return new Response(new Uint8Array(arquivo.buffer), { headers: {
      "Content-Type": arquivo.mime, "Content-Disposition": disposicao(arquivo.nome), "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff", "X-Documento-Sha256": sha256
    } });
  } catch (error) { return erroOperacao(error); }
}
