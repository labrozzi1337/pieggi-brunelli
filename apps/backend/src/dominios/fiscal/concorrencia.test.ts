import { afterEach, expect, it, vi } from "vitest";
import type { ServerSupabaseClient } from "@/integrations/supabase/server";
import { ProvedorArmazenamentoFiscalLocal } from "./armazenamento";
import { ClienteServicoFiscal } from "./cliente-servico-fiscal";
import { cifrarSegredoFiscal } from "./criptografia";
import { ConflitoFiscal } from "./estado";
import { RepositorioFiscal } from "./repositorio";
import { ServicoDocumentosFiscais } from "./servico";
import type { DocumentoFiscal } from "./tipos";

afterEach(() => vi.restoreAllMocks());

it("disputa atomicamente a transmissão, preserva retorno incerto e nunca reseta emissão por gerar XML", async () => {
  const documento: DocumentoFiscal = { id: "nota-teste", empresaId: "empresa-teste", ambiente: "HOMOLOGACAO", serie: 1, numero: 1, chaveAcesso: null, status: "PRONTO", naturezaOperacao: "VENDA", destinoOperacao: "1", consumidorFinal: "1", indicadorPresenca: "1", destinatario: {}, itens: [], totais: { produtos: 1, desconto: 0, frete: 0, seguro: 0, outrasDespesas: 0, notaFiscal: 1 }, criadoEm: "2026-10-06T00:00:00Z", atualizadoEm: "2026-10-06T00:00:00Z" };
  // Executa o repositório real com um banco em memória: cada UPDATE é indivisível.
  const banco = { from: () => ({ update: (dados: { status: DocumentoFiscal["status"]; atualizado_em: string }) => {
    const filtros: Record<string, string> = {};
    const consulta = { eq: (campo: string, valor: string) => { filtros[campo] = valor; return consulta; }, select: () => consulta, maybeSingle: () => {
      const corresponde = filtros.id === documento.id && filtros.status === documento.status && (!filtros.atualizado_em || filtros.atualizado_em === documento.atualizadoEm);
      if (corresponde) { documento.status = dados.status; documento.atualizadoEm = dados.atualizado_em; }
      return Promise.resolve({ data: corresponde ? { id: documento.id } : null, error: null });
    } };
    return consulta;
  } }) } as unknown as ServerSupabaseClient;
  const chave = Buffer.alloc(32, 7).toString("base64");
  const servico = new ServicoDocumentosFiscais({ banco, diretorioArmazenamento: "nao-usado", urlServicoFiscal: "https://example.invalid", tokenServicoFiscal: "teste", permitirProducao: false, chaveCifragemFiscal: chave });
  vi.spyOn(RepositorioFiscal.prototype, "obterDocumento").mockImplementation(() => Promise.resolve({ ...documento }));
  vi.spyOn(RepositorioFiscal.prototype, "obterEmpresa").mockResolvedValue({});
  vi.spyOn(RepositorioFiscal.prototype, "possuiCertificadoAtivo").mockResolvedValue(true);
  vi.spyOn(RepositorioFiscal.prototype, "obterCertificadoAtivo").mockResolvedValue({ caminhoArmazenamento: "teste.pfx", senhaCriptografada: cifrarSegredoFiscal("teste", chave) });
  vi.spyOn(ProvedorArmazenamentoFiscalLocal.prototype, "ler").mockResolvedValue(new Uint8Array([1]));
  vi.spyOn(ProvedorArmazenamentoFiscalLocal.prototype, "gravar").mockResolvedValue({ caminho: "teste.xml", nome: "teste.xml", mimeType: "application/xml", tamanhoBytes: 1, hashSha256: "teste" });
  vi.spyOn(RepositorioFiscal.prototype, "registrarArquivo").mockResolvedValue();
  vi.spyOn(RepositorioFiscal.prototype, "registrarEvento").mockResolvedValue();
  const transmitir = vi.spyOn(ClienteServicoFiscal.prototype, "transmitir").mockResolvedValue({ autorizado: false, codigoStatusSefaz: "999", mensagemSefaz: "Retorno controlado do teste", chaveAcesso: "teste", xmlAssinado: "<teste/>" });

  const concorrentes = await Promise.allSettled([servico.emitir(documento.id), servico.emitir(documento.id)]);
  expect(concorrentes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(concorrentes.filter((r) => r.status === "rejected")).toHaveLength(1);
  for (const r of concorrentes) if (r.status === "rejected") expect(r.reason instanceof ConflitoFiscal).toBe(true);
  expect(transmitir).toHaveBeenCalledTimes(1);
  expect(documento.status).toBe("REJEITADO");

  documento.status = "PRONTO";
  transmitir.mockRejectedValueOnce(new Error("Timeout: retorno desconhecido"));
  await expect(servico.emitir(documento.id)).rejects.toThrow("retorno desconhecido");
  expect(documento.status).toBe("PROCESSANDO");
  await expect(servico.emitir(documento.id)).rejects.toThrow("pronto para emissão");
  expect(transmitir).toHaveBeenCalledTimes(2);

  documento.status = "PRONTO";
  vi.spyOn(ClienteServicoFiscal.prototype, "gerar").mockImplementation(() => {
    documento.status = "ENVIANDO"; // Outra requisição assumiu a emissão enquanto o XML era gerado.
    return Promise.resolve({ xml: "<teste/>", avisos: [] });
  });
  await servico.gerarXml(documento.id);
  expect(documento.status).toBe("ENVIANDO");

  documento.status = "RASCUNHO";
  vi.spyOn(ClienteServicoFiscal.prototype, "validar").mockRejectedValue(new Error("Motor indisponível"));
  await expect(servico.validar(documento.id)).rejects.toThrow("Motor indisponível");
  expect(documento.status).toBe("ERRO");
});
