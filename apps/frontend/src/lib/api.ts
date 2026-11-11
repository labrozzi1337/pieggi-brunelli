// Vazio = mesma origem (proxy do Vite em dev, nginx em produção). Só defina para apontar a outro backend.
const API_URL = import.meta.env.VITE_PIEGGI_API_URL?.replace(/\/$/, "") ?? "";

/** fetch com mensagem clara quando o backend está fora do ar (o navegador só diz "Failed to fetch"). */
async function requisitar(url: string, init?: RequestInit): Promise<Response> {
  try { return await fetch(url, init); }
  catch (erro) {
    if (erro instanceof DOMException && erro.name === "AbortError") throw erro;
    throw new Error("Sem conexão com o servidor da Pieggi. Verifique se o backend está rodando e tente de novo.", { cause: erro });
  }
}

export interface ProdutoFiscal {
  id: string; codigo: string; descricao: string; grupo?: string; unidade: string; ncm: string; cfop: string; origem: string;
  cstIcms?: string; aliquotaIcms?: number; cstPis?: string; aliquotaPis?: number; cstCofins?: string; aliquotaCofins?: number;
  cest?: string; cBenef?: string; precoVenda?: number; revisaoFiscalPendente: boolean;
}

export interface DocumentoFiscal {
  id: string; numero: number | null; chaveAcesso: string | null; codigoStatusSefaz?: string; mensagemSefaz?: string;
  status: string; ambiente: string; destinatario: Record<string, unknown>; totais: { notaFiscal: number }; criadoEm: string;
}

export interface UsuarioSessao {
  id: string; email: string; nome: string; papeis: string[]; empresas: string[];
}

export interface Evento {
  artefatos?: {versao:number|null;programacao:string;comanda:string;plaquinhas:string;compras:string;campo:string};
  empresaId: string;
  id: string; titulo: string; origemLead?: string | null; clienteId: string; clienteTipo: "PF" | "PJ";
  clienteNome: string; clienteDocumento?: string | null; clienteEmail?: string | null; clienteTelefone?: string | null;
  etapaComercial: string; etapaOperacao: string; etapaFinanceiro: string;
  tabelaPreco?: string | null; pax?: number | null; dataEvento?: string | null;
  horarioInicio?: string | null; horarioFim?: string | null; logradouro?: string | null; numeroEndereco?: string | null;
  complemento?: string | null; bairro?: string | null; cidade?: string | null; uf?: string | null; cep?: string | null; endereco?: string;
  contatoLocalNome?: string | null; contatoLocalTelefone?: string | null;
  contratoAssinadoEm?: string | null; observacoes?: string | null; criadoEm: string; atualizadoEm?: string; revisao?: number;
}

async function renovarSessao(): Promise<boolean> {
  const response = await requisitar(`${API_URL}/api/v1/auth/refresh`, { method: "POST", credentials: "include" });
  return response.ok;
}

// Leituras (GET) ficam em memória até haver mudança: gravação feita aqui ou aviso do servidor (lib/aovivo).
// Assim, voltar a uma tela é instantâneo e duas telas pedindo o mesmo dado fazem uma só requisição.
const CACHE_MAX_MS = 5 * 60_000;
const SEM_CACHE = ["/api/v1/auth/", "/api/v1/mudancas", "/api/v1/campo"];
const cache = new Map<string, { em: number; dado: Promise<unknown> }>();
export function limparCache() { cache.clear(); }

export function api<T>(caminho: string, init?: RequestInit, renovar = true): Promise<T> {
  const leitura = (init?.method ?? "GET").toUpperCase() === "GET" && !SEM_CACHE.some((p) => caminho.startsWith(p));
  if (!leitura) {
    // Gravação: o que estava em memória pode ter mudado.
    return chamar<T>(caminho, init, renovar).finally(limparCache);
  }
  // A requisição compartilhada não leva o sinal de quem pediu: cancelar uma tela não derruba a outra.
  const { signal, ...semSinal } = init ?? {};
  const salvo = cache.get(caminho);
  let dado = salvo && Date.now() - salvo.em < CACHE_MAX_MS ? salvo.dado as Promise<T> : undefined;
  if (!dado) {
    const nova = chamar<T>(caminho, semSinal, renovar);
    cache.set(caminho, { em: Date.now(), dado: nova });
    nova.catch(() => { if (cache.get(caminho)?.dado === nova) cache.delete(caminho); });
    dado = nova;
  }
  if (!signal) return dado;
  const compartilhado = dado;
  return new Promise<T>((resolver, rejeitar) => {
    const cancelar = () => rejeitar(new DOMException("Requisição cancelada.", "AbortError"));
    if (signal.aborted) return cancelar();
    signal.addEventListener("abort", cancelar, { once: true });
    compartilhado.then(resolver, rejeitar);
  });
}

