// Carga inicial das regras vigentes em 05/11/2026 (Especificação do Sistema de Operação de Eventos).
// Fonte única: os testes de aceite e o gerador da migration (scripts/gerar-carga-regras.ts) leem este arquivo.
// Depois da carga, o valor vigente mora no banco e é editado pelo admin — não altere regras em produção por aqui.
import type { EscopoTipo, Regra, StatusRegra } from "./motor";

export interface RegraInicial {
  codigo: string;
  titulo: string;
  valor: unknown;
  origem: string;
  escopoTipo?: EscopoTipo;
  escopoChave?: string;
  status?: StatusRegra;
  financeiro?: boolean;
  vigenteDesde?: string;        // padrão: VIGENCIA_INICIAL (cargas 1–3)
}

export const VIGENCIA_INICIAL = "2026-11-05";
const spec = (secao: string) => `Especificação 05/11/2026 §${secao}`;

const preco = (tabela: string, linha: string, tier: string, valor: number | Record<string, number>): RegraInicial => ({
  codigo: `preco.${tabela}.${linha}.${tier}`, titulo: `Preço por pax — ${tabela} · ${linha} · ${tier}`, valor, origem: spec("4 Tabelas de preço"), financeiro: true
});

const PRECOS: RegraInicial[] = [
  preco("EXTERNOS", "COFFEE_BREAK", "EXECUTIVE", 50), preco("STARTSE_ATUAL", "COFFEE_BREAK", "EXECUTIVE", 44),
  preco("EXTERNOS", "COFFEE_BREAK", "MASTER", 56), preco("STARTSE_ATUAL", "COFFEE_BREAK", "MASTER", 50),
  preco("EXTERNOS", "WELCOME", "BASIC", 14), preco("EXTERNOS", "WELCOME", "STANDARD", 19),
  preco("EXTERNOS", "WELCOME", "EXECUTIVE", 21), preco("EXTERNOS", "WELCOME", "MASTER", 24),
  preco("STARTSE_ATUAL", "WELCOME", "EXECUTIVE", 18),
  // Preço por duração: chave = horas máximas da faixa.
  preco("EXTERNOS", "AUDITORIO", "EXECUTIVE", { "4": 14, "8": 19 }), preco("STARTSE_ATUAL", "AUDITORIO", "EXECUTIVE", { "4": 12, "8": 17 }),
  preco("EXTERNOS", "AUDITORIO", "MASTER", { "4": 25, "8": 35 }),
  preco("EXTERNOS", "BRUNCH", "BASIC", 95), preco("EXTERNOS", "BRUNCH", "STANDARD", 120),
  preco("EXTERNOS", "ALMOCO", "EXECUTIVE", 150), preco("EXTERNOS", "ALMOCO", "MASTER", 215),
  preco("EXTERNOS", "JANTAR", "EXECUTIVE", 150), preco("EXTERNOS", "JANTAR", "MASTER", 215),
  preco("EXTERNOS", "COQUETEL", "BASIC", { "2": 80, "3": 95, "4": 100 }),
  preco("EXTERNOS", "COQUETEL", "STANDARD", { "2": 95, "3": 109, "4": 114 }),
  preco("EXTERNOS", "COQUETEL", "EXECUTIVE", { "2": 115, "3": 130, "4": 135 }),
  preco("EXTERNOS", "COQUETEL", "MASTER", { "2": 130, "3": 145, "4": 150 }),
  preco("EXTERNOS", "COQUETEL", "PREMIUM", { "2": 180, "3": 195, "4": 200 })
];

const AVULSOS: Array<[string, string, number]> = [
  ["TABUA_FRIOS_QUEIJOS", "Tábua de frios / tábua de queijos (cada)", 350], ["PASTA_NA_TABUA", "Pasta na tábua (travessa)", 210],
  ["CROISSANT_CATUPIRY", "Croissant de catupiry (un)", 5], ["TRAMEZZINO", "Tramezzino (un)", 11.5], ["CONE_FRIOS", "Cone de frios 15 g (un)", 9.5],
  ["DOCE_VEGANO", "Doce vegano (un)", 9.5], ["SANDUICHE_FRANGO_SG_SL", "Sanduíche de frango cremoso sem glúten e sem lactose (un)", 12.5],
  ["SALADA_FRUTAS_POTE", "Salada de frutas, pote 100 g (un)", 10], ["PETIT_FOUR_KG", "Petit four (kg, 10 g/un)", 200],
  ["SUCO_GARRAFINHA", "Suco individual em garrafinha (un)", 14.9], ["AGUA_INDIVIDUAL", "Água individual (un)", 5],
  ["COCA_LATA", "Coca-Cola lata (un)", 7.5], ["HEINEKEN_LATA", "Heineken lata (un)", 9.5], ["CHAMPANHE_PERINI", "Champanhe Casa Perini (garrafa)", 95],
  ["SUCO_SUQUEIRA_5L", "Suco na suqueira 5 L (cheia)", 160], ["SUCO_NATURAL_ONE", "Suco Natural One (garrafa, entrega)", 40], ["BOWL", "Bowl (un)", 29],
  ["COPEIRA", "Copeira — montagem e desmontagem", 350], ["LOCACAO_LOUCA_CONVIDADO", "Locação de louça na venda por unidade (por convidado)", 6.5],
  ["LUNCH_BOX_TRADICIONAL", "Lunch Box Tradicional", 39], ["LUNCH_BOX_SEM_GLUTEN", "Lunch Box Sem Glúten", 47], ["LUNCH_BOX_SEM_LACTOSE", "Lunch Box Sem Lactose", 47]
];

const COMERCIAL: RegraInicial[] = [
  ...PRECOS,
  ...AVULSOS.map(([chave, titulo, valor]): RegraInicial => ({ codigo: `preco.avulso.${chave}`, titulo: `Avulso — ${titulo}`, valor, origem: spec("4 Venda por unidade"), financeiro: true })),
  { codigo: "acrescimo.finger_food", titulo: "Acréscimo formato finger food (R$/pax)", valor: 30, origem: spec("4"), financeiro: true },
  { codigo: "taxa_servico.percentual", titulo: "Taxa de serviço sobre alimentação (pax × preço), nunca sobre logística", valor: 0.1, origem: spec("4 Taxas"), financeiro: true },
  { codigo: "logistica.valor", titulo: "Logística fixa por evento", valor: 250, origem: spec("4 Taxas"), financeiro: true },
  { codigo: "logistica.valor", titulo: "Logística Alphaville (Barueri)", valor: 600, escopoTipo: "REGIAO", escopoChave: "ALPHAVILLE", origem: spec("4 Taxas"), financeiro: true },
  { codigo: "logistica.valor", titulo: "Logística Barueri", valor: 600, escopoTipo: "REGIAO", escopoChave: "BARUERI", origem: spec("4 Taxas"), financeiro: true },
  ...["STARTSE", "INTELI", "IPT", "WTC"].map((cliente): RegraInicial => ({ codigo: "isencao.logistica_e_taxa", titulo: `${cliente} isento de logística e taxa`, valor: true, escopoTipo: "CLIENTE", escopoChave: cliente, origem: spec("4 Taxas"), financeiro: true })),
  { codigo: "isencao.logistica_e_taxa", titulo: "Isenção de logística e taxa (padrão)", valor: false, origem: spec("4 Taxas"), financeiro: true },
  { codigo: "repasse.interno", titulo: "Repasse interno WTC — nunca aparece para o cliente", valor: 0.12, escopoTipo: "CLIENTE", escopoChave: "WTC", origem: spec("4 Taxas"), financeiro: true },
  { codigo: "copeira.limite_evento_dia", titulo: "Cobrar copeira quando o evento não passar deste valor por dia (só externos)", valor: 3500, origem: spec("4 Taxas"), financeiro: true },
  { codigo: "pedido_minimo.pax", titulo: "Pedido mínimo (pax cobrados)", valor: 20, origem: spec("4 Taxas"), financeiro: true },
  { codigo: "louca_premium.por_pax", titulo: "Louça premium opcional (fora do total; só almoço/jantar)", valor: 45, origem: spec("4 Taxas"), financeiro: true },
  {
    codigo: "reposicao.faixas", titulo: "Coffee: acréscimo de preço por duração total (base 1h; teto 3h)", escopoTipo: "LINHA", escopoChave: "COFFEE_BREAK", financeiro: true,
    valor: [{ ateHoras: 1, acrescimo: 0 }, { ateHoras: 1.5, acrescimo: 0.3 }, { ateHoras: 2, acrescimo: 0.8 }, { ateHoras: 3, acrescimo: 1.5 }], origem: spec("4 Reposição")
  },
  { codigo: "reposicao.acrescimo_fixo", titulo: "Inteli: reposição +60% fixo", valor: 0.6, escopoTipo: "CLIENTE", escopoChave: "INTELI", origem: spec("4 Reposição"), financeiro: true },
  { codigo: "cmv.aviso", titulo: "CMV: aviso a partir de", valor: 0.3, origem: spec("4 CMV"), financeiro: true },
  { codigo: "cmv.bloqueio", titulo: "CMV: bloqueio duro acima de (só diretoria libera)", valor: 0.333, origem: spec("4 CMV"), financeiro: true },
  { codigo: "cmv.divisor_preco", titulo: "Preço sugerido = custo ÷ divisor, arredondado para cima em R$ 0,50", valor: 0.3, origem: spec("4 CMV"), financeiro: true },
  { codigo: "desconto.maximo_sem_diretoria", titulo: "Desconto máximo sem diretoria", valor: 0.05, origem: spec("4 CMV"), financeiro: true },
  { codigo: "imposto.servico", titulo: "Imposto sobre venda de serviço", valor: 0.2, origem: spec("4 CMV"), financeiro: true },
  { codigo: "imposto.produto", titulo: "Imposto quando faturado como NF de produto (bar e bebidas)", valor: 0.08, origem: spec("4 CMV"), financeiro: true },
  { codigo: "verba.percentual", titulo: "Verba de freelancer: % do orçamento total do evento", valor: 0.08, origem: spec("7 Página da Adriana"), financeiro: true }
];

const OPERACIONAL: RegraInicial[] = [
  { codigo: "duracao.teto_horas", titulo: "Coffee: exposição máxima (segurança alimentar; acima só diretoria)", valor: 3, escopoTipo: "LINHA", escopoChave: "COFFEE_BREAK", origem: spec("13 Autorizações") },
  { codigo: "duracao.teto_horas", titulo: "Coquetel: duração máxima sem diretoria", valor: 4, escopoTipo: "LINHA", escopoChave: "COQUETEL", origem: spec("13 Autorizações") },
  ...(["STANDARD", "EXECUTIVE", "MASTER"] as const).map((tier): RegraInicial => ({ codigo: `qtd.coffee.fator.${tier}`, titulo: `Coffee ${tier}: unidades por pax`, valor: 1.1, origem: spec("6 Multiplicadores") })),
  { codigo: "qtd.coffee.fator.BASIC", titulo: "Coffee Basic (mini lanche): unidades por pax", valor: 1.5, origem: spec("6 Multiplicadores") },
  { codigo: "qtd.reposicao.fator", titulo: "Com reposição: multiplicador sobre todo alimento", valor: 1.6, origem: spec("6 Multiplicadores") },
  { codigo: "qtd.adicional.fator", titulo: "Item adicional: unidades por pax", valor: 1.1, origem: spec("6 Multiplicadores") },
  { codigo: "qtd.adicionais", titulo: "Nº de itens adicionais por tier", valor: { STANDARD: 1, EXECUTIVE: 2, MASTER: 3 }, origem: spec("5 Itens adicionais") },
  { codigo: "qtd.adicionais", titulo: "Inteli: Standard = itens fixos + exatamente 2 adicionais", valor: { STANDARD: 2, EXECUTIVE: 2, MASTER: 3 }, escopoTipo: "CLIENTE", escopoChave: "INTELI", origem: spec("5 Regras fixas por cliente") },
  { codigo: "qtd.adicional.dividir_a_partir_pax", titulo: "Cada adicional se divide 50/50 em duas variedades a partir deste pax", valor: 50, origem: spec("5 Itens adicionais") },
  { codigo: "qtd.mini_lanche.vegetariano", titulo: "Mini lanche: parcela vegetariana (brioche de cenoura)", valor: 0.2, origem: spec("6 Mini lanche") },
  { codigo: "qtd.mini_lanche.pax_por_sabor", titulo: "Mini lanche: +1 sabor de cada a cada N pax", valor: 100, origem: spec("6 Mini lanche") },
  { codigo: "qtd.pao_de_queijo.por_pax", titulo: "Pão de queijo por pax, por tipo", valor: { "Pão de queijo tradicional": 1.5, "Pão de queijo integral": 0.5 }, origem: spec("6 Multiplicadores / Caso 1") },
  { codigo: "qtd.pao_de_queijo.por_pax", titulo: "Inteli: pão de queijo 30% tradicional / 30% multigrãos / 40% croissant", valor: { "Pão de queijo tradicional": 0.6, "Pão de queijo multigrãos": 0.6, "Croissant de queijo/calabresa ou pão de batata com catupiry": 0.8 }, escopoTipo: "CLIENTE", escopoChave: "INTELI", origem: spec("6 Regras próprias do Inteli") },
  { codigo: "qtd.cupcake.fator", titulo: "Cup cake / bebezinho: unidades por pax (2 sabores 50/50)", valor: 1.1, origem: spec("6 Bebezinho") },
  { codigo: "qtd.cupcake.split_master", titulo: "Master: bebezinho 60% + queijadinha 30% (soma 90% — pendente)", valor: { "Cup cake": 0.6, "Queijadinha": 0.3 }, status: "PENDENTE", origem: spec("16 Lacunas de regra") },
  { codigo: "qtd.salada_frutas.ml_por_pax", titulo: "Salada de frutas (ml por pax)", valor: 100, origem: spec("6 Multiplicadores") },
  { codigo: "qtd.salada_frutas.aplica_reposicao", titulo: "Salada de frutas recebe ×1,6 com reposição", valor: false, origem: spec("6 Multiplicadores") },
  { codigo: "qtd.salada_frutas.aplica_reposicao", titulo: "Inteli: salada de frutas recebe ×1,6 com reposição", valor: true, escopoTipo: "CLIENTE", escopoChave: "INTELI", origem: spec("6 Regras próprias do Inteli") },
  { codigo: "qtd.cafe.ml_por_pax", titulo: "Café no coffee break (ml por pax)", valor: 100, origem: spec("6 Bebidas") },
  { codigo: "qtd.bebidas.aplica_reposicao", titulo: "Bebidas recebem ×1,6 com reposição?", valor: false, status: "PENDENTE", origem: spec("16 Lacunas de regra") },
  { codigo: "qtd.garrafa_termica.litros", titulo: "Litros por garrafa térmica (arredondar para cima)", valor: { CAFE: 1.7, SUCO: 1, CHA: 1 }, origem: spec("6 Bebidas") },
  { codigo: "qtd.bebidas.dupla_obrigatoria", titulo: "Coffee: suco + chá mate gelado são dupla indivisível", valor: ["Suco de laranja", "Chá mate gelado"], origem: spec("6 Bebidas") },
  { codigo: "qtd.refresqueira_agua_extra", titulo: "Refresqueiras de água extras por período", valor: 0, origem: spec("6 Regras próprias do Inteli") },
  { codigo: "qtd.refresqueira_agua_extra", titulo: "Inteli: +1 refresqueira de água por período", valor: 1, escopoTipo: "CLIENTE", escopoChave: "INTELI", origem: spec("6 Regras próprias do Inteli") },
  { codigo: "almoco.folga", titulo: "PAX de cálculo = PAX + 1 a cada N pax (mínimo +1)", valor: { aCada: 20, minimo: 1 }, origem: spec("7 Dimensionamento") },
  { codigo: "almoco.folga_arredondamento", titulo: "Folga com número quebrado (35 pax = 1,75): CIMA ou BAIXO", valor: "CIMA", status: "PENDENTE", origem: spec("16 Lacunas de regra") },
  { codigo: "almoco.proteina_g", titulo: "Proteína pronta (g/pax) por composição", valor: { COMPLETO: 150, INTERMEDIARIO: 170, REDUZIDO: 200 }, origem: spec("7 Dimensionamento") },
  { codigo: "almoco.proteina_minimo_reduzido", titulo: "Reduzido até N pax: mínimo de kg pronto por proteína", valor: { atePax: 10, kg: 1.5 }, origem: spec("7 Dimensionamento") },
  { codigo: "almoco.acompanhamento_g", titulo: "Arroz, feijão, purê (g/pax) por composição", valor: { COMPLETO: 130, INTERMEDIARIO: 150, REDUZIDO: 200 }, origem: spec("7 Dimensionamento") },
  { codigo: "almoco.gramaturas_g", titulo: "Gramaturas fixas (g/pax)", valor: { MASSA: 130, VEGETARIANO: 100, FOLHAS: 80, SALADA_COMPOSTA: 60, VEGETAIS: 50, SOBREMESA: 60, PUDIM: 80 }, origem: spec("7 Dimensionamento") },
  { codigo: "almoco.molho", titulo: "Molho em linha própria: % do peso pronto", valor: { PROTEINA: 0.3, MASSA: 0.5 }, origem: spec("7 Dimensionamento") },
  { codigo: "almoco.pudim_pax_por_forma", titulo: "Pudim: 1 forma a cada N pax (arredonda para cima)", valor: 20, origem: spec("7 Dimensionamento") },
  { codigo: "almoco.pudim_base_pax", titulo: "Formas de pudim usam o pax REAL ou de CALCULO?", valor: "CALCULO", status: "PENDENTE", origem: spec("16 Lacunas de regra") },
  { codigo: "almoco.amostra_vigilancia_horas", titulo: "Amostra da Vigilância: horas congelada (confirmar com a Vigilância)", valor: 72, status: "PENDENTE", origem: spec("16 Lacunas de regra") },
  { codigo: "rendimento", titulo: "Rendimento: kg pronto por kg cru (compra = pronto ÷ rendimento)", valor: { FILE: 0.8, SALMAO: 0.85, FRANGO: 0.8, LEGUMES: 0.8, FOLHAS: 0.7, PURE_BATATA: 0.7, PURE_MANDIOQUINHA: 0.75, ARROZ: 3, MASSA_SECA: 2.3, NHOQUE: 1, LASANHA: 1 }, origem: spec("7 Rendimentos oficiais") },
  {
    codigo: "lista_negra", titulo: "Itens proibidos em proposta, programação, comanda e plaquinha", origem: spec("11 Lista negra"),
    valor: [
      { termo: "atum", motivo: "Só quando o cliente pedir explicitamente; nunca em cardápio sugerido." },
      { termo: "wrap de abacate", motivo: "Umedece o pão." },
      { termo: "red velvet", motivo: "Fora do cardápio." },
      { termo: "risoto", motivo: "Não existe no cardápio Pieggi." },
      { termo: "tramezzino", motivo: "Não usar tramezzino em proposta." },
      { termo: "coquetel essencial", motivo: "Linha inexistente; use a versão boteco." },
      { termo: "can-018", motivo: "Item extinto (Mini Tortinha Folhada de Guacamole)." },
      { termo: "coxinha", motivo: "Salgado caseiro frito fica abaixo do padrão em proposta." },
      { termo: "risole", motivo: "Salgado caseiro frito fica abaixo do padrão em proposta." },
      { termo: "esfiha", motivo: "Fora do padrão Pieggi." },
      { termo: "bolinha de queijo", motivo: "Salgado caseiro frito fica abaixo do padrão em proposta." },
      { termo: "brioche integral", motivo: "Descontinuado; use pão de cenoura nos vegetarianos." },
      { termo: "pizza", motivo: "Fora do padrão em coquetel e festa." },
      { termo: "pipoca gourmet", motivo: "Fora do padrão em coquetel e festa." },
      { termo: "estrogonofe", motivo: "Fora do padrão em coquetel e festa." }
    ]
  },
  {
    codigo: "vocabulario_travado", titulo: "Termos que o sistema nunca escreve", origem: spec("11 Vocabulário travado"),
    valor: [
      { proibido: "cumbuca", correto: "travessa" }, { proibido: "bolo redondo", correto: "bolo inteiro" },
      { proibido: "mini sanduíche de pão de forma", correto: "tramezzino" }, { proibido: "chef decide", correto: "peso calculado" },
      { proibido: "confeiteiro decide", correto: "peso calculado" }, { proibido: "brioche ce", correto: "brioche de cenoura" }
    ]
  }
];

