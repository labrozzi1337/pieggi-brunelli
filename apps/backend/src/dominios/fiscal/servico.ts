import type { ServerSupabaseClient } from "@/integrations/supabase/server";
import { createHash } from "node:crypto";
import { ProvedorArmazenamentoFiscalLocal } from "./armazenamento";
import { ClienteServicoFiscal } from "./cliente-servico-fiscal";
import { cifrarSegredoFiscal, decifrarSegredoFiscal } from "./criptografia";
import { documentoFiscalEditavel } from "./estado";
import { RepositorioFiscal, type TipoArquivoFiscal } from "./repositorio";
import type { DocumentoFiscal, DocumentoFiscalEntrada, ResultadoValidacaoFiscal } from "./tipos";
import { calcularTotaisDocumento, validarDocumentoFiscal } from "./validacao";

interface DependenciasServicoFiscal { banco: ServerSupabaseClient; diretorioArmazenamento: string; urlServicoFiscal: string; tokenServicoFiscal: string; permitirProducao: boolean; chaveCifragemFiscal?: string; }

/** Orquestra o ciclo fiscal no backend, mantendo cálculos, estado e persistência fora do PostgreSQL. */
export class ServicoDocumentosFiscais {
  private readonly repositorio: RepositorioFiscal;
  private readonly armazenamento: ProvedorArmazenamentoFiscalLocal;
  private readonly clienteFiscal: ClienteServicoFiscal;

  public constructor(private readonly dependencias: DependenciasServicoFiscal) {
    this.repositorio = new RepositorioFiscal(dependencias.banco);
    this.armazenamento = new ProvedorArmazenamentoFiscalLocal(dependencias.diretorioArmazenamento);
    this.clienteFiscal = new ClienteServicoFiscal(dependencias.urlServicoFiscal, dependencias.tokenServicoFiscal);
  }

  /** Cria somente um rascunho e recalcula seus totais a partir dos itens recebidos. */
  public criar(entrada: DocumentoFiscalEntrada): Promise<DocumentoFiscal> {
    return this.repositorio.criarDocumento(entrada, calcularTotaisDocumento(entrada.itens));
  }

  /** Obtém um documento junto dos itens fiscais persistidos. */
  public obter(documentoId: string): Promise<DocumentoFiscal> { return this.repositorio.obterDocumento(documentoId); }

  /** Lista documentos de uma empresa, sem misturar empresas na consulta. */
  public listar(empresaId: string, pagina: number, tamanhoPagina: number) { return this.repositorio.listarDocumentos(empresaId, pagina, tamanhoPagina); }

  /** Retorna itens do catálogo para pré-preencher o rascunho, sem omitir pendências de revisão. */
  public listarProdutos(empresaId: string, busca?: string) { return this.repositorio.listarProdutos(empresaId, busca); }

  /** Entrega somente artefatos registrados para o documento e lidos do armazenamento privado. */
  public async baixarArquivo(documento: DocumentoFiscal, tipo: TipoArquivoFiscal) {
    const arquivo = await this.repositorio.obterArquivo(documento.id, tipo);
    const conteudo = await this.armazenamento.ler(documento.empresaId, arquivo.caminho);
    return { ...arquivo, conteudo };
  }

