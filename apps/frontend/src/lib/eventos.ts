// Fluxo guiado do evento: tipos da API do motor, chamadas e ajudantes puros (testados em eventos.test.ts).
import { api } from "./api";

export const LINHAS = ["COFFEE_BREAK", "WELCOME", "AUDITORIO", "ALMOCO", "JANTAR", "COQUETEL", "BRUNCH", "LUNCH_BOX"] as const;
export type Linha = (typeof LINHAS)[number];
export type Periodo = "MANHA" | "ALMOCO" | "TARDE" | "NOITE" | "DIA";
export const PERIODOS: Array<[Periodo, string]> = [["MANHA", "Manhã"], ["ALMOCO", "Almoço"], ["TARDE", "Tarde"], ["NOITE", "Noite"], ["DIA", "Dia todo"]];
export const NOMES_LINHA: Record<Linha, string> = {
  COFFEE_BREAK: "Coffee Break", WELCOME: "Welcome Coffee", AUDITORIO: "Auditório", ALMOCO: "Almoço", JANTAR: "Jantar",
  COQUETEL: "Coquetel / HH", BRUNCH: "Brunch", LUNCH_BOX: "Lunch Box"
};
export const RESTRICOES = [["VEGANO", "Vegano"], ["VEGETARIANO", "Vegetariano"], ["SEM_GLUTEN", "Sem glúten"], ["SEM_LACTOSE", "Sem lactose"], ["SEM_ACUCAR", "Sem açúcar"]] as const;
export type TipoRestricao = (typeof RESTRICOES)[number][0];

export interface AlmocoForm { proteinas: string; acompanhamentos: string; massa: string; vegetariano: string; sobremesas: string }
export interface ServicoForm {
  uid: string; data: string; linha: Linha; tier: string; periodo: Periodo; horarioInicio: string; horarioFim: string; pax: number;
  descritivo: string; bebidas?: string[]; trocas: Record<string, string>; cortesia?: boolean; almoco?: AlmocoForm;
}
export interface Trava { codigo: string; mensagem: string; autoriza: string }
export interface ItemSugerido { receita: string; item: string; quantidade: number; unidade: string; quantidadeTexto: string | null; cardapioItemId: string | null; bebida: boolean; selo: string | null; restricao: boolean }
export interface ServicoSugerido { id: string; nome: string; comReposicao: boolean; bebidas: string[]; itens: ItemSugerido[]; alternativas: Record<string, Array<{ id: string; nome: string; tier: string }>> }
export interface Sugestao {
  cabecalho: { endereco: string; contato: string; clienteChave: string | null; tabela: string; enderecoFixo: boolean };
  servicos: ServicoSugerido[];
  orcamento: { linhas: Array<{ descritivo: string; pax: number | null; porPessoaCentavos: number | null; valorCentavos: number | null }>; totalCentavos: number; alimentacaoCentavos: number; cmv: number | null; custoEstimado: number | null } | null;
  avisos: string[]; bloqueios: Trava[]; regrasFaltando: string[]; regrasPendentes: Array<{ codigo: string; titulo: string }>;
  opcoes: { travado: boolean; bebidas: string[]; tabela: string; linhas: Array<{ linha: Linha; nome: string; tiers: string[] }> };
}
export interface Restricoes { itens: Array<{ tipo: TipoRestricao; quantidade: number }>; cobranca: "PAGO" | "CORTESIA" }
export interface ClienteResumo { id: string; tipo: string; nome: string; documento: string | null; email: string | null; telefone: string | null; chaveRegras: string | null }
export interface FixosCliente { chave: string | null; endereco?: string; contato?: string; tabela?: string }
export interface Clientes { clientes: ClienteResumo[]; fixos: FixosCliente[]; padrao: FixosCliente; tabelas: string[] }
export type TipoDocumento = "proposta" | "programacao" | "comanda" | "plaquinha";

// ---------------------------------------------------------------- API