// ================================================================ Carga 2 (migration 20261109103000)
// Programação, comanda, plaquinha e proposta. Mesma vigência da especificação.
const ANTIGA = "Instruções dos agentes (Programação/Produção, até 05/10/2026) — sem conflito com a especificação";
type Opcoes = Pick<RegraInicial, "escopoTipo" | "escopoChave" | "status" | "financeiro">;
const r2 = (codigo: string, titulo: string, valor: unknown, origem: string, opcoes: Opcoes = {}): RegraInicial => ({ codigo, titulo, valor, origem, ...opcoes });
const linha = (chave: string): Opcoes => ({ escopoTipo: "LINHA", escopoChave: chave });
const cliente = (chave: string): Opcoes => ({ escopoTipo: "CLIENTE", escopoChave: chave });
const PENDENTE: Opcoes = { status: "PENDENTE" };

const BEBIDAS_QUENTES = ["Café", "Leite", "Água quente", "Chá", "Achocolatado"];
const BEBIDAS_GELADAS = ["Suco", "Chá gelado", "Refrigerante", "Cerveja", "Água"];
const PESAGEM = "PESAGEM: pesar cada item pronto, anotar o peso nesta comanda e entregar a comanda na administração. Carne ao molho: pesar a carne separada do molho. Nunca pesar sobra no evento — a sobra fica para os funcionários.";

