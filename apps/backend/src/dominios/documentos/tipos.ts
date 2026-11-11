// Contrato entre o motor (que CALCULA o conteúdo) e os geradores (que só DESENHAM os arquivos).
// Motor: dominios/regras/* produz estas estruturas. Geradores: dominios/documentos/* as transformam em
// .docx / .pdf / .pptx sem decidir nada de negócio. Datas sempre ISO (AAAA-MM-DD); dinheiro em centavos.
import type { LinhaServico } from "@/dominios/regras/motor";

export type Selo = "VEGANO" | "VEGETARIANO";
export type SeloExtra = "SEM_GLUTEN" | "SEM_LACTOSE" | "SEM_ACUCAR";
export type Periodo = "MANHA" | "ALMOCO" | "TARDE" | "NOITE" | "DIA";
export type Estacao = "COZINHA_QUENTE" | "COZINHA_FRIA" | "CONFEITARIA" | "EXPEDICAO_ALIMENTACAO" | "EXPEDICAO_BEBIDAS";
export type Fornecedor = "PAD_LETICIA" | "SALGADERIA_LEAL" | "PADARIA_CPL" | "POP_VEGAN" | "MERCADO";
export type Unidade = "UN" | "KG" | "G" | "L" | "ML" | "GARRAFA" | "TRAVESSA" | "PACOTE";

/** Item do cardápio como o motor o enxerga (vem de pieggi.cardapio_itens + cadastros). */
export interface ItemCatalogo {
  id: string; nome: string; grupo: string; categoria: string; tier: string;
  ingredientes: string; unidade: string; nomeEn: string | null; nomeEs: string | null;
  selo: Selo | null; estacao: string | null; fornecedor: string | null; ativo: boolean; custo?: number | null;
}

/** Dados do evento que aparecem no topo de todos os documentos. */
export interface CabecalhoEvento {
  eventoId: string;
  contratante: string;           // razão/nome de quem contrata (vai no nome do arquivo)
  cliente: string;               // nome do cliente
  clienteChave: string | null;   // STARTSE, INTELI, WTC, IPT… (regras próprias)
  evento: string;                // nome do evento
  contato: string;
  telefoneContato: string | null;
  pax: number;
  datas: string[];               // um ou mais dias, ISO
  horarioInicio: string;         // HH:MM
  horarioFim: string;            // HH:MM
  endereco: string;              // completo, numa linha
  restricoes: string[];          // ex.: "2 veganos", "1 sem glúten"
}

// ------------------------------------------------------------------ Programação (.docx)

export interface ItemProgramacao {
  quantidade: number;
  unidade: Unidade;
  /** Texto pronto da coluna QUANTIDADE quando não é só número+unidade (ex.: "1 travessa · 42 pax × 60 g = 2,52 kg"). */
  quantidadeTexto?: string;
  /** Coluna RECEITA: nome oficial + sabor + recipiente (ex.: "Carolina na forminha pétala de acrílico — recheio de doce de leite"). */
  receita: string;
  /** Coluna ITEM: categoria curta (ex.: "Mini lanche", "Cup cake", "Suco"). */
  item: string;
  cardapioItemId?: string | null;
  sabor?: string | null;
  selo?: Selo | null;
  selosExtras?: SeloExtra[];
  nomeEn?: string | null;
  nomeEs?: string | null;
  estacao?: Estacao | null;
  fornecedor?: Fornecedor | null;
  compradoPronto?: boolean;      // vai para "Itens Comprados Prontos" na expedição
  quente?: boolean;              // item quente de almoço/jantar (amostra da Vigilância, réchaud)
  bebida?: boolean;
  /** Linha de restrição inline (vegano, sem glúten…) — nunca bloco solto no fim. */
  restricao?: boolean;
  /** Item idêntico entre serviços (café, leite, pão de queijo…) — base do dedup da plaquinha. */
  chaveDedup?: string;
  observacao?: string | null;
}

export interface ServicoProgramacao {
  id: string;
  data: string;
  linha: LinhaServico;
  tier: string;
  nome: string;                  // ex.: "Coffee Break da manhã", "Auditório", "Almoço"
  periodo: Periodo;
  horarioInicio: string;
  horarioFim: string;
  pax: number;
  comReposicao: boolean;
  itens: ItemProgramacao[];
}