const json = (corpo: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
export const listarClientes = (empresaId: string) => api<Clientes>(`/api/v1/clientes?empresaId=${encodeURIComponent(empresaId)}`);
export const sugerir = (eventoId: string, servicos: ServicoForm[], restricoes: Restricoes) =>
  api<Sugestao>(`/api/v1/eventos/${eventoId}/sugestao`, json({ servicos: paraApi(servicos), restricoes: restricoesApi(restricoes) }));
export const simular = (corpo: { data: string; tabela: string; cliente?: string; regioes: string[] }, servicos: ServicoForm[]) =>
  api<Sugestao>("/api/v1/calculos", json({ ...corpo, servicos: paraApi(servicos) }));
export const gerarProposta = (eventoId: string, revisao: number, servicos: ServicoForm[], restricoes: Restricoes) =>
  api<{ propostaId: string; totalCentavos: number; avisos: string[] }>(`/api/v1/eventos/${eventoId}/proposta`,
    json({ revisao, chave: crypto.randomUUID(), servicos: paraApi(servicos), restricoes: restricoesApi(restricoes), confirmado: true }));
export const gerarProgramacao = (eventoId: string, revisao: number) =>
  api<{ id: string; versao: number; avisos: string[] }>(`/api/v1/eventos/${eventoId}/programacao/gerar`, json({ revisao }));
export const urlDocumento = (eventoId: string, tipo: TipoDocumento) => `/api/v1/eventos/${eventoId}/documentos/${tipo}`;

// ---------------------------------------------------------------- Ajudantes puros

export const normalizar = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/** "StartSe Educação" → STARTSE (mesma regra do backend: palavra do nome igual à chave do cliente). */
export function chaveDoNome(nome: string, chaves: readonly string[]): string | null {
  const palavras = new Set(normalizar(nome).toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean));
  return chaves.find((c) => palavras.has(c)) ?? null;
}

const minutos = (h: string) => { const [a = 0, b = 0] = h.split(":").map(Number); return a * 60 + b; };
export const duracaoHoras = (inicio: string, fim: string) => Math.max(0, minutos(fim) - minutos(inicio)) / 60;

/** Período sugerido pela linha e pelo horário; o usuário troca no chip. */
export function periodoPadrao(linha: Linha, inicio: string): Periodo {
  if (linha === "AUDITORIO") return "DIA";
  if (linha === "ALMOCO" || linha === "LUNCH_BOX") return "ALMOCO";
  if (linha === "JANTAR" || linha === "COQUETEL") return "NOITE";
  return minutos(inicio) >= 12 * 60 ? "TARDE" : "MANHA";
}

/** Serviço novo herda data, horário e pax do evento — nada é digitado de novo. */
export function novoServico(evento: { data: string; inicio: string; fim: string; pax: number }, linha: Linha, tier: string): ServicoForm {
  return {
    uid: Math.random().toString(36).slice(2), data: evento.data, linha, tier, periodo: periodoPadrao(linha, evento.inicio),
    horarioInicio: evento.inicio, horarioFim: evento.fim, pax: evento.pax, descritivo: "", trocas: {},
    ...(linha === "ALMOCO" || linha === "JANTAR" ? { almoco: { proteinas: "", acompanhamentos: "Arroz branco, Feijão", massa: "", vegetariano: "", sobremesas: "" } } : {})
  };
}

const lista = (t: string) => t.split(/[,\n]/).map((x) => x.trim()).filter((x) => x.length >= 2);
const componente = (t: string) => (t.trim().length >= 2 ? { nome: t.trim() } : undefined);

