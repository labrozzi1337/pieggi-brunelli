import { banco as sqlDireto } from "@/integrations/banco";
import type { ServerSupabaseClient } from "@/integrations/supabase/server";
import { ConflitoFiscal, podeTransicionarDocumento } from "./estado";
import type { DocumentoFiscal, DocumentoFiscalEntrada, ItemDocumentoFiscal, ProdutoFiscal, StatusDocumentoFiscal, TotaisDocumentoFiscal } from "./tipos";

type Linha = Record<string, unknown>;
export interface CertificadoFiscalAtivo { caminhoArmazenamento: string; senhaCriptografada: string; }
export type TipoArquivoFiscal = "XML_AUTORIZADO" | "DANFE";
export interface ArquivoFiscal { caminho: string; nome: string; mimeType: string; }

/** Centraliza a persistência; não contém cálculos nem transições de negócio. */
export class RepositorioFiscal {
  public constructor(private readonly banco: ServerSupabaseClient) {}

  public async obterEmpresa(empresaId: string): Promise<Linha> {
    const { data, error } = await this.banco.from("fiscal_empresas").select("*").eq("id", empresaId).maybeSingle() as unknown as { data: unknown; error: { message: string } | null };
    if (error) throw new Error("Não foi possível consultar a empresa fiscal.");
    if (!data) throw new Error("Empresa fiscal não encontrada.");
    return data as Linha;
  }

  public async possuiCertificadoAtivo(empresaId: string): Promise<boolean> {
    const { count, error } = await this.banco.from("fiscal_certificados").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("status", "ATIVO") as unknown as { count: number | null; error: { message: string } | null };
    if (error) throw new Error("Não foi possível verificar o certificado.");
    return (count ?? 0) > 0;
  }

  public async obterCertificadoAtivo(empresaId: string): Promise<CertificadoFiscalAtivo> {
    const { data, error } = await this.banco.from("fiscal_certificados").select("caminho_armazenamento, senha_criptografada").eq("empresa_id", empresaId).eq("status", "ATIVO").order("atualizado_em", { ascending: false }).limit(1).maybeSingle() as unknown as { data: Linha | null; error: { message: string } | null };
    if (error || !data) throw new Error("Certificado A1 ativo não encontrado.");
    return { caminhoArmazenamento: texto(data.caminho_armazenamento), senhaCriptografada: texto(data.senha_criptografada) };
  }

  /** Registra o metadado do A1. O arquivo e sua senha nunca são gravados em campos públicos. */
  public async registrarCertificado(empresaId: string, certificado: { nomeArquivo: string; caminhoArmazenamento: string; tamanhoBytes: number; hashSha256: string; senhaCriptografada: string; titular: string; cnpjTitular: string; emissor: string; validoDe: string; validoAte: string }): Promise<{ id: string; nomeArquivo: string; status: string }> {
    const agora = new Date().toISOString();
    const { data: existente, error: erroConsulta } = await this.banco.from("fiscal_certificados").select("id, empresa_id").eq("caminho_armazenamento", certificado.caminhoArmazenamento).maybeSingle() as unknown as { data: Linha | null; error: { message: string } | null };
    if (erroConsulta) throw new Error("Não foi possível consultar o certificado fiscal.");
    if (existente && existente.empresa_id !== empresaId) throw new Error("O caminho do certificado já pertence a outra empresa.");
    const id = existente ? String(existente.id) : crypto.randomUUID();
    const dados = {
      nome_original: certificado.nomeArquivo, mime_type: "application/x-pkcs12", tamanho_bytes: certificado.tamanhoBytes, caminho_armazenamento: certificado.caminhoArmazenamento,
      hash_sha256: certificado.hashSha256, senha_criptografada: certificado.senhaCriptografada, titular: certificado.titular, cnpj_titular: certificado.cnpjTitular,
      emissor: certificado.emissor, valido_de: certificado.validoDe, valido_ate: certificado.validoAte, status: "ATIVO", atualizado_em: agora
    };
    const { error } = existente
      ? await this.banco.from("fiscal_certificados").update(dados).eq("id", id)
      : await this.banco.from("fiscal_certificados").insert({ id, empresa_id: empresaId, criado_em: agora, ...dados });
    if (error) {
      console.error("Falha ao registrar certificado fiscal:", error);
      throw new Error("Não foi possível registrar o certificado fiscal.");
    }
    const { error: erroDesativacao } = await this.banco.from("fiscal_certificados").update({ status: "INATIVO", atualizado_em: agora }).eq("empresa_id", empresaId).eq("status", "ATIVO").neq("id", id);
    if (erroDesativacao) throw new Error("O certificado foi registrado, mas não foi possível inativar o anterior.");
    return { id, nomeArquivo: certificado.nomeArquivo, status: "ATIVO" };
  }