const CARDAPIO: RegraInicial[] = [
  r2("tiers.ordem", "Hierarquia cumulativa de tiers (tier superior usa os de baixo)", ["BASIC", "STANDARD", "EXECUTIVE", "MASTER", "PREMIUM"], spec("4 Hierarquia de tiers")),
  r2("cardapio.categorias", "Rótulo (coluna ITEM), prefixo do sabor e tipo por grupo da planilha ou termo do nome — a primeira que casar vence", [
    { termos: ["pão de queijo"], rotulo: "Pão de queijo", prefixos: ["pão de queijo"], tipo: "BASE" },
    { termos: ["salada de frutas"], rotulo: "Salada de frutas", prefixos: ["salada de frutas"], tipo: "BASE" },
    { termos: ["croissant"], rotulo: "Croissant", prefixos: ["croissant"], tipo: "SALGADO" },
    { termos: ["pão de batata"], rotulo: "Pão de batata", prefixos: ["pão de batata"], tipo: "SALGADO" },
    { termos: ["queijadinha"], rotulo: "Queijadinha", prefixos: ["mini queijadinha", "queijadinha"], tipo: "DOCE" },
    { termos: ["carolina"], rotulo: "Carolina", prefixos: ["mini carolina", "carolina"], tipo: "DOCE" },
    { termos: ["bombocado"], rotulo: "Bombocado", prefixos: ["mini bombocado", "bombocado"], tipo: "DOCE" },
    { termos: ["bombom"], rotulo: "Bombom", prefixos: ["bombom"], tipo: "DOCE" },
    { termos: ["petit four"], rotulo: "Petit four", prefixos: ["petit four salgado", "petit four doce", "petit four"], tipo: "SALGADO" },
    { grupo: "MINI SANDUÍCHE", rotulo: "Mini lanche", prefixos: ["mini sanduíche", "mini lanche"], conector: "de", tipo: "SALGADO" },
    { grupo: "TRAMEZZINO", rotulo: "Tramezzino", prefixos: ["tramezzino"], tipo: "SALGADO" },
    { grupo: "MINI WRAP", rotulo: "Wrap", prefixos: ["mini wrap", "wrap"], tipo: "SALGADO" },
    { grupo: "ENVELOPE GOURMET", rotulo: "Envelope gourmet", prefixos: ["envelope gourmet (com pregador)", "envelope gourmet"], tipo: "SALGADO" },
    { grupo: "BARQUETE DE TAPIOCA", rotulo: "Tapioca", prefixos: ["barquete de tapioca", "barquete"], tipo: "MISTO" },
    { grupo: "SHOT FUNCIONAL", rotulo: "Shot", prefixos: ["shot"], tipo: "SHOT" },
    { grupo: "SHOT VITAMINADO", rotulo: "Shot vitaminado", prefixos: ["shot"], tipo: "SHOT" },
    { grupo: "TARTELETE", rotulo: "Tartelete", prefixos: ["tartelete"], tipo: "MISTO" },
    { grupo: "MINI CUP SALGADO", rotulo: "Mini cup", prefixos: ["mini cup"], tipo: "SALGADO" },
    { grupo: "VERRINE DOCE", rotulo: "Verrine", prefixos: ["verrine"], tipo: "DOCE" },
    { grupo: "PIEGGI BOARD", rotulo: "Pieggi Board", prefixos: [], tipo: "SALGADO" },
    { grupo: "BOLO INTEIRO", rotulo: "Bolo", prefixos: ["bolo inteiro", "bolo piscina", "bolo"], tipo: "DOCE" },
    { grupo: "BEBEZINHO (CUP CAKE)", rotulo: "Cup cake", prefixos: ["bebezinho", "cup cake"], tipo: "DOCE" },
    { termos: ["mini lanche", "mini sanduíche"], rotulo: "Mini lanche", prefixos: ["mini lanche", "mini sanduíche"], conector: "de", tipo: "SALGADO" },
    { termos: ["cup cake", "bebezinho"], rotulo: "Cup cake", prefixos: ["cup cake", "bebezinho"], tipo: "DOCE" },
    { termos: ["tábua de frios"], rotulo: "Tábua de frios", prefixos: ["tábua de frios"], tipo: "SALGADO" },
    { termos: ["tábua de queijos"], rotulo: "Tábua de queijos", prefixos: ["tábua de queijos"], tipo: "SALGADO" },
    { termos: ["verrine"], rotulo: "Verrine", prefixos: ["verrine"], tipo: "DOCE" },
    { termos: ["tartelete"], rotulo: "Tartelete", prefixos: ["tartelete"], tipo: "MISTO" },
    { termos: ["shot vitaminado"], rotulo: "Shot vitaminado", prefixos: ["shot vitaminado", "shot"], tipo: "SHOT" },
    { termos: ["shot"], rotulo: "Shot", prefixos: ["shot"], tipo: "SHOT" },
    { termos: ["wrap"], rotulo: "Wrap", prefixos: ["mini wrap", "wrap"], tipo: "SALGADO" },
    { termos: ["tapioca", "barquete"], rotulo: "Tapioca", prefixos: ["barquete de tapioca", "tapioca", "barquete"], tipo: "MISTO" },
    { termos: ["quiche"], rotulo: "Quiche", prefixos: ["mini quiche", "quiche"], tipo: "SALGADO" },
    { termos: ["hambúrguer"], rotulo: "Mini hambúrguer", prefixos: ["mini hambúrguer", "hambúrguer"], tipo: "SALGADO" },
    { termos: ["mix de castanhas", "samix"], rotulo: "Mix de castanhas", prefixos: ["cup samix de", "mix de castanhas"], tipo: "SALGADO" },
    { termos: ["homus"], rotulo: "Homus", prefixos: ["homus"], tipo: "SALGADO" },
    { termos: ["frutas laminadas"], rotulo: "Frutas laminadas", prefixos: ["frutas laminadas"], tipo: "BASE" },
    { termos: ["favo de mel"], rotulo: "Favo de mel", prefixos: ["favo de mel"], tipo: "BASE" },
    { termos: ["chá gelado", "chá mate"], rotulo: "Chá gelado", prefixos: ["chá mate gelado", "chá gelado na refresqueira", "chá gelado"], tipo: "BEBIDA" },
    { termos: ["kit de chá", "sachê de chá", "sachê"], rotulo: "Chá", prefixos: [], tipo: "BEBIDA" },
    { termos: ["suco"], rotulo: "Suco", prefixos: ["suco na refresqueira", "suco"], tipo: "BEBIDA" },
    { termos: ["água quente"], rotulo: "Água quente", prefixos: ["água quente"], tipo: "BEBIDA" },
    { termos: ["água", "minalba"], rotulo: "Água", prefixos: ["água"], tipo: "BEBIDA" },
    { termos: ["achocolatado"], rotulo: "Achocolatado", prefixos: ["achocolatado"], tipo: "BEBIDA" },
    { termos: ["café"], rotulo: "Café", prefixos: ["café"], tipo: "BEBIDA" },
    { termos: ["leite"], rotulo: "Leite", prefixos: ["leite"], tipo: "BEBIDA" },
    { termos: ["refrigerante", "coca-cola", "pepsi", "guaraná"], rotulo: "Refrigerante", prefixos: ["refrigerante"], tipo: "BEBIDA" },
    { termos: ["cerveja", "heineken", "budweiser"], rotulo: "Cerveja", prefixos: ["cerveja"], tipo: "BEBIDA" },
    { termos: ["kit"], rotulo: "Kit", prefixos: [], tipo: "BASE" }
  ], spec("3 Modelo de dados / 5 Composição")),
  r2("cardapio.queijo", "Classificação salgado × doce: tem queijo ou pasta de queijo como base = salgado", ["queijo", "queijos", "cottage", "ricota", "catupiry", "requeijão", "coalhada", "provolone", "parmesão", "brie"], spec("5 Composição de cardápio")),
  r2("cardapio.bases", "Bases de ingrediente que não se repetem entre manhã/tarde nem entre dias (primeiro termo do nome)", [
    "frango defumado", "frango", "peru", "blanquet", "presunto", "lombo", "salame", "copa", "pastrami", "rosbife", "atum", "provolone", "búfala",
    "abacate", "abóbora", "beterraba", "cenoura", "milho", "abobrinha", "amendoim", "tomate seco", "homus", "babaganoush", "berinjela",
    "pepino", "uvas", "uva", "azeitonas", "manga", "ricota", "tzatziki", "coalhada", "guacamole", "castanhas", "goiaba", "goiabada", "abacaxi",
    "doce de leite", "banana", "maçã", "morango", "maracujá", "limão", "chocolate branco", "chocolate", "cocada", "coco", "brigadeiro",
    "frutas vermelhas", "cottage", "catupiry", "calabresa", "queijo", "churros", "nutella", "nhá benta", "prestígio", "prestigio", "fubá", "fuba"
  ], spec("5 Composição de cardápio")),
  r2("selo.classificacao", "Selo padrão por termo: sem selo (carne, peixe, café, água) > vegano > vegetariano. Sem glúten/lactose/açúcar só se a programação disser", {
    semSelo: ["frango", "peru", "presunto", "salame", "pastrami", "lombo", "copa", "rosbife", "atum", "blanquet", "calabresa", "quibe", "kibe", "hambúrguer",
      "cheeseburger", "lorraine", "bacon", "carne", "filé", "salmão", "peixe", "camarão", "frios", "parma", "caesar", "café", "água", "pasta de frango"],
    vegano: ["vegano", "suco", "sucos", "chá gelado", "chá mate", "salada de frutas", "frutas laminadas", "frutas da tábua", "guacamole", "homus", "batata frita",
      "mix de castanhas", "castanhas", "barquete banana", "barquete maçã", "tapioca de banana", "bolo vegano", "shot", "tramezzino creme",
      "tramezzino homus", "babaganoush", "pasta de cenoura com gengibre"],
    vegetariano: ["vegetariano", "pão de queijo", "cup cake", "bebezinho", "petit four", "croissant", "carolina", "quiche", "tábua de queijos", "leite",
      "achocolatado", "provolone", "búfala", "queijo", "queijos", "tartelete", "verrine", "bolo", "bombom", "queijadinha", "bombocado",
      "pão de batata", "wrap", "envelope gourmet", "barquete", "mini cup", "catupiry", "tzatziki", "coalhada", "ricota", "cottage", "brigadeiro", "mousse"]
  }, spec("8 Selos")),
  r2("pacote", "Coffee Break: papéis do pacote por tier (* = todos)", { "*": ["MINI_LANCHE", "PAO_DE_QUEIJO", "ADICIONAIS", "CUPCAKE", "SALADA_FRUTAS", "BEBIDAS"] }, spec("6 Multiplicadores"), linha("COFFEE_BREAK")),
  r2("pacote", "Welcome: Basic só petit four e bebidas; demais com pão de queijo (confirmar composição por tier)", { BASIC: ["PETIT_FOUR", "BEBIDAS"], "*": ["PAO_DE_QUEIJO", "PETIT_FOUR", "BEBIDAS"] }, spec("6 Welcome Coffee"), { ...linha("WELCOME"), ...PENDENTE }),
  r2("pacote", "Auditório: café e águas", { "*": ["AUDITORIO"] }, spec("6 Bebidas"), linha("AUDITORIO")),
  r2("pacote", "Coquetel/HH: itens escolhidos, verrines, tábuas (Standard+), bebidas", { BASIC: ["LIVRE", "VERRINE", "BEBIDAS"], "*": ["LIVRE", "VERRINE", "TABUAS", "BEBIDAS"] }, spec("6 Tábuas"), linha("COQUETEL")),
  r2("pacote", "Brunch: itens escolhidos + base de coffee (confirmar com o cardápio de brunch)", { "*": ["LIVRE", "PAO_DE_QUEIJO", "SALADA_FRUTAS", "BEBIDAS"] }, spec("16 Lacunas de dado"), { ...linha("BRUNCH"), ...PENDENTE }),
  r2("pacote", "Lunch Box: kit individual", { "*": ["KIT"] }, spec("4 Lunch Box"), linha("LUNCH_BOX")),
  r2("pacote", "Almoço: buffet dimensionado, verrine se houver, frutas laminadas (Executive/Master), bebidas", { "*": ["ALMOCO", "VERRINE", "FRUTAS_LAMINADAS", "BEBIDAS"] }, spec("7 Dimensionamento"), linha("ALMOCO")),
  r2("pacote", "Jantar: buffet dimensionado, verrine se houver, frutas laminadas (Executive/Master), bebidas", { "*": ["ALMOCO", "VERRINE", "FRUTAS_LAMINADAS", "BEBIDAS"] }, spec("7 Dimensionamento"), linha("JANTAR")),
  r2("pacote.papel_por_rotulo", "Item escolhido → papel no pacote (fora disso vira adicional/livre)", {
    "Mini lanche": "MINI_LANCHE", "Pão de queijo": "PAO_DE_QUEIJO", "Cup cake": "CUPCAKE", "Queijadinha": "CUPCAKE", "Salada de frutas": "SALADA_FRUTAS",
    "Verrine": "VERRINE", "Petit four": "PETIT_FOUR", "Tábua de frios": "TABUAS", "Tábua de queijos": "TABUAS", "Frutas laminadas": "FRUTAS_LAMINADAS"
  }, spec("6 Multiplicadores")),
  r2("composicao.adicionais_periodo", "Adicionais por tier: manhã prioriza salgado, tarde prioriza doce", {
    STANDARD: { MANHA: ["SALGADO"], TARDE: ["DOCE"] }, EXECUTIVE: { MANHA: ["SALGADO", "DOCE"], TARDE: ["DOCE", "DOCE"] },
    MASTER: { MANHA: ["SALGADO", "SALGADO", "DOCE"], TARDE: ["DOCE", "DOCE", "SALGADO"] }
  }, spec("5 Itens adicionais por linha")),
  r2("composicao.adicionais_periodo", "Inteli: Standard com exatamente 2 adicionais", {
    STANDARD: { MANHA: ["SALGADO", "DOCE"], TARDE: ["DOCE", "SALGADO"] }, EXECUTIVE: { MANHA: ["SALGADO", "DOCE"], TARDE: ["DOCE", "DOCE"] },
    MASTER: { MANHA: ["SALGADO", "SALGADO", "DOCE"], TARDE: ["DOCE", "DOCE", "SALGADO"] }
  }, spec("5 Regras fixas por cliente"), cliente("INTELI")),
  r2("qtd.adicional.segunda_variedade_vegana", "Adicional dividido: a segunda variedade é vegana", false, spec("5 Regras fixas por cliente")),
  r2("qtd.adicional.segunda_variedade_vegana", "Inteli: adicionais 50% não-vegano / 50% vegano", true, spec("5 Regras fixas por cliente"), cliente("INTELI")),
  r2("sugestao.categorias_adicionais", "Grupos da planilha que o motor sugere como item adicional de coffee", ["TARTELETE", "MINI WRAP", "BARQUETE DE TAPIOCA", "MINI CUP SALGADO", "SALGADOS CASEIROS", "VERRINE DOCE", "MINI DOCE EXTRA"], spec("5 Itens adicionais por linha")),
  r2("sugestao.excluir_por_tier", "Grupos que o motor não sugere em certo tier (tapioca no Master só a pedido)", { MASTER: ["BARQUETE DE TAPIOCA"] }, spec("11 Lista negra")),
  r2("sugestao.restricao_periodo", "Itens/grupos restritos a um período (blanquet só manhã; frango desfiado só tarde; wrap nunca à tarde)", [
    { termos: ["blanquet"], periodos: ["MANHA"] }, { termos: ["frango cozido desfiado"], periodos: ["TARDE"] },
    { grupos: ["MINI WRAP", "ENVELOPE GOURMET"], rotulos: ["Wrap", "Envelope gourmet"], periodos: ["MANHA"] }
  ], spec("5 Composição de cardápio")),
  r2("sugestao.repetir_permitido", "Papéis que podem repetir sabor entre períodos (mini lanche vegetariano)", ["MINI_LANCHE_VEG"], spec("8 Decisões de item já fechadas")),
  r2("qtd.adicional.nao_dividir", "Rótulos que nunca se dividem em 2 sabores (wrap: 1 item, 1 sabor)", ["Wrap", "Envelope gourmet"], spec("6 Wrap")),
  r2("cupcake.termos_chocolate", "Sabores de cup cake que contam como chocolate (nunca 2 no mesmo período)", ["chocolate", "nutella", "prestígio", "prestigio", "nhá benta", "brigadeiro"], spec("6 Bebezinho / cup cake")),
  r2("mini_lanche.pao", "Pão do mini lanche (nunca brioche integral nem CE)", { CARNE: "Brioche", VEGETARIANO: "Brioche de cenoura" }, spec("6 Mini lanche")),
  r2("recipientes", "Recipiente escrito no nome do item (coluna RECEITA)", [
    { termos: ["carolina"], texto: "na forminha pétala de acrílico" }, { termos: ["quiche"], texto: "na forminha pétala kraft ou preta" },
    { termos: ["shimeji", "can-005"], texto: "na casquinha flor preta" }, { termos: ["queijadinha"], texto: "na forminha própria, tipo a do bebezinho" }
  ], spec("6 Recipientes e forminhas")),
  r2("cardapio.travado", "Cardápio travado: só aumenta quantidade, nunca troca item ou sabor", false, spec("5 Regras fixas por cliente")),
  r2("cardapio.travado", "WTC revende o cardápio: só aumenta quantidade", true, spec("5 Regras fixas por cliente"), cliente("WTC")),
  r2("qtd.pao_de_queijo.por_pax", "Welcome: pão de queijo 2/pax, 70% tradicional + 30% integral", { "Pão de queijo tradicional": 1.4, "Pão de queijo integral": 0.6 }, spec("6 Multiplicadores"), linha("WELCOME")),
  r2("qtd.welcome.petit_four", "Welcome: 1 petit four salgado 1/pax + 2 doces a 0,5/pax cada (1/pax cada com pão de queijo)", { salgadoPorPax: 1, doces: 2, docePorPax: 0.5, docePorPaxComPaoDeQueijo: 1 }, spec("6 Welcome Coffee")),
  r2("sabores.petit_four", "Sabores de petit four do Welcome (grafia oficial)", { SALGADO: ["Gergelim", "Quinoa", "Parmesão"], DOCE: ["Ferradura", "Serquilho", "Cristal de goiaba", "Unha de gato", "Dedo de moça", "Mentirinha"] }, spec("6 Welcome Coffee / 8 Grafia oficial")),
  r2("qtd.verrine", "Doce em verrine (HH, coquetel, almoço): pax × 1,65 arredondado para cima, dividido entre 2 sabores", { porPax: 1.65, sabores: 2, sugerirLinhas: ["COQUETEL"] }, spec("6 Multiplicadores")),
  r2("qtd.item_livre.fator", "Item escolhido sem regra própria: unidades por pax", 1.1, spec("6 Multiplicadores")),
  r2("qtd.frutas_laminadas", "Frutas laminadas só em almoço/jantar Executive e Master (g/pax a confirmar)", { gPorPax: 50, tiers: ["EXECUTIVE", "MASTER"] }, ANTIGA, PENDENTE),
  r2("qtd.tabua.arredondar_g", "Tábuas: arredondar cada componente para a dezena de grama", 10, spec("6 Tábuas")),
  r2("qtd.tabua.EXECUTIVE", "Tábuas Executive: 6 g/pax (frios parma 40/copa 30/pastrami 30; queijos provolone 50/gruyère 30/gorgonzola 20)", {
    frios: { gPorPax: 6, partes: { Parma: 0.4, Copa: 0.3, Pastrami: 0.3 } }, queijos: { gPorPax: 6, partes: { Provolone: 0.5, "Gruyère": 0.3, Gorgonzola: 0.2 } }
  }, spec("6 Tábuas")),
  r2("qtd.tabua.STANDARD", "Tábuas Standard: frios salame + copa + lombo; queijos parmesão + gruyère + gorgonzola (g/pax e % a confirmar)", {
    frios: { gPorPax: 6, partes: { "Salame comum": 0.5, Copa: 0.25, "Lombo canadense": 0.25 } }, queijos: { gPorPax: 6, partes: { "Parmesão": 0.5, "Gruyère": 0.3, Gorgonzola: 0.2 } }
  }, spec("6 Tábuas / 16 Lacunas"), PENDENTE),
  r2("qtd.tabua.MASTER", "Tábuas Master: copa + parma + pastrami; 5 queijos no favo de mel (g/pax e % a confirmar)", {
    frios: { gPorPax: 6, partes: { Copa: 0.3, Parma: 0.4, Pastrami: 0.3 } },
    queijos: { gPorPax: 6, partes: { "Parmesão": 0.2, Brie: 0.2, "Gruyère": 0.2, Gorgonzola: 0.2, "Muçarela de búfala": 0.2 } }
  }, spec("6 Tábuas"), PENDENTE),
  r2("qtd.tabua.HH_PIZZA", "Tábuas HH Pizza: 10 g/pax (frios parma 70 + pastrami 50 + copa 50; queijos gruyère 70 + provolone 50 + gorgonzola 50)", {
    frios: { gPorPax: 10, partes: { Parma: 0.7, Pastrami: 0.5, Copa: 0.5 } }, queijos: { gPorPax: 10, partes: { "Gruyère": 0.7, Provolone: 0.5, Gorgonzola: 0.5 } }
  }, spec("6 Tábuas")),
  r2("qtd.tabua.frutas", "Frutas da tábua: 1 de cada no evento inteiro, só enfeite (não come, não repõe)", ["1 caixinha de uva", "1 caixinha de morango", "1 toranja", "1 pitaya", "1 coco aberto"], spec("6 Tábuas")),
  r2("qtd.lunch_box.kit", "Lunch Box: componentes por kit (1 kit por pax)", {
    "*": [
      { rotulo: "Mini lanche", receita: "Mini lanche (sabor a escolher)" }, { rotulo: "Cup cake", receita: "Cup cake (sabor a escolher)" },
      { rotulo: "Verrine", receita: "Verrine (sabor a escolher)" }, { rotulo: "Suco", receita: "Suco Pieggi 300 ml", bebida: true },
      { rotulo: "Kit", receita: "Guardanapo, mini colher e sacolinha preta com selo" }
    ]
  }, spec("4 Lunch Box")),
  r2("qtd.auditorio", "Auditório: contratado = café 150 ml × pax × períodos + 1,5 água sem gás + 1 com gás por pax/período; cortesia = café + água na refresqueira 150 ml × pax × períodos", {
    CONTRATADO: { cafeMl: 150, aguaSemGas: 1.5, aguaComGas: 1 }, CORTESIA: { cafeMl: 150, aguaRefresqueiraMl: 150 }
  }, spec("6 Bebidas")),
  r2("auditorio.horas_por_periodo", "Auditório: horas por período (períodos = horas ÷ isto, para cima)", 4, spec("4 Auditório 4h / 8h")),
  r2("bebidas.padrao", "Bebidas do coffee break (ml/pax; Basic sem água quente e sachê)", [
    { nome: "Café", regra: "qtd.cafe.ml_por_pax" }, { nome: "Leite", ml: 30 }, { nome: "Água quente", ml: 30, aPartirDoTier: "STANDARD" },
    { nome: "Sachê de chá", un: 0.5, aPartirDoTier: "STANDARD" }, { nome: "Suco", ml: { BASIC: 100, "*": 130 }, rodizio: true }, { nome: "Chá mate gelado", ml: 80 }
  ], ANTIGA, linha("COFFEE_BREAK")),
  r2("bebidas.padrao", "Bebidas do Welcome (ml/pax)", [{ nome: "Café", ml: 50 }, { nome: "Leite", ml: 15 }, { nome: "Água quente", ml: 15 }], ANTIGA, linha("WELCOME")),
  r2("bebidas.padrao", "Bebidas do brunch (ml/pax)", [{ nome: "Café", ml: 100 }, { nome: "Leite", ml: 30 }, { nome: "Suco", ml: 130, rodizio: true }, { nome: "Chá mate gelado", ml: 80 }], ANTIGA, { ...linha("BRUNCH"), ...PENDENTE }),
  r2("bebidas.padrao", "Bebidas do coquetel/HH (ml/pax)", [{ nome: "Suco", ml: 150 }, { nome: "Água na refresqueira", ml: 150 }], ANTIGA, linha("COQUETEL")),
  r2("bebidas.padrao", "Bebidas do almoço (ml/pax)", [{ nome: "Suco", ml: 150 }, { nome: "Água na refresqueira", ml: 150 }], ANTIGA, { ...linha("ALMOCO"), ...PENDENTE }),
  r2("bebidas.padrao", "Bebidas do jantar (ml/pax)", [{ nome: "Suco", ml: 150 }, { nome: "Água na refresqueira", ml: 150 }], ANTIGA, { ...linha("JANTAR"), ...PENDENTE }),
  r2("bebidas.padrao", "Bebidas padrão (nenhuma)", [], ANTIGA),
  r2("bebidas.cadastro", "Cadastro de bebida: rótulo, garrafa térmica, quente/gelada, comprada pronta, consumo padrão", {
    "Café": { rotulo: "Café", termica: "CAFE", ml: 100 }, "Leite": { rotulo: "Leite", ml: 30 }, "Água quente": { rotulo: "Água quente", ml: 30 },
    "Achocolatado": { rotulo: "Achocolatado", ml: 30 }, "Sachê de chá": { rotulo: "Chá", un: 0.5, compradoPronto: true },
    "Suco": { rotulo: "Suco", termica: "SUCO", ml: 130 }, "Chá mate gelado": { rotulo: "Chá gelado", termica: "CHA", ml: 80 },
    "Água na refresqueira": { rotulo: "Água", ml: 150 }, "Água sem gás": { rotulo: "Água", un: 1, compradoPronto: true },
    "Água com gás": { rotulo: "Água", un: 1, compradoPronto: true }, "Refrigerante": { rotulo: "Refrigerante", un: 0.7, compradoPronto: true },
    "Refrigerante zero": { rotulo: "Refrigerante", un: 1.3, compradoPronto: true }, "Cerveja": { rotulo: "Cerveja", un: 1.5, baseHoras: 2, compradoPronto: true },
    "Refresqueira de água extra": { rotulo: "Água", un: 0 }
  }, spec("6 Bebidas / Multiplicadores")),
  r2("bebidas.suco_manha", "Suco padrão (manhã e evento de 1 dia)", "Laranja", spec("6 Bebidas")),
  r2("bebidas.suco_rodizio_tarde", "Rodízio do suco da tarde por dia do evento (reinicia)", ["Laranja", "Maracujá", "Caju", "Uva"], spec("6 Bebidas / 11 Revogadas 29/10/2026")),
  r2("bebidas.dupla_rotulos", "Coffee: suco + chá mate gelado são dupla indivisível (rótulos)", ["Suco", "Chá gelado"], spec("6 Bebidas")),
  r2("bebidas.marcas", "Marcas de bebida (demais clientes)", { "Água sem gás": "Água sem gás", "Água com gás": "Água com gás", "Refrigerante": "Coca-Cola", "Refrigerante zero": "Coca-Cola Zero", "Cerveja": "Heineken" }, spec("5 Regras fixas por cliente")),
  r2("bebidas.marcas", "StartSe: só Ambev", { "Água sem gás": "Minalba sem gás", "Água com gás": "Minalba com gás", "Refrigerante": "Pepsi", "Refrigerante zero": "Pepsi Zero", "Cerveja": "Budweiser long neck" }, spec("5 Regras fixas por cliente"), cliente("STARTSE")),
  r2("restricao.cortesia_pax", "Restrição alimentar em cortesia até N pax", 0, spec("5 Regras fixas por cliente")),
  r2("restricao.cortesia_pax", "Inteli: restrição = cortesia 10 pax", 10, spec("5 Regras fixas por cliente"), cliente("INTELI")),
  r2("endereco.fixo", "StartSe: endereço único", "Av. das Nações Unidas, 12901 — CENU Torre Norte, 9º andar, Cidade Monções, São Paulo/SP, 04578-910", spec("6 Endereços fixos"), cliente("STARTSE")),
  r2("endereco.fixo", "WTC: endereço fixo", "Av. das Nações Unidas, 12551 — 6º andar, Brooklin Novo, São Paulo/SP", spec("6 Endereços fixos"), cliente("WTC")),
  r2("endereco.fixo", "Inteli: endereço fixo", "Av. Prof. Almeida Prado, 520, São Paulo/SP", spec("6 Endereços fixos"), cliente("INTELI")),
  r2("contato.fixo", "Inteli: contato fixo", "Gabriel", spec("5 Regras fixas por cliente"), cliente("INTELI")),
  r2("programacao.nome_servico", "Nome do serviço na programação por linha (e período)", {
    "COFFEE_BREAK.MANHA": "Coffee Break da manhã", "COFFEE_BREAK.TARDE": "Coffee Break da tarde", COFFEE_BREAK: "Coffee Break", WELCOME: "Welcome Coffee",
    AUDITORIO: "Auditório", BRUNCH: "Brunch", COQUETEL: "Coquetel", ALMOCO: "Almoço", JANTAR: "Jantar", LUNCH_BOX: "Lunch Box"
  }, spec("6 Layout do documento")),
  r2("programacao.almoco", "Almoço/jantar: rótulo e estação por componente", {
    PROTEINA: { rotulo: "Proteína", estacao: "COZINHA_QUENTE" }, MOLHO: { rotulo: "Molho", estacao: "COZINHA_QUENTE" },
    ACOMPANHAMENTO: { rotulo: "Acompanhamento", estacao: "COZINHA_QUENTE" }, MASSA: { rotulo: "Massa", estacao: "COZINHA_QUENTE" },
    VEGETARIANO: { rotulo: "Vegetariano", estacao: "COZINHA_QUENTE" }, FOLHAS: { rotulo: "Salada", estacao: "COZINHA_FRIA" },
    SALADA_COMPOSTA: { rotulo: "Salada", estacao: "COZINHA_FRIA" }, VEGETAIS: { rotulo: "Salada", estacao: "COZINHA_FRIA" },
    SOBREMESA: { rotulo: "Sobremesa", estacao: "CONFEITARIA" }
  }, spec("7 Roteamento / Dimensionamento"))
];