  /** Vincula um A1 já guardado no diretório privado e persiste somente a senha cifrada. */
  public async registrarCertificado(empresaId: string, nomeArquivo: string, senha: string) {
    if (!this.dependencias.chaveCifragemFiscal) throw new Error("PIEGGI_CHAVE_CIFRAGEM_FISCAL não configurada.");
    const empresa = await this.repositorio.obterEmpresa(empresaId);
    const cnpjEmpresa = (typeof empresa.cnpj === "string" || typeof empresa.cnpj === "number" ? String(empresa.cnpj) : "").replace(/\D/g, "");
    if (cnpjEmpresa.length !== 14) throw new Error("A empresa fiscal não possui um CNPJ válido.");
    let arquivo: Uint8Array;
    try {
      arquivo = await this.armazenamento.ler(empresaId, `certificados/${nomeArquivo}`);
    } catch {
      throw new Error("Certificado não encontrado no armazenamento privado.");
    }
    if (arquivo.byteLength === 0) throw new Error("O arquivo do certificado está vazio.");
    const metadados = await this.clienteFiscal.validarCertificado(arquivo, senha, cnpjEmpresa);
    return this.repositorio.registrarCertificado(empresaId, {
      nomeArquivo, caminhoArmazenamento: `certificados/${nomeArquivo}`,
      tamanhoBytes: arquivo.byteLength, hashSha256: createHash("sha256").update(arquivo).digest("hex"),
      senhaCriptografada: cifrarSegredoFiscal(senha, this.dependencias.chaveCifragemFiscal), ...metadados
    });
  }

  /** Junta validações do domínio e do motor NFePHP; erro bloqueia a emissão. */
  public async validar(documentoId: string): Promise<ResultadoValidacaoFiscal[]> {
    const documento = await this.obter(documentoId);
    if (!documentoFiscalEditavel(documento.status)) throw new Error("O documento não pode ser validado neste estado.");
    await this.repositorio.alterarStatus(documento.id, "VALIDANDO", {}, documento.status, documento.atualizadoEm);
    try {
      const empresa = await this.repositorio.obterEmpresa(documento.empresaId);
      const resultados = [...validarDocumentoFiscal(documento), ...await this.clienteFiscal.validar({ ...documento, emitente: empresa })];
      const possuiErros = resultados.some((resultado) => resultado.nivel === "ERRO");
      await this.repositorio.alterarStatus(documento.id, possuiErros ? "RASCUNHO" : "PRONTO", {}, "VALIDANDO");
      return resultados;
    } catch (erro) {
      await this.repositorio.alterarStatus(documento.id, "ERRO", {}, "VALIDANDO");
      throw erro;
    }
  }

  /** Gera e arquiva o XML não assinado, sem simular assinatura, protocolo ou autorização. */
  public async gerarXml(documentoId: string): Promise<DocumentoFiscal> {
    const documento = await this.obter(documentoId);
    if (documento.status !== "PRONTO") throw new Error("Valide o documento antes de gerar o XML.");
    if (documento.ambiente === "PRODUCAO" && !this.dependencias.permitirProducao) throw new Error("Produção está bloqueada pela configuração do servidor.");
    const empresa = await this.repositorio.obterEmpresa(documento.empresaId);
    const numero = documento.numero ?? await this.repositorio.reservarNumero(documento);
    const geracao = await this.clienteFiscal.gerar({ ...documento, numero, emitente: empresa });
    const data = new Date();
    const arquivo = await this.armazenamento.gravar(documento.empresaId, [String(data.getUTCFullYear()), String(data.getUTCMonth() + 1).padStart(2, "0"), documento.id], "nfe.xml", new TextEncoder().encode(geracao.xml), "application/xml");
    await this.repositorio.registrarArquivo(documento.empresaId, documento.id, "XML_GERADO", arquivo);
    return this.obter(documento.id);
  }

  /** Confere pré-requisitos de transmissão sem inventar autorização quando não há certificado A1. */
  public async verificarEmissao(documentoId: string): Promise<{ podeEmitir: boolean; motivo?: string }> {
    const documento = await this.obter(documentoId);
    if (documento.status !== "PRONTO") return { podeEmitir: false, motivo: "Documento precisa estar pronto para emissão." };
    if (documento.ambiente === "PRODUCAO" && !this.dependencias.permitirProducao) return { podeEmitir: false, motivo: "Produção bloqueada pelo servidor." };
    if (!await this.repositorio.possuiCertificadoAtivo(documento.empresaId)) return { podeEmitir: false, motivo: "CERTIFICADO NÃO CONFIGURADO" };
    return { podeEmitir: true };
  }