  /** Lista o catálogo ativo da empresa; a revisão fiscal é exibida para não ocultar pendências. */
  public async listarProdutos(empresaId: string, busca?: string): Promise<ProdutoFiscal[]> {
    // Leitura direta no Postgres (pool já aberto, 1 ida ao banco) em vez da API REST; to_jsonb mantém o formato da REST.
    const sql = sqlDireto();
    const linhas = await sql<{ j: Linha }[]>`select to_jsonb(p) j from fiscal_produtos p where empresa_id = ${empresaId} and ativo
      ${busca ? sql`and descricao ilike ${`%${busca}%`}` : sql``} order by descricao limit 500`;
    return linhas.map((l) => this.mapearProduto(l.j));
  }

  public async criarDocumento(entrada: DocumentoFiscalEntrada, totais: TotaisDocumentoFiscal): Promise<DocumentoFiscal> {
    const agora = new Date().toISOString();
    const empresa = await this.obterEmpresa(entrada.empresaId);
    const { data, error } = await this.banco.from("fiscal_documentos").insert({
      id: crypto.randomUUID(), empresa_id: entrada.empresaId, ambiente: entrada.ambiente, modelo: "55", serie: entrada.serie,
      status: "RASCUNHO", natureza_operacao: entrada.naturezaOperacao, destino_operacao: entrada.destinoOperacao,
      consumidor_final: entrada.consumidorFinal, indicador_presenca: entrada.indicadorPresenca, totais,
      snapshot_emitente: empresa, snapshot_destinatario: entrada.destinatario, transporte: entrada.transporte ?? {}, pagamento: entrada.pagamento ?? {},
      informacoes_adicionais: entrada.informacoesAdicionais ?? null, criado_em: agora, atualizado_em: agora
    }).select().single() as unknown as { data: unknown; error: { message: string } | null };
    if (error || !data) throw new Error("Não foi possível criar o rascunho fiscal.");
    const documento = data as Linha;
    const itens = entrada.itens.map((item, indice) => this.mapearItem(String(documento.id), item, indice + 1, agora));
    const { error: erroItens } = await this.banco.from("fiscal_itens_documento").insert(itens);
    if (erroItens) {
      await this.banco.from("fiscal_documentos").delete().eq("id", String(documento.id));
      throw new Error("Não foi possível adicionar os itens do documento.");
    }
    return this.mapearDocumento(documento, entrada.itens);
  }

  public async obterDocumento(documentoId: string): Promise<DocumentoFiscal> {
    const { data, error } = await this.banco.from("fiscal_documentos").select("*, fiscal_itens_documento(*)").eq("id", documentoId).maybeSingle() as unknown as { data: unknown; error: { message: string } | null };
    if (error || !data) throw new Error("Documento fiscal não encontrado.");
    const linha = data as Linha;
    return this.mapearDocumento(linha, (linha.fiscal_itens_documento as Linha[] ?? []).map(this.mapearItemParaDominio));
  }

  public async listarDocumentos(empresaId: string, pagina: number, tamanhoPagina: number): Promise<{ documentos: DocumentoFiscal[]; total: number }> {
    const linhas = await sqlDireto()<{ j: Linha; total: number }[]>`
      select to_jsonb(d) || jsonb_build_object('fiscal_itens_documento',
        coalesce((select jsonb_agg(to_jsonb(i) order by i.numero_item) from fiscal_itens_documento i where i.documento_id = d.id), '[]'::jsonb)) j,
        count(*) over ()::int total
      from fiscal_documentos d where d.empresa_id = ${empresaId}
      order by d.criado_em desc limit ${tamanhoPagina} offset ${(pagina - 1) * tamanhoPagina}`;
    return { documentos: linhas.map((l) => this.mapearDocumento(l.j, (l.j.fiscal_itens_documento as Linha[]).map(this.mapearItemParaDominio))), total: linhas[0]?.total ?? 0 };
  }

  public async alterarStatus(documentoId: string, status: StatusDocumentoFiscal, dados: Partial<{ numero: number; chaveAcesso: string; mensagemSefaz: string; codigoStatusSefaz: string }>, esperado: StatusDocumentoFiscal, atualizadoEm?: string): Promise<void> {
    if (!podeTransicionarDocumento(esperado, status)) throw new ConflitoFiscal("Transição fiscal não permitida.");
    let consulta = this.banco.from("fiscal_documentos").update({ status, numero: dados.numero, chave_acesso: dados.chaveAcesso, mensagem_sefaz: dados.mensagemSefaz, codigo_status_sefaz: dados.codigoStatusSefaz, atualizado_em: new Date().toISOString() }).eq("id", documentoId).eq("status", esperado);
    if (atualizadoEm) consulta = consulta.eq("atualizado_em", atualizadoEm);
    const { data, error } = await consulta.select("id").maybeSingle();
    if (error) throw new Error("Não foi possível atualizar o status fiscal.");
    if (!data) throw new ConflitoFiscal("Documento alterado ou já em processamento. Atualize a tela; não retransmita uma nota com retorno incerto.");
  }