const COMANDA: RegraInicial[] = [
  r2("roteamento.estacao", "Roteamento por estação e fornecedor (primeira regra que casar; item do cardápio com estação cadastrada vence)", [
    { termos: ["risole de brócolis", "risoles de brócolis", "coxinha de jaca", "coxinha de jaca verde", "salgadinho vegano", "salgadinhos veganos"], estacao: "EXPEDICAO_ALIMENTACAO", fornecedor: "POP_VEGAN", compradoPronto: true },
    { termos: ["quibe frito", "kibe frito", "coxinha", "coxinhas", "bolinha de queijo", "bolinhas de queijo", "risole", "risoles", "esfiha", "esfihas"], estacao: "EXPEDICAO_ALIMENTACAO", fornecedor: "PAD_LETICIA", compradoPronto: true },
    { termos: ["pão de queijo"], estacao: "EXPEDICAO_ALIMENTACAO", compradoPronto: true },
    { termos: ["pão de hh", "pães de hh", "ciabatta", "baguel"], estacao: "COZINHA_FRIA", fornecedor: "PAD_LETICIA" },
    { termos: ["croissant", "croissants", "pão de batata", "pães de batata"], estacao: "CONFEITARIA" },
    { termos: ["torta salgada", "tortas salgadas", "torta de frango", "torta de palmito"], estacao: "COZINHA_QUENTE" },
    { termos: ["quiche", "quiches"], estacao: "CONFEITARIA" },
    { termos: ["petit four", "petit fours"], estacao: "CONFEITARIA" },
    { termos: ["barquete", "tapioca", "shot", "shots"], estacao: "CONFEITARIA" },
    { termos: ["tartelete", "canapé", "vol-au-vent"], tipos: ["DOCE"], estacao: "CONFEITARIA" },
    { termos: ["tartelete", "canapé", "vol-au-vent"], estacao: "COZINHA_QUENTE" },
    { termos: ["verrine"], tipos: ["DOCE"], estacao: "CONFEITARIA" },
    { termos: ["verrine"], estacao: "COZINHA_FRIA" },
    { termos: ["salada de frutas", "frutas laminadas", "mix de castanhas", "castanhas", "samix", "favo de mel", "frutas da tábua"], estacao: "CONFEITARIA" },
    { termos: ["mini lanche", "mini sanduíche"], estacao: "COZINHA_FRIA", fornecedor: "PADARIA_CPL" },
    { termos: ["alecrim", "manjericão", "tomate grape", "pasta base", "homus", "guacamole", "coalhada", "patê", "patês", "wrap", "wraps", "envelope gourmet",
      "salada", "saladas", "aioli", "tramezzino", "pieggi board", "mini cup", "crudités"], estacao: "COZINHA_FRIA" },
    { termos: ["tábua de queijos", "queijos"], estacao: "COZINHA_FRIA", fornecedor: "MERCADO" },
    { termos: ["tábua de frios", "frios"], linhas: ["COFFEE_BREAK", "WELCOME", "AUDITORIO", "BRUNCH", "LUNCH_BOX"], estacao: "COZINHA_FRIA", fornecedor: "MERCADO" },
    { termos: ["tábua de frios", "frios"], estacao: "COZINHA_FRIA", fornecedor: "PAD_LETICIA" },
    { termos: ["mini hambúrguer", "hambúrguer", "batata frita"], estacao: "COZINHA_QUENTE" },
    { termos: ["cup cake", "bebezinho", "bolo", "carolina", "bombom", "queijadinha", "bombocado", "shot", "barquete", "tapioca", "doce", "doces", "mousse", "pudim", "brigadeiro"], estacao: "CONFEITARIA" },
    { termos: ["água sem gás", "água com gás", "minalba", "refrigerante", "coca-cola", "pepsi", "guaraná", "cerveja", "heineken", "budweiser", "sachê de chá"], estacao: "EXPEDICAO_BEBIDAS", compradoPronto: true },
    { termos: ["café", "leite", "água quente", "achocolatado", "chá", "chá gelado", "chá mate", "suco", "água", "refresqueira"], estacao: "EXPEDICAO_BEBIDAS" },
    { termos: ["iogurte", "granola", "aveia", "sucrilhos", "mel", "nhoque"], estacao: "EXPEDICAO_ALIMENTACAO", compradoPronto: true },
    { termos: ["kit"], estacao: "EXPEDICAO_ALIMENTACAO" }
  ], spec("7 Roteamento por estação / por fornecedor / 11 Revogadas 20/10/2026")),
  r2("fornecedores.nomes", "Nome do fornecedor nos documentos", { PAD_LETICIA: "Pad. Letícia", SALGADERIA_LEAL: "Salgaderia Leal", PADARIA_CPL: "Padaria CPL", POP_VEGAN: "POP VEGAN", MERCADO: "Mercado" }, spec("7 Roteamento por fornecedor")),
  r2("comanda.adriana.fornecedores", "Fornecedores listados na página da Adriana (queijos/Mercado nunca)", ["PAD_LETICIA", "SALGADERIA_LEAL", "POP_VEGAN"], spec("7 Página da Adriana")),
  r2("grafia.correcoes", "Erros óbvios de digitação que a comanda corrige (só isso — o resto é fiel à programação)", [
    { de: "catuoiry", para: "catupiry" }, { de: "catupiri", para: "catupiry" }, { de: "catupyri", para: "catupiry" }, { de: "requeijao", para: "requeijão" },
    { de: "brigadeito", para: "brigadeiro" }, { de: "parmesao", para: "parmesão" }, { de: "pao de queijo", para: "pão de queijo" }
  ], spec("7 Regra de fidelidade / Caso 4")),
  r2("comanda.regras_item", "Preparo, alertas e contas dentro do item na comanda (todas as que casarem)", [
    { termos: ["croissant"], estacoes: ["CONFEITARIA"], detalhe: "Recheio sempre 15 g por unidade: metade queijo e metade presunto.", contas: [{ multiplicador: 15, texto: "Recheio total: {n} g" }] },
    { termos: ["carolina tradicional"], estacoes: ["CONFEITARIA", "EXPEDICAO_ALIMENTACAO"], detalhe: "Recheio de doce de leite." },
    { termos: ["chantilly", "banoffee"], estacoes: ["CONFEITARIA"], detalhe: "Chantilly padrão Pieggi: 1 L de CeSiBon bem gelado + 50 a 70 g de leite em pó integral, batidos juntos — nunca CeSiBon puro." },
    { termos: ["banoffee"], detalhe: "Finaliza com chantilly por cima, sem granulado Melken." },
    { termos: ["creme de confeiteiro"], estacoes: ["CONFEITARIA"], detalhe: "Creme de confeiteiro sempre artesanal (leite integral, gemas, açúcar, amido de milho, baunilha) — nunca pronto, em pó ou industrializado." },
    { termos: ["mini cup"], estacoes: ["COZINHA_FRIA"], detalhe: "60 ml por cup." },
    { termos: ["mix de castanhas", "samix"], detalhe: "Padrão SAMIX: cup transparente de 50 ml, base de amendoim sem pele (~80%), no topo 1 castanha-do-pará + 1 caju + 2 amêndoas defumadas + 2 uvas-passas pretas + 2 brancas." },
    { termos: ["wrap", "envelope gourmet"], estacoes: ["COZINHA_FRIA"], detalhe: "Discos de 10\": 4 mini wraps por disco, 10 discos por pacote.", contas: [{ divisor: 4, texto: "{n} discos" }, { divisor: 40, texto: "{n} pacotes" }] },
    { termos: ["tartelete", "verrine"], finalizarConformeImagem: true },
    { termos: ["hambúrguer"], detalhe: "Pré-cozido congelado." },
    { termos: ["batata frita"], detalhe: "Pré-assada; finalizar na air fryer no local." },
    { termos: ["pão de queijo"], detalhe: "Congelado — as copeiras assam no local." },
    { termos: ["salada de frutas"], estacoes: ["CONFEITARIA"], detalhe: "Frutas inteiras ou em pedaços grandes — a equipe corta no local." },
    { termos: ["shot vitaminado"], estacoes: ["CONFEITARIA"], detalhe: "Shake FLUIDO para beber, não pudim: bater leite vegetal + frutas do sabor, um pouco mais líquido. 1 colher de chá rasa de chia a cada 500 ml. Hidratar 30 minutos na geladeira (nunca no forno), mexendo após 10 minutos — nunca fazer na hora. Ajustar com leite vegetal até escorrer fácil da garrafa (banana e abacate engrossam mais). Teste de fluidez com a mistura descansada e gelada: sai da garrafa continuamente, sem sacudir. Enviar separado: shake em garrafa com tampa, refrigerada, 1 por sabor + frutas picadas em potes + mel em bisnaga. No evento: servir em shot de vidro (não verrine PIC), com as frutas em cima; o copo de 60 ml precisa deixar espaço para a fruta." },
    { termos: ["energia solar"], estacoes: ["CONFEITARIA"], detalhe: "Energia Solar: manga + toque de gengibre; manga por cima." },
    { termos: ["pele bonita"], estacoes: ["CONFEITARIA"], detalhe: "Pele Bonita: mamão + laranja; mamão e laranja sem pele por cima." },
    { termos: ["verde força"], estacoes: ["CONFEITARIA"], detalhe: "Verde Força: pouco abacate + maçã verde; maçã verde picadinha por cima." },
    { termos: ["pink fresh"], estacoes: ["CONFEITARIA"], detalhe: "Pink Fresh: morango + manga; morango e manga por cima." },
    { termos: ["banana fit"], estacoes: ["CONFEITARIA"], detalhe: "Banana Fit: base branca só de leite vegetal + chia; banana, chocolate em pó e mel somente por cima, na hora." }
  ], spec("7 Regras de item e de cliente / Shot vitaminado")),
  r2("comanda.materiais", "Materiais por item (sublinhas ticáveis na Expedição — Alimentação); * = item solto em travessa", [
    { rotulos: ["Verrine"], textos: [{ texto: "Sem prato e sem pegador" }, { texto: "Colherinha de verrine", porPax: 1.2 }] },
    { rotulos: ["Shot", "Shot vitaminado"], textos: [{ texto: "Sem prato e sem pegador" }] },
    { rotulos: ["Mini lanche"], textos: [{ texto: "Sem travessa (suporte de balcão); pegador + descanso" }, { texto: "Palito", porUnidade: 1 }] },
    { rotulos: ["Wrap", "Envelope gourmet"], textos: [{ texto: "Palito de wrap", porUnidade: 1 }] },
    { rotulos: ["Cup cake"], textos: [{ texto: "Prato + garfo de bolo, sem pegador" }] },
    { rotulos: ["Salada de frutas"], textos: [{ texto: "Iogurte — bowl + colher" }, { texto: "Granola — bowl + colher" }, { texto: "Aveia — bowl + colher" }, { texto: "Sucrilhos — bowl + colher" }, { texto: "Mel — bowl + colher" }] },
    { rotulos: ["Pão de queijo", "Kit", "Molho"], textos: [] },
    { rotulos: ["*"], textos: [{ texto: "1 pegador + 1 descanso" }] }
  ], spec("7 Materiais por item")),
  r2("comanda.estrutura", "Estrutura e materiais fixos (Expedição — Bebidas, Estrutura e Materiais)", [
    { chave: "BANDEJA_PRETA", texto: "Bandeja preta", fixo: 2, porEvento: true },
    { chave: "BANDEJA_ACRILICA", texto: "Bandeja acrílica", fixo: 2, linhas: ["COQUETEL", "ALMOCO", "JANTAR"] },
    { chave: "CHAMPANHEIRA", texto: "Champanheira", fixo: 1, linhas: ["COQUETEL", "ALMOCO", "JANTAR"], rotulos: ["Refrigerante", "Cerveja"] },
    { chave: "RECHAUD", texto: "Réchaud elétrico (sem gel combustível)", porItensQuentes: 0.5 },
    { chave: "COPO_QUENTE", texto: "Copo descartável para bebida quente + mexedores", porPax: 1.5, rotulos: BEBIDAS_QUENTES },
    { chave: "COPO_VIDRO", texto: "Copo de vidro para suco e refri", porPax: 1.1, rotulos: ["Suco", "Refrigerante", "Chá gelado"] },
    { chave: "SHOT_VIDRO", texto: "Shot de vidro", porPax: 1.1, rotulos: ["Shot", "Shot vitaminado"] },
    { chave: "GELO", texto: "Gelo — pacote de 3 kg", aCadaPax: 25, rotulos: BEBIDAS_GELADAS },
    { chave: "ALCOOL", texto: "Álcool 70% — 1 L", fixo: 1, porEvento: true },
    { chave: "PAPEL", texto: "Rolo de papel", fixo: 1, porEvento: true },
    { chave: "KIT_LIMPEZA", texto: "Kit de limpeza (detergente, esponja, pano de chão, rodo, papel toalha, álcool 70%)", fixo: 1 },
    { chave: "UNIFORME", texto: "Uniforme, luvas e toucas (por freelancer)", porFreelancer: 1 },
    { chave: "FORNO", texto: "Forno elétrico para assar pão de queijo", fixo: 1 },
    { chave: "TRANSFORMADOR", texto: "Transformador", fixo: 1 }
  ], spec("7 Quantidades fixas / Ponto fixo StartSe × demais")),
  r2("comanda.ponto_fixo.nao_enviar", "Ponto fixo: itens de estrutura que não vão (demais clientes: vai tudo)", [], spec("7 Ponto fixo StartSe × demais")),
  r2("comanda.ponto_fixo.nao_enviar", "StartSe: sem gelo, kit de limpeza, uniforme, forno e transformador", ["GELO", "KIT_LIMPEZA", "UNIFORME", "FORNO", "TRANSFORMADOR"], spec("7 Ponto fixo StartSe × demais"), cliente("STARTSE")),
  r2("comanda.apoio_identificacao", "Bloco fixo APOIO E IDENTIFICAÇÃO (toda comanda)", [
    "1 arranjo de flores", "1 extensão", "2 rádios comunicadores (enviar carregados)", "2 fones para rádio", "1 encadernado impresso da biblioteca Pieggi",
    "1 saquinho com a programação impressa + plaquinhas impressas", "1 bloco de etiquetas impressas: {cliente} — {evento}",
    "5 caixas etiquetadas ({cliente} — {evento} — {data}): LOUÇAS · PEGADORES E UTENSÍLIOS · DESCARTÁVEIS · BEBIDAS · IDENTIFICAÇÃO E APOIO"
  ], spec("7 Bloco fixo APOIO E IDENTIFICAÇÃO")),
  r2("comanda.textos", "Títulos fixos da comanda", {
    compradosProntos: "Itens Comprados Prontos", apoio: "APOIO E IDENTIFICAÇÃO", estrutura: "ESTRUTURA E MATERIAIS", termica: "Enviar limpa/escaldada",
    pastaBase: "Pasta base de lanche e wrap", frutasTabua: "Frutas da tábua (só enfeite — não é para comer nem repor)"
  }, spec("7 Páginas de expedição")),
  r2("comanda.avisos", "Tarjas fixas por página (* = todas menos a da Adriana)", {
    "*": ["DIA E HORÁRIO DA SAÍDA: ______ (perguntar pra Adriana e anotar aqui)"],
    EXPEDICAO_ALIMENTACAO: ["MOTORISTAS: ANTES DE LEVAR, CHAMAR AS RESPONSÁVEIS PARA VALIDAR", "COPEIRAS: antes do início do evento — TICAR TUDO, FOTOGRAFAR e cobrar o Luiz no zap dele se faltou algo."],
    EXPEDICAO_BEBIDAS: ["MOTORISTAS: ANTES DE LEVAR, CHAMAR AS RESPONSÁVEIS PARA VALIDAR", "COPEIRAS: antes do início do evento — TICAR TUDO, FOTOGRAFAR e cobrar o Luiz no zap dele se faltou algo."]
  }, spec("7 Páginas de expedição")),
  r2("comanda.avisos_almoco", "Tarjas de almoço e jantar ({horas} = almoco.amostra_vigilancia_horas)", {
    COZINHA_QUENTE: [PESAGEM, "AMOSTRA DA VIGILÂNCIA: antes de sair, guardar na Pieggi uma pequena porção de cada item quente, em saquinho com nome do item, evento, data e hora, congelada por {horas} horas.", "MARMITA DA EQUIPE PIEGGI (à parte do buffet): ____ pessoas — perguntar quantas são."],
    COZINHA_FRIA: [PESAGEM], CONFEITARIA: [PESAGEM], EXPEDICAO_ALIMENTACAO: ["Réchaud com fundo de molho, carne aparente, reposição aos poucos."]
  }, spec("7 Dimensionamento de almoço e jantar")),
  r2("comanda.avisos_cliente", "Tarjas próprias do cliente por página", {}, spec("7 Regras de item e de cliente")),
  r2("comanda.avisos_cliente", "Zup: nenhum molho picante", { COZINHA_QUENTE: ["ZUP: nenhum molho pode ficar picante."] }, spec("7 Regras de item e de cliente"), cliente("ZUP")),
  r2("comanda.avisos_cliente", "Banco Neon: forminha pétala azul", { CONFEITARIA: ["BANCO NEON: mini doces sempre em forminha pétala azul de papel."] }, spec("7 Regras de item e de cliente"), cliente("NEON")),
  r2("comanda.avisos_cliente", "StartSe: térmicas em rodízio", { EXPEDICAO_BEBIDAS: ["StartSe tem onde lavar: no auditório com reposição contínua, enviar menos garrafas térmicas e fazer rodízio (reabastecer e lavar no local). Equipamentos e louças podem ser reutilizados entre serviços e dias."] }, spec("7 Ponto fixo StartSe × demais"), cliente("STARTSE")),
  r2("comanda.pasta_base", "Pasta base de lanche e wrap: ~20 g por unidade, linha própria na Cozinha Fria", { gPorUnidade: 20, rotulos: ["Mini lanche", "Wrap", "Envelope gourmet"], receita: "Receita: 2,5 kg de ricota + 1 kg de requeijão + 1 kg de muçarela = ~4,5 kg." }, spec("7 Regras de item e de cliente"))
];