/** Formato ServicoVendido do motor. */
export function paraApi(servicos: readonly ServicoForm[]) {
  return servicos.map((s, i) => ({
    id: `s${i + 1}`, data: s.data, linha: s.linha, tier: s.tier, periodo: s.periodo, horarioInicio: s.horarioInicio, horarioFim: s.horarioFim, pax: s.pax,
    ...(s.descritivo.trim() ? { descritivo: s.descritivo.trim() } : {}),
    ...(s.bebidas ? { bebidas: s.bebidas } : {}),
    ...(Object.keys(s.trocas).length ? { trocas: s.trocas } : {}),
    ...(s.cortesia ? { cortesia: true } : {}),
    ...(s.almoco ? { almoco: {
      proteinas: lista(s.almoco.proteinas).map((nome) => ({ nome })), acompanhamentos: lista(s.almoco.acompanhamentos).map((nome) => ({ nome })),
      massa: componente(s.almoco.massa), vegetariano: componente(s.almoco.vegetariano), folhas: { nome: "Mix de folhas" },
      sobremesas: lista(s.almoco.sobremesas).map((nome) => ({ nome, pudim: /pudim/i.test(nome) }))
    } } : {})
  }));
}

/** Serviços salvos na proposta → formulário (para revisar e gerar nova versão sem redigitar). */
export function doApi(servicos: ReadonlyArray<Record<string, unknown>>): ServicoForm[] {
  const nomes = (v: unknown) => (Array.isArray(v) ? v.map((x: { nome?: string }) => x.nome ?? "").filter(Boolean).join(", ") : "");
  return servicos.map((s) => {
    const a = s.almoco as Record<string, unknown> | undefined;
    return {
      uid: Math.random().toString(36).slice(2), data: String(s.data), linha: s.linha as Linha, tier: String(s.tier), periodo: s.periodo as Periodo,
      horarioInicio: String(s.horarioInicio), horarioFim: String(s.horarioFim), pax: Number(s.pax), descritivo: typeof s.descritivo === "string" ? s.descritivo : "",
      bebidas: s.bebidas as string[] | undefined, trocas: (s.trocas as Record<string, string> | undefined) ?? {}, cortesia: s.cortesia as boolean | undefined,
      almoco: a ? { proteinas: nomes(a.proteinas), acompanhamentos: nomes(a.acompanhamentos), massa: (a.massa as { nome?: string } | undefined)?.nome ?? "",
        vegetariano: (a.vegetariano as { nome?: string } | undefined)?.nome ?? "", sobremesas: nomes(a.sobremesas) } : undefined
    };
  });
}

export const restricoesApi = (r: Restricoes) => ({ itens: r.itens.filter((i) => i.quantidade > 0), ...(r.itens.some((i) => i.quantidade > 0) ? { cobranca: r.cobranca } : {}) });

/** Três dados críticos (§3) + o que o contrato exige. Endereço fixo do cliente dispensa o endereço. */
export function pendenciasCriticas(e: { pax?: number | null; dataEvento?: string | null; horarioInicio?: string | null; horarioFim?: string | null; logradouro?: string | null; numeroEndereco?: string | null; bairro?: string | null; cidade?: string | null; uf?: string | null; cep?: string | null; contatoLocalNome?: string | null }, enderecoFixo: boolean): string[] {
  const faltas: string[] = [];
  if (!e.pax) faltas.push("pax exato");
  if (!e.dataEvento) faltas.push("data");
  if (!e.horarioInicio || !e.horarioFim) faltas.push("horário de início e fim");
  else if (e.horarioFim <= e.horarioInicio) faltas.push("fim depois do início");
  if (!enderecoFixo && !(e.logradouro && e.numeroEndereco && e.bairro && e.cidade && e.uf && e.cep)) faltas.push("endereço completo");
  if (!e.contatoLocalNome) faltas.push("contato");
  return faltas;
}

/** O que impede gerar: bloqueios, regras faltando. Pendentes e avisos não impedem. */
export const impedimentos = (s: Pick<Sugestao, "bloqueios" | "regrasFaltando">) => [...s.bloqueios.map((b) => b.mensagem), ...s.regrasFaltando.map((r) => `Regra não cadastrada: ${r}`)];

export const reais = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const quantidadeTexto = (i: Pick<ItemSugerido, "quantidade" | "unidade" | "quantidadeTexto">) =>
  i.quantidadeTexto ?? `${i.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${i.unidade === "UN" ? "un" : i.unidade.toLowerCase()}`;