export interface Programacao {
  cabecalho: CabecalhoEvento;
  servicos: ServicoProgramacao[];
  avisos: string[];
}

// ------------------------------------------------------------------ Comanda (.docx, 6 páginas por dia)

export interface LinhaComanda {
  quantidade: string;            // texto pronto, só peso pronto (nunca peso cru)
  item: string;
  detalhe?: string;              // preparo, recheio, "dividir o peso entre as formas"…
  materiais?: string[];          // sublinhas ticáveis logo abaixo do item
  alerta?: string;               // tarja vermelha dentro do item
  finalizarConformeImagem?: boolean; // só tartelete e verrine
}

export interface BlocoComanda {
  titulo: string;                // nome do serviço ou da seção ("Itens Comprados Prontos", "APOIO E IDENTIFICAÇÃO"…)
  destaque?: "AMBAR";
  linhas: LinhaComanda[];
}

export type TipoPaginaComanda = "COZINHA_QUENTE" | "COZINHA_FRIA" | "CONFEITARIA" | "EXPEDICAO_ALIMENTACAO" | "EXPEDICAO_BEBIDAS";

export interface PaginaComanda {
  tipo: TipoPaginaComanda;
  data: string;                  // dia do evento a que a página se refere
  avisos: string[];              // tarjas vermelhas no topo (ex.: Zup sem picante, amostra 72 h, pesagem)
  blocos: BlocoComanda[];        // página sem blocos não é gerada
}

export interface PaginaAdriana {
  locacoes: string[];            // vazio → "Não solicitado"
  fornecedores: Array<{ data: string; fornecedor: string; item: string; quantidade: string }>;
  freelancers: number | null;    // null → campo em branco "____"
  verbaCentavos: number;         // 0 → bloco VERBA some inteiro
}

export interface Comanda {
  cabecalho: CabecalhoEvento;
  paginas: PaginaComanda[];      // produção e expedição, por dia
  adriana: PaginaAdriana;        // uma única página para todos os dias
}

// ------------------------------------------------------------------ Plaquinha (.pdf A4 2×3, dobra 50/50)

export interface CardPlaquinha {
  titulo: string;                // grande (sabor), em caixa alta
  subtitulo?: string | null;     // menor (categoria), em caixa alta
  en: string;                    // "CATEGORIA / Sabor", 1 linha
  es: string;
  selos: Array<Selo | SeloExtra>;
}

export interface Plaquinhas {
  cabecalho: CabecalhoEvento;
  /** Dedup dentro do dia; quebra de página entre dias. O gerador acrescenta o par "Visite nosso site" no fim. */
  dias: Array<{ data: string; cards: CardPlaquinha[] }>;
}

// ------------------------------------------------------------------ Proposta (.pptx)

export interface LinhaOrcamento {
  descritivo: string;            // redação exata do comercial
  pax: number | null;
  porPessoaCentavos: number | null; // null quando não pode aparecer (StartSe)
  valorCentavos: number | null;
}

export interface CardapioProposta {
  titulo: string;                // um pacote por slide
  itens: Array<{ nome: string; quantidade: number | null; descricao: string | null }>; // quantidade null → Celebrar
  bebidas: string[];             // último bloco
}

export interface PropostaDoc {
  cabecalho: CabecalhoEvento;
  formato: "POCKET" | "COMPLETO";
  orcamento: LinhaOrcamento[];
  bebidasAlcoolicas: LinhaOrcamento[];   // bloco separado, nunca somado à gastronomia
  totalCentavos: number | null;           // null → "R$ a definir" (mais de uma opção)
  opcionais: Array<{ descritivo: string; valorTexto: string }>; // não entram no total (louça premium…)
  cardapios: CardapioProposta[];
  validade: string | null;
}

/** Nome padrão dos 4 arquivos: Pieggi {Tipo} - {contratante} - {evento} - {contato} - {DD-MM-AAAA}.{ext} */
export function nomeArquivo(tipo: "Proposta" | "Programacao" | "Comanda" | "Plaquinha", c: CabecalhoEvento, ext: "pptx" | "docx" | "pdf"): string {
  const [a, m, d] = (c.datas[0] ?? "").split("-");
  const limpar = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return `Pieggi ${tipo} - ${limpar(c.contratante)} - ${limpar(c.evento)} - ${limpar(c.contato)} - ${d}-${m}-${a}.${ext}`;
}