const GLOSSARIO: Record<string, [string, string]> = {
  "MINI LANCHE": ["SANDWICH", "SÁNDWICH"], "CUP CAKE": ["CUPCAKE", "CUPCAKE"], "PETIT FOUR": ["PETIT FOUR", "PETIT FOUR"], "PÃO DE QUEIJO": ["CHEESE BREAD", "PAN DE QUESO"],
  CROISSANT: ["CROISSANT", "CROISSANT"], CAROLINA: ["CREAM PUFF", "CAROLINA"], "TÁBUA DE FRIOS": ["COLD CUTS", "TABLA DE FIAMBRES"], "TÁBUA DE QUEIJOS": ["CHEESE BOARD", "TABLA DE QUESOS"],
  "SALADA DE FRUTAS": ["FRUIT SALAD", "ENSALADA DE FRUTAS"], TAPIOCA: ["TAPIOCA", "TAPIOCA"], HOMUS: ["HUMMUS", "HUMUS"], TARTELETE: ["TARTLET", "TARTALETA"],
  VERRINE: ["VERRINE", "VERRINE"], SHOT: ["SHOT", "SHOT"], "SHOT VITAMINADO": ["SMOOTHIE SHOT", "SHOT DE BATIDO"], WRAP: ["WRAP", "WRAP"],
  "ENVELOPE GOURMET": ["GOURMET WRAP", "WRAP GOURMET"], "MINI CUP": ["MINI CUP", "MINI VASO"], BOLO: ["CAKE", "BIZCOCHO"], QUEIJADINHA: ["COCONUT CHEESE TART", "QUESADILLA DE COCO"],
  BOMBOM: ["BONBON", "BOMBÓN"], "PÃO DE BATATA": ["POTATO BREAD", "PAN DE PAPA"], "PIEGGI BOARD": ["PIEGGI BOARD", "PIEGGI BOARD"], QUICHE: ["QUICHE", "QUICHE"],
  TRAMEZZINO: ["TRAMEZZINO", "TRAMEZZINO"], "MIX DE CASTANHAS": ["MIXED NUTS", "MIX DE FRUTOS SECOS"], "FRUTAS LAMINADAS": ["SLICED FRUIT", "FRUTAS LAMINADAS"],
  "FAVO DE MEL": ["HONEYCOMB", "PANAL DE MIEL"], ADICIONAIS: ["TOPPINGS", "ADICIONALES"], SOBREMESA: ["DESSERT", "POSTRE"],
  Cenoura: ["Carrot", "Zanahoria"], "Limão": ["Lemon", "Limón"], "Maracujá": ["Passion Fruit", "Maracuyá"], Goiaba: ["Guava", "Guayaba"], Frango: ["Chicken", "Pollo"],
  Peru: ["Turkey", "Pavo"], Presunto: ["Ham", "Jamón"], "Frango defumado": ["Smoked Chicken", "Pollo Ahumado"], "Lombo canadense": ["Canadian Pork Loin", "Lomo Canadiense"],
  Laranja: ["Orange", "Naranja"], Churros: ["Churros", "Churros"], Caju: ["Cashew Fruit", "Marañón"], Uva: ["Grape", "Uva"], Tradicional: ["Traditional", "Tradicional"], Integral: ["Whole Grain", "Integral"],
  "Multigrãos": ["Multigrain", "Multigrano"], Gergelim: ["Sesame", "Sésamo"], Quinoa: ["Quinoa", "Quinua"], "Parmesão": ["Parmesan", "Parmesano"],
  Ferradura: ["Horseshoe Cookie", "Herradura"], Serquilho: ["Sequilho Cookie", "Galleta Sequillo"], "Cristal de goiaba": ["Guava Crystal", "Cristal de Guayaba"],
  "Unha de gato": ["Cat's Claw Cookie", "Uña de Gato"], "Dedo de moça": ["Ladyfinger Cookie", "Dedo de Dama"], Mentirinha: ["Mentirinha Cookie", "Galleta Mentirinha"],
  Queijo: ["Cheese", "Queso"], Calabresa: ["Calabrese Sausage", "Longaniza Calabresa"], "Presunto e queijo": ["Ham & Cheese", "Jamón y Queso"], Catupiry: ["Catupiry Cheese", "Queso Catupiry"],
  Parma: ["Parma Ham", "Jamón de Parma"], Copa: ["Coppa", "Coppa"], Pastrami: ["Pastrami", "Pastrami"], "Salame comum": ["Salami", "Salami"], Provolone: ["Provolone", "Provolone"],
  "Gruyère": ["Gruyère", "Gruyère"], Gorgonzola: ["Gorgonzola", "Gorgonzola"], Brie: ["Brie", "Brie"], "Muçarela de búfala": ["Buffalo Mozzarella", "Mozzarella de Búfala"]
};