  /** Assina, transmite em lote síncrono e persiste exatamente o retorno recebido da SEFAZ. */
  public async emitir(documentoId: string): Promise<DocumentoFiscal> {
    const preflight = await this.verificarEmissao(documentoId);
    if (!preflight.podeEmitir) throw new Error(preflight.motivo);
    if (!this.dependencias.chaveCifragemFiscal) throw new Error("PIEGGI_CHAVE_CIFRAGEM_FISCAL não configurada.");
    const documento = await this.obter(documentoId);
    const empresa = await this.repositorio.obterEmpresa(documento.empresaId);
    const certificado = await this.repositorio.obterCertificadoAtivo(documento.empresaId);
    const conteudo = await this.armazenamento.ler(documento.empresaId, certificado.caminhoArmazenamento);
    const senha = decifrarSegredoFiscal(certificado.senhaCriptografada, this.dependencias.chaveCifragemFiscal);
    // A disputa é resolvida no banco, antes de reservar número ou iniciar transmissão.
    await this.repositorio.alterarStatus(documento.id, "ASSINANDO", {}, "PRONTO", documento.atualizadoEm);
    let numero = documento.numero ?? undefined;
    let envioIniciado = false;
    let retornoPersistido = false;
    try {
      numero ??= await this.repositorio.reservarNumero(documento);
      await this.repositorio.alterarStatus(documento.id, "ENVIANDO", { numero }, "ASSINANDO");
      envioIniciado = true;
      const retorno = await this.clienteFiscal.transmitir({ ...documento, numero, emitente: empresa }, conteudo, senha);
      const status = retorno.autorizado ? "AUTORIZADO" : (["110", "301", "302"].includes(retorno.codigoStatusSefaz) ? "DENEGADO" : "REJEITADO");
      await this.repositorio.alterarStatus(documento.id, status, { numero, chaveAcesso: retorno.chaveAcesso, codigoStatusSefaz: retorno.codigoStatusSefaz, mensagemSefaz: retorno.mensagemSefaz }, "ENVIANDO");
      retornoPersistido = true;
      const data = new Date();
      const pasta = [String(data.getUTCFullYear()), String(data.getUTCMonth() + 1).padStart(2, "0"), documento.id];
      const assinado = await this.armazenamento.gravar(documento.empresaId, pasta, "nfe-assinada.xml", new TextEncoder().encode(retorno.xmlAssinado), "application/xml");
      await this.repositorio.registrarArquivo(documento.empresaId, documento.id, "XML_ASSINADO", assinado);
      if (retorno.xmlAutorizado) {
        const autorizado = await this.armazenamento.gravar(documento.empresaId, pasta, "nfe-autorizada.xml", new TextEncoder().encode(retorno.xmlAutorizado), "application/xml");
        await this.repositorio.registrarArquivo(documento.empresaId, documento.id, "XML_AUTORIZADO", autorizado);
        const pdf = await this.clienteFiscal.gerarDanfe(retorno.xmlAutorizado);
        const danfe = await this.armazenamento.gravar(documento.empresaId, pasta, "danfe.pdf", pdf, "application/pdf");
        await this.repositorio.registrarArquivo(documento.empresaId, documento.id, "DANFE", danfe);
      }
      await this.repositorio.registrarEvento(documento.id, status, retorno.protocolo ?? null, retorno.mensagemSefaz, { codigoStatusSefaz: retorno.codigoStatusSefaz, chaveAcesso: retorno.chaveAcesso });
      return this.obter(documento.id);
    } catch (erro) {
      if (!retornoPersistido) await this.repositorio.alterarStatus(documento.id, envioIniciado ? "PROCESSANDO" : "ERRO", { numero, mensagemSefaz: erro instanceof Error ? erro.message : "Falha técnica na emissão." }, envioIniciado ? "ENVIANDO" : "ASSINANDO");
      throw erro;
    }
  }
}