async function chamar<T>(caminho: string, init: RequestInit | undefined, renovar: boolean): Promise<T> {
  let response = await requisitar(`${API_URL}${caminho}`, { ...init, credentials: "include" });
  if (response.status === 401 && renovar && await renovarSessao()) response = await requisitar(`${API_URL}${caminho}`, { ...init, credentials: "include" });
  const body = await response.json().catch(() => ({ error: { message: response.status >= 500 ? "Servidor indisponível no momento. Tente de novo em instantes." : `Resposta inválida do servidor (${response.status}).` } })) as { data?: T; error?: { message?: string } };
  if (!response.ok || body.data === undefined) throw new Error(body.error?.message ?? "Não foi possível concluir a operação.");
  return body.data;
}

export function entrar(email: string, senha: string): Promise<UsuarioSessao> {
  return api("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, senha }) }, false);
}

export function obterSessao(): Promise<UsuarioSessao> {
  return api("/api/v1/auth/session");
}

export function sair(): Promise<{ encerrada: boolean }> {
  limparCache();
  return api("/api/v1/auth/logout", { method: "POST" }, false);
}

export function listarProdutos(empresaId: string): Promise<ProdutoFiscal[]> {
  return api(`/api/v1/fiscal/produtos?empresaId=${encodeURIComponent(empresaId)}`);
}

export function listarDocumentos(empresaId: string, pagina = 1): Promise<{ documentos: DocumentoFiscal[]; total: number }> {
  return api(`/api/v1/fiscal/documentos?empresaId=${encodeURIComponent(empresaId)}&pagina=${pagina}&tamanhoPagina=50`);
}

export function criarDocumento(entrada: unknown): Promise<DocumentoFiscal> {
  return api("/api/v1/fiscal/documentos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entrada) });
}

export function listarEventos(empresaId: string, historico = false): Promise<Evento[]> {
  return api(`/api/v1/eventos?empresaId=${encodeURIComponent(empresaId)}${historico ? "&historico=1" : ""}`);
}

export function criarEvento(entrada: unknown): Promise<Evento> {
  return api("/api/v1/eventos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entrada) });
}

export function atualizarEvento(id: string, entrada: unknown): Promise<Evento> {
  return api(`/api/v1/eventos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entrada) });
}

export function validarDocumento(id: string): Promise<{ resultados: Array<{ nivel: string; campo: string; mensagem: string }> }> {
  return api(`/api/v1/fiscal/documentos/${id}/validar`, { method: "POST" });
}

export function emitirDocumento(id: string): Promise<DocumentoFiscal> {
  return api(`/api/v1/fiscal/documentos/${id}/emitir`, { method: "POST" });
}

export async function baixarArquivoFiscal(id: string, tipo: "xml" | "pdf"): Promise<void> {
  return baixarArquivo(`/api/v1/fiscal/documentos/${id}/arquivos/${tipo}`, `nfe.${tipo}`);
}

export async function baixarArquivo(caminho: string, nomePadrao: string): Promise<void> {
  let response = await requisitar(`${API_URL}${caminho}`, { credentials: "include" });
  if (response.status === 401 && await renovarSessao()) response = await requisitar(`${API_URL}${caminho}`, { credentials: "include" });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? "Não foi possível baixar o arquivo.");
  }
  const blob = await response.blob();
  const disposicao = response.headers.get("content-disposition") ?? "";
  const utf8 = disposicao.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const nome = (utf8 ? decodeURIComponent(utf8) : disposicao.match(/filename="([^"]+)"/)?.[1]) ?? nomePadrao;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}