const PLAQUINHA: RegraInicial[] = [
  r2("glossario", "Glossário de tradução PT → [EN, ES] (categoria em caixa alta, sabor como escrito)", GLOSSARIO, spec("8 Glossário de tradução")),
  r2("plaquinha.sem_card", "Itens que não geram plaquinha (rótulo próprio, embalagem, enfeite, molho à parte)", {
    rotulos: ["Água", "Refrigerante", "Cerveja", "Vinho", "Kit", "Molho", "Chá", "Favo de mel"],
    termos: ["heinz", "sachê", "açúcar", "adoçante", "mexedor", "mexedores", "água saborizada", "croutons", "frutas da tábua", "garrafinha"]
  }, spec("8 Itens que não geram plaquinha")),
  r2("plaquinha.bebidas_padrao", "Bebidas de refresqueira/térmica: categoria no título, sabor no subtítulo (chá gelado nunca leva sabor)", {
    "Café": { titulo: "CAFÉ", en: "COFFEE", es: "CAFÉ", sabor: ["TRADICIONAL", "Traditional", "Tradicional"], selo: null },
    "Leite": { titulo: "LEITE", en: "MILK", es: "LECHE", sabor: ["QUENTE", "Hot", "Caliente"], selo: "VEGETARIANO" },
    "Achocolatado": { titulo: "ACHOCOLATADO", en: "CHOCOLATE MILK", es: "ACHOCOLATADO", sabor: ["EM PÓ", "Powdered", "En Polvo"], selo: "VEGETARIANO" },
    "Água quente": { titulo: "ÁGUA QUENTE", en: "HOT WATER", es: "AGUA CALIENTE", sabor: ["PARA CHÁ", "For Tea", "Para Té"], selo: null },
    "Suco": { titulo: "SUCO", en: "JUICE", es: "JUGO", sabor: ["LARANJA", "Orange", "Naranja"], selo: "VEGANO" },
    "Chá gelado": { titulo: "CHÁ", en: "TEA", es: "TÉ", sabor: ["GELADO", "Iced", "Helado"], selo: "VEGANO", saborFixo: true }
  }, spec("8 Bebidas padrão")),
  r2("plaquinha.excecao_vegetariano", "Mini lanche vegetariano: título VEGETARIANO, subtítulo = recheio", { rotulo: "Mini lanche", titulo: "VEGETARIANO" }, spec("8 Hierarquia do texto")),
  r2("plaquinha.juntar_sabores", "Rótulos com todos os sabores do dia numa plaquinha só (título com os sabores)", ["Pão de queijo", "Petit four"], spec("8 Agrupamentos")),
  r2("plaquinha.nunca_sem_gluten", "Rótulos que nunca levam selo sem glúten", ["Pão de queijo"], spec("8 Agrupamentos")),
  r2("plaquinha.sem_subtitulo", "Rótulos sem subtítulo (prato de almoço/jantar: o nome inteiro é o título)", ["Proteína", "Acompanhamento", "Massa", "Vegetariano", "Salada", "Sobremesa", "Salada de frutas", "Frutas laminadas"], spec("8 Agrupamentos")),
  r2("plaquinha.cards_extras", "Cards extras por rótulo (salada de frutas = sempre 2 cards)", {
    "Salada de frutas": [{ titulo: "IOGURTE, GRANOLA, AVEIA, SUCRILHOS E MEL", subtitulo: "ADICIONAIS", en: "TOPPINGS / Yogurt, Granola, Oats, Cereal & Honey", es: "ADICIONALES / Yogur, Granola, Avena, Cereal y Miel", selos: [] }]
  }, spec("8 Agrupamentos / Caso 3")),
  r2("plaquinha.decisoes", "Decisões de item já fechadas (título, subtítulo, sabor e tradução)", [
    { termos: ["bombocado"], titulo: "BOMBOCADO", subtitulo: null, en: "BOMBOCADO", es: "BOMBOCADO" },
    { termos: ["hambúrguer"], titulo: "CHEESEBURGER", subtitulo: null, en: "CHEESEBURGER", es: "HAMBURGUESA CON QUESO" },
    { termos: ["milho na folha"], titulo: "MILHO", subtitulo: "BOLO", en: "CAKE / Corn", es: "BIZCOCHO / Maíz" },
    { termos: ["salada de frutas"], titulo: "SALADA DE FRUTAS", subtitulo: null, en: "FRUIT SALAD", es: "ENSALADA DE FRUTAS" },
    { termos: ["gergelim preto"], sabor: "Gergelim" },
    { termos: ["vegetariano i"], sabor: "Cenoura" }, { termos: ["vegetariano ii"], sabor: "Maçã verde" }, { termos: ["vegetariano iii"], sabor: "Pesto de rúcula" }
  ], spec("8 Decisões de item já fechadas / Grafia oficial"))
];

const PROPOSTA: RegraInicial[] = [
  r2("proposta.textos", "Redação fixa do orçamento ({percentual}, {valor})", {
    taxa: "Taxa de serviço ({percentual})", logistica: "Logística", desconto: "Desconto", cortesia: "Cortesia", louca: "Louça premium (opcional, não incluída no total)", loucaValor: "R$ {valor} por pessoa"
  }, spec("5 Orçamento")),
  r2("proposta.ocultar_por_pessoa", "Orçamento sem valor por pessoa", false, spec("5 Orçamento")),
  r2("proposta.ocultar_por_pessoa", "StartSe: sem valor por pessoa nem nome de linha Pieggi", true, spec("5 Orçamento"), cliente("STARTSE")),
  r2("proposta.ocultar_quantidades", "Cardápio da proposta sem quantidades", false, spec("5 Orçamento")),
  r2("proposta.ocultar_quantidades", "Celebrar: propostas não mostram quantidades", true, spec("5 Orçamento"), cliente("CELEBRAR")),
  r2("proposta.termos_proibidos", "Termos que não podem aparecer no orçamento do cliente (linha removida ou aviso)", { remover: [], avisar: [] }, spec("5 Orçamento")),
  r2("proposta.termos_proibidos", "StartSe: sem linha de flores; sem nome de linha Pieggi", { remover: ["flores", "arranjo de flores"], avisar: ["basic", "standard", "executive", "master", "premium"] }, spec("5 Orçamento / Regras fixas por cliente"), cliente("STARTSE")),
  r2("proposta.louca_premium_linhas", "Louça premium só aparece como opcional em almoço e jantar", ["ALMOCO", "JANTAR"], spec("4 Taxas")),
  r2("preco.avulso.CAFE_GARRAFA", "Avulso — Café, garrafa cheia de 1,5 L (custo ÷ 0,30 da planilha; confirmar preço)", 78, spec("4 Venda por unidade"), { ...PENDENTE, financeiro: true }),
  r2("avulso.cafe_litros_garrafa", "Avulso: café vendido por garrafa cheia (L), nunca fracionado", 1.5, spec("4 Venda por unidade")),
  r2("avulso.texto_servico", "Avulso: linha única de serviço (copeira) no orçamento", "Serviço", spec("4 Venda por unidade"))
];

const CORRECOES_V1: RegraInicial[] = [
  {
    codigo: "vocabulario_travado", titulo: "Termos que o sistema nunca escreve (exato = só a palavra inteira, maiúscula)", origem: spec("11 Vocabulário travado"),
    valor: [
      { proibido: "cumbuca", correto: "travessa" }, { proibido: "bolo redondo", correto: "bolo inteiro" },
      { proibido: "mini sanduíche de pão de forma", correto: "tramezzino" }, { proibido: "chef decide", correto: "peso calculado" },
      { proibido: "confeiteiro decide", correto: "peso calculado" }, { proibido: "brioche ce", correto: "brioche de cenoura" },
      { proibido: "brioche integral", correto: "brioche de cenoura" }, { proibido: "CE", correto: "cenoura", exato: true }
    ]
  },
  {
    codigo: "lista_negra", titulo: "Itens proibidos em proposta, programação, comanda e plaquinha", origem: spec("11 Lista negra"),
    valor: [
      { termo: "atum", motivo: "Só quando o cliente pedir explicitamente; nunca em cardápio sugerido." },
      { termo: "wrap de abacate", motivo: "Umedece o pão." }, { termo: "abacate & tomate", motivo: "Wrap de abacate umedece o pão." },
      { termo: "red velvet", motivo: "Fora do cardápio." }, { termo: "risoto", motivo: "Não existe no cardápio Pieggi." },
      { termo: "tramezzino", motivo: "Não usar tramezzino em proposta.", apenas: ["PROPOSTA"] }, { termo: "coquetel essencial", motivo: "Linha inexistente; use a versão boteco." },
      { termo: "can-018", motivo: "Item extinto (Mini Tortinha Folhada de Guacamole)." }, { termo: "tortinha folhada de guacamole", motivo: "Item extinto (CAN-018)." },
      { termo: "coxinha", motivo: "Salgado caseiro frito fica abaixo do padrão em proposta.", apenas: ["PROPOSTA"] }, { termo: "risole", motivo: "Salgado caseiro frito fica abaixo do padrão em proposta.", apenas: ["PROPOSTA"] },
      { termo: "esfiha", motivo: "Fora do padrão Pieggi." }, { termo: "bolinha de queijo", motivo: "Salgado caseiro frito fica abaixo do padrão em proposta.", apenas: ["PROPOSTA"] },
      { termo: "brioche integral", motivo: "Descontinuado; use pão de cenoura nos vegetarianos." }, { termo: "pizza", motivo: "Fora do padrão em coquetel e festa." },
      { termo: "pipoca gourmet", motivo: "Fora do padrão em coquetel e festa." }, { termo: "estrogonofe", motivo: "Fora do padrão em coquetel e festa." },
      { termo: "banana inteira", motivo: "Fruta inteira em qualquer tier — sempre salada de frutas." }, { termo: "maçã inteira", motivo: "Fruta inteira em qualquer tier — sempre salada de frutas." }
    ]
  }
];

/** Carga 3 (migration 20261109107000): fluxo guiado do evento — checklist das copeiras, padrões da programação gerada e tabela por cliente. */
export const REGRAS_V3: RegraInicial[] = [
  r2("programacao.checklist", "Checklist das copeiras na página 1 da programação", {
    checklistTitulo: "CHECKLIST COPEIRAS",
    checklist: [
      {
        titulo: "(A) Montagem/entrega, por serviço",
        texto: "Fotografar cada mesa montada e enviar ao Luiz (WhatsApp) +55 11 97603-8194; faltando algo, avisar o Luiz.",
        itens: ["Auditório montado com café e águas", "Coffee da manhã", "Almoço", "Coffee da tarde", "Refresqueiras de suco e chá abastecidas", "Acompanhamentos (açúcar, adoçante, achocolatado, sachê de chá)"]
      },
      { titulo: "(B) Higienização e apresentação", itens: ["Talheres, pratos, copos e louças sem mancha", "Álcool 70% antes de expor", "Limpar bicos", "Verrines, doces e cupcakes limpos", "Nescau limpo e seco", "Escaldar garrafas"] },
      { titulo: "(C) Lavagem para ir embora", itens: ["Retirar restos com papel toalha antes de lavar", "Não jogar alimento na pia do cliente"] }
    ]
  }, spec("6 Checklist Copeiras")),
  r2("programacao.padroes", "Programação gerada: saída (min antes do início) e roteiro de campo padrão (base INICIO/MEIO/FIM ± minutos) — confirmar com a operação", {
    saidaAntesMin: 120,
    roteiro: [
      { tipo: "MONTAGEM", titulo: "Montagem e higienização da mesa", orientacao: "Montar conforme a programação e fotografar a mesa pronta.", base: "INICIO", minutos: -60 },
      { tipo: "REPOSICAO", titulo: "Reposição", orientacao: "Repor itens e bebidas conforme a programação.", base: "MEIO", minutos: 0 },
      { tipo: "DESMONTAGEM", titulo: "Desmontagem e lavagem", orientacao: "Recolher, lavar conforme o checklist e conferir o retorno.", base: "FIM", minutos: 30 }
    ]
  }, spec("6 Programação / 13 Logística"), PENDENTE),
  r2("tabela_preco.padrao", "Tabela de preço padrão (demais clientes)", "EXTERNOS", spec("4 Tabelas de preço")),
  r2("tabela_preco.padrao", "StartSe: tabela StartSe-Atual", "STARTSE_ATUAL", spec("4 Tabelas de preço"), cliente("STARTSE")),
  r2("tabela_preco.padrao", "Inteli: tabela StartSe-Atual (confirmar)", "STARTSE_ATUAL", spec("4 Tabelas de preço"), { ...cliente("INTELI"), ...PENDENTE }),
  r2("tabela_preco.padrao", "WTC: tabela WTC", "WTC", spec("4 Tabelas de preço"), cliente("WTC"))
];

/** Carga 2: regras novas e novas versões de regras da carga 1. */
export const REGRAS_V2: RegraInicial[] = [...CARDAPIO, ...COMANDA, ...PLAQUINHA, ...PROPOSTA, ...CORRECOES_V1];

/** Carga 1 (migration 20261108101000). Congelada: pode já estar aplicada — regra nova vai em REGRAS_V2. */
export const REGRAS_INICIAIS: RegraInicial[] = [...COMERCIAL, ...OPERACIONAL];

// ================================================================ Carga 4 (migration 20261109108000)
// Regras dos documentos de Documentos/Pieggi (jul–nov/2026) que a especificação não cobre, pendências que os documentos
// respondem e novas versões. A especificação (05/11/2026) é a mais recente: onde ela fala do assunto, ela vence
// (ver docs/regras-rastreabilidade.md). Mudança de código existente vale a partir de 2026-11-09 (não retroage).
const MUDANCA = "2026-11-09";
const doc = (arquivo: string, data: string, nota = "") => `Documentos/Pieggi/${arquivo} (${data})${nota ? ` — ${nota}` : ""}`;
const v4 = (codigo: string, titulo: string, valor: unknown, origem: string, vigenteDesde: string, opcoes: Opcoes = {}): RegraInicial =>
  ({ codigo, titulo, valor, origem, vigenteDesde, ...opcoes });
const valorV2 = <T>(codigo: string, escopoChave?: string): T => {
  const r = [...CARDAPIO, ...COMANDA, ...PLAQUINHA, ...PROPOSTA, ...CORRECOES_V1].reverse().find((x) => x.codigo === codigo && (x.escopoChave ?? undefined) === escopoChave);
  if (!r) throw new Error(`Regra ${codigo} não está na carga 2`);
  return structuredClone(r.valor) as T;
};
const FIN: Opcoes = { financeiro: true };
const GP = "Gerador de Proposta/Regras/";
const CL = `${GP}documentos/claude/`;
const PR = "Produção/Regras/docs/claude/";
const TAB_EXT = doc(`${GP}Pieggi__Coffee_Break__Tabela_de_pre_o__EXTERNOS.pdf`, "16/01/2026");
const TAB_WTC_COFFEE = doc(`${GP}Pieggi__Coffee_Break__Tabela_WTC.pdf`, "03/02/2026");
const TAB_WTC_ALIM = doc(`${GP}Pieggi__Alimenta__o__Tabela_WTC.pdf`, "03/02/2026");
const TAB_FIXOS = doc(`${GP}Pieggi__Coffee_Break__Tabela_fixos_StartSe_e_Inteli_em_negociacao.pdf`, "16/01/2026");
const TAB_COQUETEL = doc(`${GP}Pieggi__Coquetel__Tabela_de_pre_o.pdf`, "25/05/2026");
const AGUAS = doc(`${CL}ADENDO_01-09-2026_Aguas_Pieggi.md`, "01/09/2026");
const MATRIZ = doc(`${CL}ADENDO_08-09-2026_Procedencia_e_Matriz_de_Bases.md`, "08/09/2026");
const BRUNCH = `${doc(`${GP}Pieggi__Alimenta__o__Tabela_de_pre_o__EXTERNOS.pdf`, "16/01/2026")}; ${doc("Programação/Regras e contexto/PieggiCardapioBrunchStandard052025.pdf", "05/2025")}; ${doc("Programação/Regras e contexto/PieggiCardapioBrunchPremium052025.pdf", "05/2025")}`;

const precoV4 = (tabela: string, linhaServico: string, tier: string, valor: number | Record<string, number>, origem: string, vigencia: string) =>
  v4(`preco.${tabela}.${linhaServico}.${tier}`, `Preço por pax — ${tabela} · ${linhaServico} · ${tier}`, valor, origem, vigencia, FIN);
const avulsoV4 = (chave: string, titulo: string, valor: number, origem: string, vigencia: string) =>
  v4(`preco.avulso.${chave}`, `Avulso — ${titulo}`, valor, origem, vigencia, FIN);

// Bebidas por linha: refrigerante sai do cadastro (0,7 normal + 1,3 zero = 2 latas/pax, 35/65).
const SUCO_AGUA_REFRI = [{ nome: "Suco", ml: 150 }, { nome: "Água na refresqueira", ml: 150 }, { nome: "Refrigerante" }, { nome: "Refrigerante zero" }];

// Itens novos do cardápio (coquetel e brunch) — carregados pela mesma migration; grupo/nome = chave idempotente.
export interface ItemCardapioNovo {
  familia: string; grupo: string; categoria: string; tier: string; nome: string; ingredientes: string; unidade: string;
  nomeEn: string; nomeEs: string; selo: "VEGANO" | "VEGETARIANO" | null; estacao: string; fornecedor: string | null;
}
const ESTACOES_COQUETEL = "ESTAÇÕES";
const item = (grupo: string, tier: string, nome: string, ingredientes: string, en: string, es: string, selo: ItemCardapioNovo["selo"], estacao: string, familia = "COQUETEL E BRUNCH"): ItemCardapioNovo =>
  ({ familia, grupo, categoria: grupo, tier, nome, ingredientes, unidade: "unidade", nomeEn: en, nomeEs: es, selo, estacao, fornecedor: null });
