import { NextResponse } from "next/server";
import { getServerEnv } from "@/config/env";
import { autenticar, autorizarEmpresa, ErroAutorizacao, type PapelUsuario } from "@/dominios/acesso/autenticacao";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { ServicoDocumentosFiscais } from "./servico";
import { ConflitoFiscal } from "./estado";

/** Cria o serviço apenas quando as credenciais da aplicação e da integração fiscal estão configuradas. */
export function obterServicoDocumentosFiscais(): ServicoDocumentosFiscais {
  const ambiente = getServerEnv();
  if (!ambiente.ok) throw new Error("Backend não configurado.");
  const urlServicoFiscal = process.env.PIEGGI_SERVICO_FISCAL_URL;
  const tokenServicoFiscal = process.env.PIEGGI_SERVICO_FISCAL_TOKEN;
  if (!urlServicoFiscal || !tokenServicoFiscal) throw new Error("Serviço fiscal não configurado.");
  return new ServicoDocumentosFiscais({ banco: createServerSupabaseClient(ambiente.data), diretorioArmazenamento: process.env.PIEGGI_ARMAZENAMENTO_FISCAL_DIR ?? "/var/lib/pieggi/fiscal", urlServicoFiscal, tokenServicoFiscal, permitirProducao: process.env.PIEGGI_PERMITIR_PRODUCAO_FISCAL === "SIM", chaveCifragemFiscal: process.env.PIEGGI_CHAVE_CIFRAGEM_FISCAL });
}

export async function autorizarDocumentoFiscal(request: Request, documentoId: string, papeis: readonly PapelUsuario[]): Promise<{ servico: ServicoDocumentosFiscais; documento: Awaited<ReturnType<ServicoDocumentosFiscais["obter"]>> }> {
  const usuario = await autenticar(request, papeis);
  const servico = obterServicoDocumentosFiscais();
  const documento = await servico.obter(documentoId);
  autorizarEmpresa(usuario, documento.empresaId);
  return { servico, documento };
}

/** Converte erros operacionais em uma resposta previsível e sem detalhes internos. */
export function respostaErro(error: unknown): NextResponse {
  if (error instanceof ConflitoFiscal) return NextResponse.json({ error: { code: "FISCAL_CONFLICT", message: error.message } }, { status: 409 });
  if (error instanceof ErroAutorizacao) return NextResponse.json({ error: { code: "ACCESS_ERROR", message: error.message } }, { status: error.status });
  const mensagem = error instanceof Error ? error.message : "Erro interno.";
  return NextResponse.json({ error: { code: "FISCAL_ERROR", message: mensagem } }, { status: mensagem.includes("não encontrada") ? 404 : 422 });
}