  public async reservarNumero(documento: DocumentoFiscal): Promise<number> {
    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      const { data, error } = await this.banco.from("fiscal_documentos").select("numero").eq("empresa_id", documento.empresaId).eq("ambiente", documento.ambiente).eq("modelo", "55").eq("serie", documento.serie).not("numero", "is", null).order("numero", { ascending: false }).limit(1);
      if (error) throw new Error("Não foi possível consultar a numeração fiscal.");
      const numero = Number((data?.[0] as Linha | undefined)?.numero ?? 0) + 1;
      const { data: reserva, error: erroReserva } = await this.banco.from("fiscal_documentos").update({ numero, atualizado_em: new Date().toISOString() }).eq("id", documento.id).is("numero", null).select("numero").maybeSingle() as unknown as { data: Linha | null; error: { code?: string } | null };
      if (!erroReserva && reserva) return numero;
      if (!erroReserva) {
        const atual = await this.obterDocumento(documento.id);
        if (atual.numero !== null) return atual.numero;
        continue;
      }
      if (erroReserva.code !== "23505") throw new Error("Não foi possível reservar a numeração fiscal.");
    }
    throw new Error("Conflito de numeração fiscal; tente novamente.");
  }

  public async registrarArquivo(empresaId: string, documentoId: string, tipo: "XML_GERADO" | "XML_ASSINADO" | "XML_AUTORIZADO" | "DANFE", arquivo: { caminho: string; nome: string; mimeType: string; tamanhoBytes: number; hashSha256: string }): Promise<void> {
    const { error } = await this.banco.from("fiscal_arquivos").insert({ id: crypto.randomUUID(), empresa_id: empresaId, documento_id: documentoId, tipo, caminho_armazenamento: arquivo.caminho, nome: arquivo.nome, mime_type: arquivo.mimeType, tamanho_bytes: arquivo.tamanhoBytes, hash_sha256: arquivo.hashSha256, criado_em: new Date().toISOString() });
    if (error) throw new Error("Não foi possível registrar o arquivo fiscal.");
  }

  public async obterArquivo(documentoId: string, tipo: TipoArquivoFiscal): Promise<ArquivoFiscal> {
    const { data, error } = await this.banco.from("fiscal_arquivos")
      .select("caminho_armazenamento, nome, mime_type")
      .eq("documento_id", documentoId)
      .eq("tipo", tipo)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle() as unknown as { data: Linha | null; error: { message: string } | null };
    if (error) throw new Error("Não foi possível consultar o arquivo fiscal.");
    if (!data) throw new Error(tipo === "DANFE" ? "PDF da NF-e não encontrado." : "XML autorizado da NF-e não encontrado.");
    return { caminho: texto(data.caminho_armazenamento), nome: texto(data.nome), mimeType: texto(data.mime_type) };
  }

  public async registrarEvento(documentoId: string, status: string, protocolo: string | null, descricao: string, dados: Record<string, unknown>): Promise<void> {
    const { error } = await this.banco.from("fiscal_eventos_documento").insert({ id: crypto.randomUUID(), documento_id: documentoId, tipo: "AUTORIZACAO", status, protocolo, descricao, dados, criado_em: new Date().toISOString() });
    if (error) throw new Error("Não foi possível registrar o retorno da SEFAZ.");
  }

  private mapearItem(documentoId: string, item: ItemDocumentoFiscal, numeroItem: number, agora: string): Record<string, unknown> {
    return { id: crypto.randomUUID(), documento_id: documentoId, produto_id: item.produtoId ?? null, numero_item: numeroItem, descricao: item.descricao, ncm: item.ncm, cfop: item.cfop, unidade: item.unidade, quantidade: item.quantidade, valor_unitario: item.valorUnitario, desconto: item.desconto ?? 0, frete: item.frete ?? 0, seguro: item.seguro ?? 0, outras_despesas: item.outrasDespesas ?? 0, origem: item.origem, cst: item.cst ?? null, csosn: item.csosn ?? null, gtin: item.gtin ?? null, cest: item.cest ?? null, sku: item.sku ?? null, icms: item.icms ?? {}, ipi: item.ipi ?? {}, pis: item.pis ?? {}, cofins: item.cofins ?? {}, ibs: item.ibs ?? {}, cbs: item.cbs ?? {}, snapshot_fiscal: item, criado_em: agora, atualizado_em: agora };
  }

  private mapearItemParaDominio = (linha: Linha): ItemDocumentoFiscal => ({ ...(linha.snapshot_fiscal as ItemDocumentoFiscal ?? {}), produtoId: typeof linha.produto_id === "string" ? linha.produto_id : undefined, descricao: texto(linha.descricao), ncm: texto(linha.ncm), cfop: texto(linha.cfop), unidade: texto(linha.unidade), quantidade: Number(linha.quantidade), valorUnitario: Number(linha.valor_unitario), desconto: Number(linha.desconto), frete: Number(linha.frete), seguro: Number(linha.seguro), outrasDespesas: Number(linha.outras_despesas), origem: texto(linha.origem), cst: typeof linha.cst === "string" ? linha.cst : undefined, csosn: typeof linha.csosn === "string" ? linha.csosn : undefined, gtin: typeof linha.gtin === "string" ? linha.gtin : undefined, cest: typeof linha.cest === "string" ? linha.cest : undefined, sku: typeof linha.sku === "string" ? linha.sku : undefined, icms: linha.icms as Record<string, unknown>, ipi: linha.ipi as Record<string, unknown>, pis: linha.pis as Record<string, unknown>, cofins: linha.cofins as Record<string, unknown>, ibs: linha.ibs as Record<string, unknown>, cbs: linha.cbs as Record<string, unknown> });

  private mapearDocumento(linha: Linha, itens: ItemDocumentoFiscal[]): DocumentoFiscal {
    return { id: texto(linha.id), empresaId: texto(linha.empresa_id), ambiente: linha.ambiente as DocumentoFiscal["ambiente"], serie: Number(linha.serie), numero: linha.numero === null ? null : Number(linha.numero), chaveAcesso: typeof linha.chave_acesso === "string" ? linha.chave_acesso : null, codigoStatusSefaz: typeof linha.codigo_status_sefaz === "string" ? linha.codigo_status_sefaz : undefined, mensagemSefaz: typeof linha.mensagem_sefaz === "string" ? linha.mensagem_sefaz : undefined, status: linha.status as StatusDocumentoFiscal, naturezaOperacao: texto(linha.natureza_operacao), destinoOperacao: linha.destino_operacao as DocumentoFiscal["destinoOperacao"], consumidorFinal: linha.consumidor_final as DocumentoFiscal["consumidorFinal"], indicadorPresenca: linha.indicador_presenca as DocumentoFiscal["indicadorPresenca"], destinatario: linha.snapshot_destinatario as Record<string, unknown>, itens, transporte: linha.transporte as Record<string, unknown>, pagamento: linha.pagamento as Record<string, unknown>, informacoesAdicionais: typeof linha.informacoes_adicionais === "string" ? linha.informacoes_adicionais : undefined, totais: linha.totais as TotaisDocumentoFiscal, criadoEm: texto(linha.criado_em), atualizadoEm: texto(linha.atualizado_em) };
  }

  private mapearProduto(linha: Linha): ProdutoFiscal {
    return {
      id: texto(linha.id), codigo: texto(linha.codigo), descricao: texto(linha.descricao),
      grupo: typeof linha.grupo === "string" ? linha.grupo : undefined, unidade: texto(linha.unidade), ncm: texto(linha.ncm),
      cfop: texto(linha.cfop_padrao), origem: texto(linha.origem), cstIcms: typeof linha.cst_icms === "string" ? linha.cst_icms : undefined,
      aliquotaIcms: numeroOpcional(linha.aliquota_icms), cstPis: typeof linha.cst_pis === "string" ? linha.cst_pis : undefined,
      aliquotaPis: numeroOpcional(linha.aliquota_pis), cstCofins: typeof linha.cst_cofins === "string" ? linha.cst_cofins : undefined,
      aliquotaCofins: numeroOpcional(linha.aliquota_cofins), cest: typeof linha.cest === "string" ? linha.cest : undefined,
      cBenef: linha.cst_icms === "90" && typeof linha.observacao_fiscal === "string" && linha.observacao_fiscal.includes("51.597/2007") ? "SP040100" : undefined,
      precoVenda: numeroOpcional(linha.preco_venda), revisaoFiscalPendente: linha.revisao_fiscal_pendente === true
    };
  }
}

function texto(valor: unknown): string { return typeof valor === "string" || typeof valor === "number" ? String(valor) : ""; }
function numeroOpcional(valor: unknown): number | undefined { return typeof valor === "number" || typeof valor === "string" ? Number(valor) : undefined; }