export const CARDAPIO_V4: ItemCardapioNovo[] = [
  item(ESTACOES_COQUETEL, "BASIC", "Guacamole com Doritos", "Guacamole em bowl médio; Doritos em travessa ao lado", "Guacamole with Doritos", "Guacamole con Doritos", "VEGANO", "COZINHA_FRIA"),
  item(ESTACOES_COQUETEL, "BASIC", "Homus com pão sírio", "Homus em bowl médio; pão sírio em travessa forrada ao lado", "Hummus with Pita Bread", "Humus con Pan Árabe", "VEGANO", "COZINHA_FRIA"),
  item(ESTACOES_COQUETEL, "BASIC", "Coalhada no repolho roxo com quibe e crudités", "Coalhada dentro do repolho roxo; quibe frito e crudités de vegetais ao lado", "Labneh with Kibbeh & Crudités", "Jocoque con Kibbeh y Crudités", null, "COZINHA_FRIA"),
  item(ESTACOES_COQUETEL, "STANDARD", "Pães diversos com patês de azeitona preta e de tomate seco", "Patês em bowls pequenos; pães e torradas em cesta forrada ao lado", "Assorted Breads with Black Olive & Sun-Dried Tomato Spreads", "Panes Variados con Patés de Aceituna Negra y Tomate Seco", "VEGETARIANO", "COZINHA_FRIA"),
  item(ESTACOES_COQUETEL, "BASIC", "Mix de folhas com tomatinhos", "Mix de folhas com tomate-cereja em formato finger food", "Mixed Greens with Cherry Tomatoes", "Mix de Hojas con Tomates Cherry", "VEGANO", "COZINHA_FRIA"),
  item(ESTACOES_COQUETEL, "MASTER", "Burrata com tomates confitados", "Burrata, tomates confitados, acompanha torradas", "Burrata with Confit Tomatoes", "Burrata con Tomates Confitados", "VEGETARIANO", "COZINHA_FRIA"),
  item(ESTACOES_COQUETEL, "MASTER", "Terrine de tomates secos confitados e pesto", "Terrine, acompanha torradas", "Sun-Dried Tomato & Pesto Terrine", "Terrina de Tomates Secos y Pesto", "VEGETARIANO", "COZINHA_FRIA"),
  item(ESTACOES_COQUETEL, "PREMIUM", "Brie folhado com nuts de caramelo salgado", "Brie em massa folhada, nuts de caramelo salgado, acompanha torradas", "Puff Pastry Brie with Salted Caramel Nuts", "Brie Hojaldrado con Nueces de Caramelo Salado", "VEGETARIANO", "COZINHA_QUENTE"),
  item("MINI HAMBÚRGUER", "STANDARD", "Mini hambúrguer com queijo, batata frita, alface e maionese", "Pré-cozido congelado; batata frita pré-assada (air fryer no local); bowls de alface e maionese", "Cheeseburger", "Hamburguesa con Queso", null, "COZINHA_QUENTE"),
  item("TORTAS E QUICHES", "BASIC", "Torta salgada de frango", "Torta salgada grande de frango", "Chicken", "Pollo", null, "COZINHA_QUENTE"),
  item("TORTAS E QUICHES", "BASIC", "Torta salgada de palmito", "Torta salgada grande de palmito", "Heart of Palm", "Palmito", "VEGETARIANO", "COZINHA_QUENTE"),
  item("TORTAS E QUICHES", "BASIC", "Quiche de queijo", "Quiche grande de queijo", "Cheese", "Queso", "VEGETARIANO", "CONFEITARIA"),
  item("TORTAS E QUICHES", "BASIC", "Quiche de alho-poró", "Quiche grande de alho-poró", "Leek", "Puerro", "VEGETARIANO", "CONFEITARIA")
];

const listaNegraV1 = () => (CORRECOES_V1.find((r) => r.codigo === "lista_negra")!.valor as Array<Record<string, unknown>>).map((x) => ({ ...x }));

