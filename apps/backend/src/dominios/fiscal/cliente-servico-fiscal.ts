import type { DocumentoFiscalEntrada, ResultadoValidacaoFiscal } from "./tipos";

interface RespostaServicoFiscal<T> { data: T; }

export interface GeracaoFiscal { xml: string; avisos: ResultadoValidacaoFiscal[]; }
export interface TransmissaoFiscal { xmlAssinado: string; xmlAutorizado?: string; autorizado: boolean; codigoStatusSefaz: string; mensagemSefaz: string; chaveAcesso: string; protocolo?: string; }
export interface CertificadoFiscalValidado { titular: string; cnpjTitular: string; emissor: string; validoDe: string; validoAte: string; }

/** Consome o serviço PHP interno; nenhum detalhe de NFePHP vaza para as rotas Next.js. */
export class ClienteServicoFiscal {
  public constructor(private readonly urlBase: string, private readonly token: string) {}

  public validar(documento: DocumentoFiscalEntrada & { emitente?: Record<string, unknown> }): Promise<ResultadoValidacaoFiscal[]> {
    return this.requisitar<RespostaServicoFiscal<{ resultados: ResultadoValidacaoFiscal[] }>>("/nfe/validar", documento).then((resposta) => resposta.data.resultados);
  }

  public gerar(documento: DocumentoFiscalEntrada & { numero: number; emitente: Record<string, unknown> }): Promise<GeracaoFiscal> {
    return this.requisitar<RespostaServicoFiscal<GeracaoFiscal>>("/nfe/gerar", documento).then((resposta) => resposta.data);
  }

  public validarCertificado(conteudo: Uint8Array, senha: string, cnpjEsperado: string): Promise<CertificadoFiscalValidado> {
    return this.requisitar<RespostaServicoFiscal<CertificadoFiscalValidado>>("/certificados/validar", { conteudoBase64: Buffer.from(conteudo).toString("base64"), senha, cnpjEsperado }).then((resposta) => resposta.data);
  }

  public transmitir(documento: DocumentoFiscalEntrada & { numero: number; emitente: Record<string, unknown> }, conteudo: Uint8Array, senha: string): Promise<TransmissaoFiscal> {
    return this.requisitar<RespostaServicoFiscal<TransmissaoFiscal>>("/nfe/transmitir", { documento, conteudoBase64: Buffer.from(conteudo).toString("base64"), senha }).then((resposta) => resposta.data);
  }

  public gerarDanfe(xmlAutorizado: string): Promise<Uint8Array> {
    return this.requisitar<RespostaServicoFiscal<{ pdfBase64: string }>>("/nfe/danfe", { xmlBase64: Buffer.from(xmlAutorizado).toString("base64") }).then((resposta) => Buffer.from(resposta.data.pdfBase64, "base64"));
  }

  private async requisitar<T>(rota: string, corpo: unknown): Promise<T> {
    const resposta = await fetch(`${this.urlBase}${rota}`, { method: "POST", headers: { "content-type": "application/json", "x-servico-fiscal-token": this.token }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(120_000) });
    const dados: unknown = await resposta.json().catch(() => null);
    if (!resposta.ok) throw new Error(typeof dados === "object" && dados && "erro" in dados ? String(dados.erro) : "Serviço fiscal indisponível.");
    return dados as T;
  }
}