export const REGRAS_V4: RegraInicial[] = [
  // ---------- Pendências que os documentos respondem
  v4("qtd.bebidas.aplica_reposicao", "Bebidas NÃO recebem ×1,6 com reposição (bebida não escala)", false, AGUAS, MUDANCA),
  v4("qtd.frutas_laminadas", "Frutas laminadas em almoço/jantar Executive e Master: 50 g/pax servido (sem favo de mel)", { gPorPax: 50, tiers: ["EXECUTIVE", "MASTER"] },
    `${doc(`${PR}regras-comanda-conversao-cru-pronto-jul2026.md`, "07/2026")}; ${doc(`${CL}Claudinho_Proposta_regras_vigentes.md`, "03/09/2026")}`, MUDANCA),
  v4("almoco.amostra_vigilancia_horas", "Amostra da Vigilância: 72 horas congelada (confirmado pelo Bruno)", 72,
    doc(`${PR}evento-ipt-almoco-05out2026-decisoes.md`, "01/10/2026", "a especificação revogou 96 h"), MUDANCA),
  v4("preco.avulso.CAFE_GARRAFA", "Avulso — Café, garrafa cheia de 1,5 L", 70,
    `${doc(`${CL}STATUS_Senac_Santo_Amaro_22-23-09_Bruna.md`, "09/2026")}; ${doc(`${CL}STATUS_3C_Gaming_Cafe_da_Manha_Diario_Beatriz.md`, "09/2026")}`, MUDANCA, FIN),
  v4("tabela_preco.padrao", "Inteli: tabela StartSe-Atual (tabela única \"fixos StartSe e Inteli\")", "STARTSE_ATUAL", TAB_FIXOS, MUDANCA, cliente("INTELI")),
  v4("pacote", "Brunch: itens escolhidos (tortas, quiche, lanche, tapioca, pastas, folhas) + 2 verrines + salada de frutas + bebidas; o tier de cima soma tábuas, favo de mel e bolo",
    { BASIC: ["LIVRE", "VERRINE", "SALADA_FRUTAS", "BEBIDAS"], "*": ["LIVRE", "VERRINE", "TABUAS", "SALADA_FRUTAS", "BEBIDAS"] }, BRUNCH, MUDANCA, linha("BRUNCH")),
  v4("bebidas.padrao", "Bebidas do brunch: suco e água na refresqueira (150 ml/pax) + refrigerante em lata normal e zero", SUCO_AGUA_REFRI, BRUNCH, MUDANCA, linha("BRUNCH")),
  v4("bebidas.padrao", "Bebidas do almoço: suco e água na refresqueira (150 ml/pax) + refrigerante em lata normal e zero", SUCO_AGUA_REFRI,
    doc(`${GP}Pieggi__Alimenta__o__Tabela_de_pre_o__EXTERNOS.pdf`, "16/01/2026"), MUDANCA, linha("ALMOCO")),
  v4("bebidas.padrao", "Bebidas do jantar: suco e água na refresqueira (150 ml/pax) + refrigerante em lata normal e zero", SUCO_AGUA_REFRI,
    doc(`${GP}Pieggi__Alimenta__o__Tabela_de_pre_o__EXTERNOS.pdf`, "16/01/2026"), MUDANCA, linha("JANTAR")),

  // ---------- Quantidades e composição
  v4("bebidas.padrao", "Bebidas do coffee break (ml/pax): Basic também leva água quente e sachê de chá (padrão único 01/09)", [
    { nome: "Café", regra: "qtd.cafe.ml_por_pax" }, { nome: "Leite", ml: 30 }, { nome: "Água quente", ml: 30 },
    { nome: "Sachê de chá", un: 0.5 }, { nome: "Suco", ml: { BASIC: 100, "*": 130 }, rodizio: true }, { nome: "Chá mate gelado", ml: 80 }
  ], AGUAS, MUDANCA, linha("COFFEE_BREAK")),
  v4("bebidas.padrao", "Bebidas do Welcome (ml/pax): café, leite, sachê de chá com água quente e água saborizada Pieggi na refresqueira", [
    { nome: "Café", ml: 50 }, { nome: "Leite", ml: 15 }, { nome: "Água quente", ml: 15 }, { nome: "Sachê de chá", un: 0.5 }, { nome: "Água saborizada", ml: 150 }
  ], `${AGUAS}; ${TAB_EXT}`, MUDANCA, linha("WELCOME")),
  v4("bebidas.padrao", "Bebidas do coquetel/HH: suco e água na refresqueira 150 ml/pax, refrigerante em lata (2/pax) e cerveja (todo HH leva cerveja)", [
    ...SUCO_AGUA_REFRI, { nome: "Cerveja" }
  ], `${TAB_COQUETEL}; ${doc(`${PR}trava-programacao-versao-e-calculo-por-dose-03set2026.md`, "03/09/2026")}`, MUDANCA, linha("COQUETEL")),
  v4("bebidas.cadastro", "Cadastro de bebida (+ água saborizada Pieggi: limão-siciliano e hortelã, na refresqueira, sem plaquinha)", {
    ...valorV2<Record<string, unknown>>("bebidas.cadastro"), "Água saborizada": { rotulo: "Água", ml: 150 }
  }, AGUAS, MUDANCA),
  v4("qtd.verrine", "Verrine no coffee break: pax × 1,1 dividido entre 2 sabores (só quando escolhida)", { porPax: 1.1, sabores: 2, sugerirLinhas: [] }, MATRIZ, MUDANCA, linha("COFFEE_BREAK")),
  v4("qtd.verrine", "Verrine no brunch: pax × 2,2 dividido entre 2 sabores", { porPax: 2.2, sabores: 2, sugerirLinhas: ["BRUNCH"] }, MATRIZ, MUDANCA, linha("BRUNCH")),
  v4("sugestao.tier_catalogo", "Tier do cardápio que cada tier da linha pode usar (padrão: o próprio tier)", {}, BRUNCH, MUDANCA),
  v4("sugestao.tier_catalogo", "Brunch: os tiers do brunch usam itens do cardápio até Executive (brunch de entrada) e Master (brunch completo) — o cardápio de itens é tierizado pelo coffee", { BASIC: "EXECUTIVE", STANDARD: "MASTER" }, BRUNCH, MUDANCA, linha("BRUNCH")),
  v4("sugestao.pacote_livre", "Sugestão de itens para linhas montadas por escolha (nenhuma por padrão)", {}, TAB_COQUETEL, MUDANCA),
  v4("sugestao.pacote_livre", "Coquetel/HH: o que o motor sugere por tier quando o comercial não escolheu (cumulativo, conforme tabela 2026)", (() => {
    const basic = [
      { termos: ["guacamole"], grupos: [ESTACOES_COQUETEL], n: 1, quantidade: { minimo: 0.6, porPax: 0.015, aPartirDePax: 30, unidade: "KG" } },
      { termos: ["homus"], grupos: [ESTACOES_COQUETEL], n: 1, quantidade: { minimo: 0.6, porPax: 0.015, aPartirDePax: 30, unidade: "KG" } },
      { termos: ["coalhada"], grupos: [ESTACOES_COQUETEL], n: 1, quantidade: { minimo: 0.6, porPax: 0.015, aPartirDePax: 30, unidade: "KG" } }
    ];
    const standard = [...basic, { termos: ["hambúrguer"], n: 1, quantidade: { porPax: 2 } }, { termos: ["patês"], grupos: [ESTACOES_COQUETEL], n: 1, quantidade: { minimo: 0.6, porPax: 0.015, aPartirDePax: 30, unidade: "KG" } }];
    const executive = [...standard, { grupos: ["PIEGGI BOARD"], n: 1, quantidade: { minimo: 1, porPax: 0.05, aPartirDePax: 20 } }, { grupos: ["TARTELETE"], tipo: "SALGADO", n: 3 }];
    const master = [...standard, { grupos: ["PIEGGI BOARD"], n: 1, quantidade: { minimo: 1, porPax: 0.05, aPartirDePax: 20 } }, { grupos: ["TARTELETE"], tipo: "SALGADO", n: 4 }, { termos: ["burrata", "terrine"], grupos: [ESTACOES_COQUETEL], n: 1, quantidade: { minimo: 1, porPax: 1 / 15, aPartirDePax: 15 } }];
    return { BASIC: basic, STANDARD: standard, EXECUTIVE: executive, MASTER: master, PREMIUM: [...master, { termos: ["brie folhado"], grupos: [ESTACOES_COQUETEL], n: 1, quantidade: { minimo: 1 } }] };
  })(), `${TAB_COQUETEL}; ${doc(`${CL}STATUS_EducaSEO_Coquetel_13-11_AnaCatarina_80pax.md`, "10/2026", "dips com piso de 600 g + 15 g/pax acima de 30; mini hambúrguer 2/pax; Pieggi Board 1 tábua a cada 20 pax")}; ${doc("Programação/Regras e contexto/PROMPT__Claudinho_PROGRAMACAO_colar_na_configuracao.pdf", "23/07/2026", "burrata/terrine 1 a cada 15 pax")}`,
  MUDANCA, linha("COQUETEL")),
  v4("sugestao.pacote_livre", "Brunch: 2 tortas salgadas + 1 quiche + 1 lanche + 1 tapioca + guacamole, homus, coalhada e mix de folhas", {
    "*": [
      { termos: ["torta salgada"], n: 2 }, { termos: ["quiche"], grupos: ["TORTAS E QUICHES"], n: 1 }, { rotulos: ["Mini lanche"], n: 1 },
      { grupos: ["BARQUETE DE TAPIOCA"], n: 1 },
      { termos: ["guacamole"], grupos: [ESTACOES_COQUETEL], n: 1, quantidade: { minimo: 0.6, porPax: 0.015, aPartirDePax: 30, unidade: "KG" } },
      { termos: ["homus"], grupos: [ESTACOES_COQUETEL], n: 1, quantidade: { minimo: 0.6, porPax: 0.015, aPartirDePax: 30, unidade: "KG" } },
      { termos: ["coalhada"], grupos: [ESTACOES_COQUETEL], n: 1, quantidade: { minimo: 0.6, porPax: 0.015, aPartirDePax: 30, unidade: "KG" } },
      { termos: ["mix de folhas"], grupos: [ESTACOES_COQUETEL], n: 1, quantidade: { porPax: 0.08, unidade: "KG" } }
    ]
  }, BRUNCH, MUDANCA, linha("BRUNCH")),
  v4("cardapio.categorias", "Rótulos: + estações de coquetel/brunch (dip com acompanhamento = 1 item) e torta salgada", [
    { grupo: ESTACOES_COQUETEL, rotulo: "Estação", prefixos: [], tipo: "SALGADO", receitaSemRotulo: true },
    { termos: ["torta salgada"], rotulo: "Torta salgada", prefixos: ["torta salgada"], tipo: "SALGADO" },
    ...valorV2<unknown[]>("cardapio.categorias")
  ], doc(`${GP}Pieggi__Coquetel__Tabela_de_pre_o.pdf`, "25/05/2026"), MUDANCA),
  v4("plaquinha.sem_subtitulo", "Rótulos sem subtítulo (+ estação: dip e acompanhamento num card só, nome inteiro no título)", [
    ...valorV2<string[]>("plaquinha.sem_subtitulo"), "Estação"
  ], `Especificação 05/11/2026 §8 Agrupamentos; ${TAB_COQUETEL}`, MUDANCA),
  v4("glossario", "Glossário PT → [EN, ES] (+ torta salgada, canapé)", {
    ...valorV2<Record<string, unknown>>("glossario"), "TORTA SALGADA": ["SAVORY PIE", "TARTA SALADA"], "ESTAÇÃO": ["STATION", "ESTACIÓN"], "CANAPÉ": ["CANAPÉ", "CANAPÉ"], "Palmito": ["Heart of Palm", "Palmito"]
  }, BRUNCH, MUDANCA),

  // ---------- Comanda
  v4("roteamento.estacao", "Roteamento (+ mini torrada é compra de mercado, nunca filão; canjica e vinho quente na Cozinha Quente)", [
    { termos: ["mini torrada", "mini torradas", "torradinha", "torradinhas", "mini bruschetta"], estacao: "EXPEDICAO_ALIMENTACAO", fornecedor: "MERCADO", compradoPronto: true },
    { termos: ["canjica", "vinho quente"], estacao: "COZINHA_QUENTE" },
    ...valorV2<unknown[]>("roteamento.estacao")
  ], `${doc(`${PR}adendo-comanda-mini-torrada-mercado-nunca-filao-27ago2026.md`, "27/08/2026")}; ${doc(`${PR}regras-comanda-28jul2026-mesa-posta-canapes.md`, "28/07/2026")}`, MUDANCA),
  v4("comanda.bebidas_producao", "Suco é produzido na Confeitaria (receita de ~1,7 L, nunca completar com água) e separado na Expedição — Alimentação; nunca na Expedição — Bebidas", {
    rotulos: ["Suco"], estacao: "CONFEITARIA", expedicao: "EXPEDICAO_ALIMENTACAO", litrosPorReceita: 1.7,
    texto: "{n} receita(s) de ~1,7 L — quantidade em receitas, nunca completar com água."
  }, doc(`${PR}adendo-comanda-todo-suco-confeitaria-alimentacao-27ago2026.md`, "27/08/2026", "revoga os roteamentos de 30/07, 04/08, 14/08 e 18/08"), "2026-11-05"),
  v4("comanda.estrutura", "Estrutura (+ sachês de açúcar e adoçante por dose de 100 ml de café; água de preparo em galão; maleta de finalização)", [
    ...valorV2<unknown[]>("comanda.estrutura"),
    { chave: "ACUCAR", texto: "Sachê de açúcar (1 por dose de 100 ml de café)", porLitros: { rotulos: ["Café"], fator: 10 } },
    { chave: "ADOCANTE", texto: "Sachê de adoçante (1 por dose de 100 ml de café)", porLitros: { rotulos: ["Café"], fator: 10 } },
    { chave: "AGUA_PREPARO", texto: "L — ÁGUA MINALBA EM GALÃO — ÁGUA DE PREPARO (café + água quente do chá; não é água de servir; NUNCA usar água da torneira)", porLitros: { rotulos: ["Café", "Água quente"], fator: 1 } },
    { chave: "MALETA_FINALIZACAO", texto: "MALETA DE FINALIZAÇÃO COMPLETA (mel em bisnaga · azeite extravirgem · azeite trufado · flor de sal · pimenta-do-reino + moedor · pinça · pincel · sal)", fixo: 1, linhas: ["COQUETEL", "ALMOCO", "JANTAR", "BRUNCH"] }
  ], `${doc(`${PR}trava-programacao-versao-e-calculo-por-dose-03set2026.md`, "03/09/2026")}; ${doc(`${PR}adendo-comanda-agua-de-preparo-em-galao-30ago2026.md`, "30/08/2026")}; ${doc(`${PR}ADENDO 01-10 - Kit fechado por item e maleta fixa.md`, "01/10/2026")}`, MUDANCA),
  v4("comanda.regras_item", "Regras de item (+ croissant: rechear bem; item com finalização sai em kit fechado; carolina de limão com doce de limão)", [
    ...valorV2<unknown[]>("comanda.regras_item"),
    { termos: ["croissant"], estacoes: ["CONFEITARIA"], alerta: "RECHEAR BEM: recheio generoso." },
    { termos: ["carolina de limão", "mini carolina de limão"], estacoes: ["CONFEITARIA", "EXPEDICAO_ALIMENTACAO"], detalhe: "Recheio de doce de limão." },
    { termos: ["canapé", "tartelete", "pieggi board", "terrine", "brie", "burrata"], estacoes: ["COZINHA_QUENTE", "COZINHA_FRIA", "CONFEITARIA"], detalhe: "ENTREGAR EM 1 KIT FECHADO COM TUDO DENTRO (base, cobertura e finalização), etiquetado com o nome do item. Faltou algo = não entrega." }
  ], `${doc(`${PR}adendo-comanda-croissant-rechear-bem-08set2026.md`, "08/09/2026")}; ${doc(`${PR}ADENDO 01-10 - Kit fechado por item e maleta fixa.md`, "01/10/2026")}; ${doc(`${PR}evento-celebrar-coffee-break-julia-10set2026-decisoes.md`, "09/2026")}`, MUDANCA),
  v4("comanda.avisos_cliente", "Zup: nenhum molho picante (detalhe do que é proibido)", {
    COZINHA_QUENTE: ["ZUP: nenhum molho pode ficar picante. Pimenta-do-reino só uma pitada; proibido calabresa, dedo-de-moça, caiena e molho de pimenta. Provar antes de sair."],
    EXPEDICAO_ALIMENTACAO: ["ZUP: nenhum molho picante — conferir antes de servir."]
  }, doc(`${PR}evento-zup-almoco-com-a-lideranca-emily-06out2026-decisoes.md`, "30/09/2026"), MUDANCA, cliente("ZUP")),
  v4("comanda.avisos_cliente", "Celebrar: pão de queijo em várias entregas ao longo do serviço", {
    EXPEDICAO_ALIMENTACAO: ["CELEBRAR: pão de queijo em várias entregas ao longo do serviço (ex.: 09h00, 09h30, 10h00) — o cliente já reclamou de pão de queijo frio."]
  }, doc(`${PR}evento-celebrar-coffee-break-master-julia-16set2026-decisoes.md`, "16/09/2026"), "2026-11-05", cliente("CELEBRAR")),

  // ---------- Proposta e cliente
  v4("proposta.termos_proibidos", "Nunca no slide do cliente: lógica interna de preço (aviso)", { remover: [], avisar: ["cmv", "custo", "repasse", "markup", "1 sabor a cada"] },
    `Especificação 05/11/2026 §5 Orçamento; ${doc(`${GP}PROMPT__Claudinho_PROPOSTA_colar_na_configuracao.pdf`, "23/07/2026")}`, MUDANCA),
  v4("proposta.nomes_servico", "Nome do serviço como o cliente escreve → linha.tier Pieggi (nenhum por padrão)", {}, "Especificação 05/11/2026 §5 Orçamento", "2026-11-05"),
  v4("proposta.nomes_servico", "StartSe: Coffee I–IV = Basic/Standard/Executive/Master; Padrão All Hands = Standard; Welcome = Executive; Coquetel I–III = Basic/Standard/Executive", {
    "Coffee I": "COFFEE_BREAK.BASIC", "Coffee II": "COFFEE_BREAK.STANDARD", "Coffee III": "COFFEE_BREAK.EXECUTIVE", "Coffee IV": "COFFEE_BREAK.MASTER",
    "Padrão All Hands": "COFFEE_BREAK.STANDARD", "Welcome": "WELCOME.EXECUTIVE",
    "Coquetel I": "COQUETEL.BASIC", "Coquetel II": "COQUETEL.STANDARD", "Coquetel III": "COQUETEL.EXECUTIVE"
  }, `Especificação 05/11/2026 §5 Orçamento; ${doc(`${PR}adendo-comanda-tabela-startse-06ago2026.md`, "06/08/2026")}`, "2026-11-05", cliente("STARTSE")),
  v4("lista_negra", "BodyTech: lista negra global + fubá com goiabada (público fitness)", [
    ...listaNegraV1(), { termo: "fubá com goiabada", motivo: "BodyTech: público fitness — fora do cardápio." }
  ], doc(`${CL}STATUS_BodyTech_Iguatemi_26-10_Fran_100pax.md`, "10/2026"), MUDANCA, cliente("BODYTECH")),

  // ---------- Preços (tabelas 2026 que a especificação não consolidou)
  precoV4("EXTERNOS", "COFFEE_BREAK", "BASIC", 43, TAB_EXT, "2026-01-16"), precoV4("EXTERNOS", "COFFEE_BREAK", "STANDARD", 48, TAB_EXT, "2026-01-16"),
  ...([["BASIC", 80, 95, 100], ["STANDARD", 95, 109, 114], ["EXECUTIVE", 115, 130, 135], ["MASTER", 130, 145, 150], ["PREMIUM", 180, 195, 200], ["PIZZA", 135, 150, 155]] as const)
    .map(([tier, sem, lata, longNeck]) => precoV4("EXTERNOS", "COQUETEL", tier, { SEM_CERVEJA: sem, LATA: lata, LONG_NECK: longNeck },
      `${TAB_COQUETEL} — os 3 valores são sem cerveja / cerveja em lata / long neck (até 2 h); a duração entra pela reposição`, tier === "PIZZA" ? "2026-05-25" : MUDANCA)),
  v4("reposicao.faixas", "Coquetel: acréscimo de preço por duração (base 2 h; +30% 3 h; +80% 4 h, teto)", [{ ateHoras: 2, acrescimo: 0 }, { ateHoras: 3, acrescimo: 0.3 }, { ateHoras: 4, acrescimo: 0.8 }],
    "Especificação 05/11/2026 §4 Reposição", MUDANCA, { ...linha("COQUETEL"), ...FIN }),
  precoV4("STARTSE_ATUAL", "AUDITORIO", "MASTER", { "4": 22, "8": 31 }, TAB_FIXOS, "2026-01-16"),
  ...([["COFFEE_BREAK", "BASIC", 47.5], ["COFFEE_BREAK", "STANDARD", 51.5], ["COFFEE_BREAK", "EXECUTIVE", 55], ["COFFEE_BREAK", "MASTER", 64],
    ["WELCOME", "BASIC", 18], ["WELCOME", "STANDARD", 22.5], ["WELCOME", "EXECUTIVE", 24.5], ["WELCOME", "MASTER", 28.5]] as const)
    .map(([l, tier, valor]) => precoV4("WTC", l, tier, valor, TAB_WTC_COFFEE, "2026-02-03")),
  precoV4("WTC", "AUDITORIO", "EXECUTIVE", { "4": 16, "8": 21 }, TAB_WTC_COFFEE, "2026-02-03"), precoV4("WTC", "AUDITORIO", "MASTER", { "4": 27.5, "8": 39 }, TAB_WTC_COFFEE, "2026-02-03"),
  ...([["BRUNCH", "BASIC", 120], ["BRUNCH", "STANDARD", 145], ["ALMOCO", "EXECUTIVE", 180], ["ALMOCO", "MASTER", 235], ["JANTAR", "EXECUTIVE", 180], ["JANTAR", "MASTER", 235]] as const)
    .map(([l, tier, valor]) => precoV4("WTC", l, tier, valor, TAB_WTC_ALIM, "2026-02-03")),
  v4("logistica.valor", "Logística Guarulhos / região do aeroporto", 500, doc(`${CL}STATUS_West_Cargo_Outubro_Rosa_23-10.md`, "09/2026"), "2026-11-05", { escopoTipo: "REGIAO", escopoChave: "GUARULHOS", financeiro: true }),
  avulsoV4("ENTREGA_SEM_MONTAGEM", "Entrega simples, sem montagem (sem taxa de serviço)", 100, doc(`${CL}STATUS_Zup_Entrega_Halloween_data-a-confirmar.md`, "01/10/2026"), "2026-11-05"),
  avulsoV4("PERSONALIZACAO_HALLOWEEN", "Personalização temática de Halloween — mesa ambientada (valor fechado por evento)", 500, doc(`${CL}STATUS_Hyundai_Coquetel_Halloween_04-11_Isabella_100pax.md`, "02/10/2026"), "2026-11-05"),
  avulsoV4("LOCACAO_NESPRESSO", "Locação de máquina Nespresso (cápsulas à parte)", 350, TAB_EXT, "2026-01-16"),
  avulsoV4("BAR_1", "Bar 1 por pax: caipirinha, caipiroska e soda italiana", 95, TAB_COQUETEL, "2026-05-25"),
  avulsoV4("BAR_2", "Bar 2 por pax: caipirinha, caipiroska, gin tônica e soda italiana", 110, TAB_COQUETEL, "2026-05-25"),
  avulsoV4("BAR_3", "Bar 3 por pax: caipirinha, caipiroska, gin tônica, fitzgerald, moscow mule e soda italiana", 120, TAB_COQUETEL, "2026-05-25"),
  avulsoV4("VINHO_GARRAFA", "Vinho (garrafa; referência 1 garrafa a cada 3 pax)", 95, doc(`${CL}STATUS_Nathalia_Premiacao_Coquetel_Jantar_10-11_150pax.md`, "10/2026"), "2026-11-05"),
  avulsoV4("QUIBE_FRITO", "Quibe frito (un)", 4.5, doc(`${CL}STATUS_Clean_Medical_13-10_v2_venda_por_unidade_5k.md`, "10/2026"), "2026-11-05"),
  avulsoV4("MINI_QUICHE", "Mini quiche (un)", 6, doc(`${CL}STATUS_Clean_Medical_13-10_v2_venda_por_unidade_5k.md`, "10/2026"), "2026-11-05"),
  avulsoV4("TERRINE", "Terrine (un)", 180, doc(`${CL}STATUS_Clean_Medical_13-10_v2_venda_por_unidade_5k.md`, "10/2026"), "2026-11-05"),
  avulsoV4("GUACAMOLE_TRAVESSA", "Guacamole com Doritos (travessa)", 120, doc(`${CL}STATUS_Clean_Medical_13-10_v2_venda_por_unidade_5k.md`, "10/2026"), "2026-11-05"),
  avulsoV4("HOMUS_TRAVESSA", "Homus com pão sírio (travessa)", 120, doc(`${CL}STATUS_Clean_Medical_13-10_v2_venda_por_unidade_5k.md`, "10/2026"), "2026-11-05")
];


/** Versão de cada linha: conta por código na ordem carga 1 → carga 2 (igual ao gerador da migration). */
export function comVersao(regras: readonly RegraInicial[]) {
  const versoes = new Map<string, number>();
  return regras.map((r) => {
    const versao = (versoes.get(r.codigo) ?? 0) + 1;
    versoes.set(r.codigo, versao);
    return { ...r, versao };
  });
}

/** Ordem das cargas = ordem das migrations (a versão de cada código continua a contagem). */
export const TODAS_AS_CARGAS = () => [...REGRAS_INICIAIS, ...REGRAS_V2, ...REGRAS_V3, ...REGRAS_V4];

/** Regras iniciais (cargas 1 a 4) no formato do motor — usadas pelos testes de aceite. */
export function regrasIniciaisComoRegras(): Regra[] {
  return comVersao(TODAS_AS_CARGAS()).map((r) => ({
    codigo: r.codigo, escopoTipo: r.escopoTipo ?? "GLOBAL", escopoChave: r.escopoChave ?? "", valor: r.valor,
    vigenteDesde: r.vigenteDesde ?? VIGENCIA_INICIAL, versao: r.versao, status: r.status ?? "APROVADA", titulo: r.titulo
  }));
}
