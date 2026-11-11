// Fixtures realistas dos geradores (testes e amostras em docs/amostras). Não usar em produção.
import type { CabecalhoEvento, Comanda, Plaquinhas, Programacao, PropostaDoc } from "./tipos";

export const cabecalhoGenerico: CabecalhoEvento = {
  eventoId: "evt-0001", contratante: "Banco Neon S.A.", cliente: "Banco Neon", clienteChave: null,
  evento: "Workshop de Liderança 2026", contato: "Mariana Souza", telefoneContato: "+55 11 99876-5432",
  pax: 42, datas: ["2026-11-24", "2026-11-25"], horarioInicio: "08:30", horarioFim: "17:30",
  endereco: "Av. Brigadeiro Faria Lima, 3477 — 14º andar, Itaim Bibi, São Paulo/SP, 04538-133",
  restricoes: ["2 veganos", "1 sem glúten"]
};

export const cabecalhoStartSe: CabecalhoEvento = {
  eventoId: "evt-0002", contratante: "StartSe", cliente: "StartSe", clienteChave: "STARTSE",
  evento: "Board Program T16 Encontro 1 Parte II", contato: "Gabriela Lima", telefoneContato: null,
  pax: 75, datas: ["2026-10-26", "2026-10-27", "2026-10-28"], horarioInicio: "12:30", horarioFim: "18:00",
  endereco: "Av. das Nações Unidas, 12901 — CENU Torre Norte, 9º andar, Cidade Monções, São Paulo/SP, 04578-910",
  restricoes: []
};

export const programacao: Programacao = {
  cabecalho: cabecalhoGenerico,
  avisos: ["Cliente pediu identificação das refresqueiras de água."],
  servicos: [
    {
      id: "s1", data: "2026-11-24", linha: "AUDITORIO", tier: "Standard", nome: "Auditório", periodo: "DIA",
      horarioInicio: "08:30", horarioFim: "17:30", pax: 42, comReposicao: true,
      itens: [
        { quantidade: 6.3, unidade: "L", quantidadeTexto: "6,3 L (4 garrafas térmicas)", receita: "Café tradicional passado no local", item: "Café", bebida: true },
        { quantidade: 63, unidade: "UN", receita: "Água mineral sem gás 500 ml", item: "Água", bebida: true, compradoPronto: true },
        { quantidade: 21, unidade: "UN", receita: "Água mineral com gás 500 ml", item: "Água", bebida: true, compradoPronto: true }
      ]
    },
    {
      id: "s2", data: "2026-11-24", linha: "COFFEE_BREAK", tier: "Executive", nome: "Coffee Break da manhã", periodo: "MANHA",
      horarioInicio: "10:00", horarioFim: "10:30", pax: 42, comReposicao: false,
      itens: [
        { quantidade: 37, unidade: "UN", receita: "Mini lanche no pão brioche — frango defumado com pasta de queijo Pieggi", item: "Mini lanche", sabor: "Frango defumado" },
        { quantidade: 10, unidade: "UN", receita: "Mini lanche no brioche de cenoura — búfala, tomate seco e rúcula", item: "Mini lanche", selo: "VEGETARIANO" },
        { quantidade: 2, unidade: "UN", receita: "Mini lanche no brioche de cenoura — homus e legumes grelhados (vegano)", item: "Mini lanche", selo: "VEGANO", restricao: true },
        { quantidade: 23, unidade: "UN", receita: "Cup cake Laranja & Chocolate", item: "Cup cake" },
        { quantidade: 23, unidade: "UN", receita: "Cup cake Limão", item: "Cup cake" },
        { quantidade: 46, unidade: "UN", receita: "Carolina na forminha pétala de acrílico — recheio de doce de leite", item: "Carolina" },
        { quantidade: 1, unidade: "UN", receita: "Pão de queijo sem glúten (porção individual)", item: "Pão de queijo", restricao: true, selosExtras: ["SEM_GLUTEN"] },
        { quantidade: 4.6, unidade: "L", receita: "Suco de laranja", item: "Suco", bebida: true },
        { quantidade: 4.6, unidade: "L", receita: "Chá mate gelado", item: "Chá gelado", bebida: true }
      ]
    },
    {
      id: "s3", data: "2026-11-24", linha: "ALMOCO", tier: "Executive", nome: "Almoço", periodo: "ALMOCO",
      horarioInicio: "12:30", horarioFim: "13:30", pax: 42, comReposicao: false,
      itens: [
        { quantidade: 7.65, unidade: "KG", quantidadeTexto: "7,65 kg (45 pax × 170 g)", receita: "Filé mignon ao molho roti", item: "Proteína", quente: true },
        { quantidade: 2.3, unidade: "KG", quantidadeTexto: "2,3 kg (30% da proteína)", receita: "Molho roti (em linha própria)", item: "Molho", quente: true },
        { quantidade: 6.75, unidade: "KG", quantidadeTexto: "6,75 kg (45 pax × 150 g)", receita: "Arroz branco soltinho", item: "Acompanhamento", quente: true },
        { quantidade: 3.6, unidade: "KG", quantidadeTexto: "3,6 kg (45 pax × 80 g)", receita: "Mix de folhas com tomate grape e molho de mostarda e mel", item: "Salada" },
        { quantidade: 1, unidade: "TRAVESSA", quantidadeTexto: "1 travessa · 45 pax × 60 g = 2,7 kg", receita: "Pudim de leite condensado (3 formas)", item: "Sobremesa" },
        { quantidade: 2, unidade: "UN", receita: "Prato vegano: risoto de cogumelos com leite vegetal", item: "Prato principal", restricao: true, selo: "VEGANO" }
      ]
    },
    {
      id: "s4", data: "2026-11-25", linha: "COFFEE_BREAK", tier: "Executive", nome: "Coffee Break da tarde", periodo: "TARDE",
      horarioInicio: "15:30", horarioFim: "16:00", pax: 42, comReposicao: false,
      itens: [
        { quantidade: 46, unidade: "UN", receita: "Wrap Azeitonas & Agrião", item: "Wrap" },
        { quantidade: 23, unidade: "UN", receita: "Cup cake Churros", item: "Cup cake" },
        { quantidade: 23, unidade: "UN", receita: "Cup cake Maracujá", item: "Cup cake" },
        { quantidade: 4.6, unidade: "L", receita: "Suco de maracujá", item: "Suco", bebida: true },
        { quantidade: 4.6, unidade: "L", receita: "Chá mate gelado", item: "Chá gelado", bebida: true }
      ]
    }
  ]
};

const linhasExp = (n: number) => [
  { quantidade: "46 un", item: "Carolina — recheio de doce de leite", materiais: ["1 pegador + 1 descanso", "1 travessa branca média"] },
  { quantidade: "46 un", item: "Cup cake Laranja & Chocolate / Limão", materiais: ["1 pegador + 1 descanso", "46 palitos"] },
  { quantidade: `${n} un`, item: "Verrine Banoffee Desconstruída", finalizarConformeImagem: true, materiais: ["1 pegador + 1 descanso", "51 colherinhas de verrine"] }
];

// Tarjas fixas como o motor as entrega (regra comanda.avisos): saída em todas; motoristas e copeiras na expedição.
const SAIDA = "DIA E HORÁRIO DA SAÍDA: ______ (perguntar pra Adriana e anotar aqui)";
const EXPEDICAO = ["MOTORISTAS: ANTES DE LEVAR, CHAMAR AS RESPONSÁVEIS PARA VALIDAR", "COPEIRAS: antes do início do evento — TICAR TUDO, FOTOGRAFAR e cobrar o Luiz no zap dele se faltou algo."];
const comTarjas = (p: Comanda["paginas"][number]) => ({ ...p, avisos: [SAIDA, ...(p.tipo.startsWith("EXPEDICAO") ? EXPEDICAO : []), ...p.avisos] });

export const comanda: Comanda = {
  cabecalho: cabecalhoGenerico,
  paginas: ([
    { tipo: "COZINHA_QUENTE", data: "2026-11-24", avisos: ["PESAR CADA ITEM PRONTO, ANOTAR O PESO NA COMANDA E ENTREGAR NA ADMINISTRAÇÃO.", "AMOSTRA DA VIGILÂNCIA: guardar porção de cada item quente, etiquetada, congelada por 72 h."], blocos: [
      { titulo: "Almoço — 12:30 — 42 pax", linhas: [
        { quantidade: "7,65 kg", item: "Filé mignon ao molho roti", detalhe: "pesar a carne sem molho; réchaud com fundo de molho" },
        { quantidade: "2,3 kg", item: "Molho roti" },
        { quantidade: "6,75 kg", item: "Arroz branco soltinho" },
        { quantidade: "____ marmitas", item: "Marmita da equipe Pieggi", detalhe: "perguntar quantas são (1 a 5)" }
      ] },
      { titulo: "Coffee Break da manhã — 10:00", linhas: [{ quantidade: "46 un", item: "Croissant de queijo e presunto", detalhe: "recheio 15 g por unidade, metade queijo e metade presunto" }] }
    ] },
    { tipo: "COZINHA_FRIA", data: "2026-11-24", avisos: [], blocos: [
      { titulo: "Coffee Break da manhã — 10:00", linhas: [
        { quantidade: "37 un", item: "Mini lanche no brioche — frango defumado", detalhe: "pasta base ~20 g por unidade" },
        { quantidade: "10 un", item: "Mini lanche no brioche de cenoura — búfala, tomate seco e rúcula" },
        { quantidade: "1,0 kg", item: "Pasta base (ricota + requeijão + muçarela)" },
        { quantidade: "24 un", item: "Tartelete de shimeji na casquinha flor preta", finalizarConformeImagem: true }
      ] },
      { titulo: "Almoço — 12:30", linhas: [{ quantidade: "3,6 kg", item: "Mix de folhas com tomate grape" }] }
    ] },
    { tipo: "CONFEITARIA", data: "2026-11-24", avisos: [], blocos: [
      { titulo: "Coffee Break da manhã — 10:00", linhas: [
        { quantidade: "46 un", item: "Carolina na forminha pétala de acrílico", detalhe: "recheio de doce de leite" },
        { quantidade: "23 un", item: "Cup cake Laranja & Chocolate" },
        { quantidade: "23 un", item: "Cup cake Limão" },
        { quantidade: "51 un", item: "Verrine Banoffee Desconstruída", detalhe: "finaliza com chantilly por cima, sem granulado", finalizarConformeImagem: true }
      ] },
      { titulo: "Almoço — 12:30", linhas: [{ quantidade: "1 travessa · 45 pax × 60 g = 2,7 kg", item: "Pudim de leite condensado — 3 formas", detalhe: "dividir o peso total entre as formas" }] }
    ] },
    { tipo: "EXPEDICAO_ALIMENTACAO", data: "2026-11-24", avisos: [], blocos: [
      { titulo: "Coffee Break da manhã — 10:00", linhas: linhasExp(51) },
      { titulo: "Itens Comprados Prontos", destaque: "AMBAR", linhas: [
        { quantidade: "63 un", item: "Pão de queijo congelado (tradicional)", materiais: ["1 pegador + 1 descanso"] },
        { quantidade: "1 pacote", item: "Mix de castanhas e amendoins" }
      ] }
    ] },
    { tipo: "EXPEDICAO_BEBIDAS", data: "2026-11-24", avisos: [], blocos: [
      { titulo: "Bebidas", linhas: [
        { quantidade: "6,3 L", item: "Café tradicional — 4 garrafas térmicas", detalhe: "enviar limpa/escaldada" },
        { quantidade: "4,6 L", item: "Suco de laranja — refresqueira" },
        { quantidade: "63 un", item: "Água mineral sem gás 500 ml" }
      ] },
      { titulo: "APOIO E IDENTIFICAÇÃO", linhas: [
        { quantidade: "1", item: "Arranjo de flores" }, { quantidade: "1", item: "Extensão" },
        { quantidade: "2", item: "Rádios comunicadores (enviar carregados)" }, { quantidade: "5", item: "Caixas etiquetadas", materiais: ["LOUÇAS", "PEGADORES E UTENSÍLIOS", "DESCARTÁVEIS", "BEBIDAS", "IDENTIFICAÇÃO E APOIO"] }
      ] }
    ] },
    { tipo: "COZINHA_QUENTE", data: "2026-11-25", avisos: [], blocos: [] }, // sem blocos → página some
    { tipo: "CONFEITARIA", data: "2026-11-25", avisos: [], blocos: [
      { titulo: "Coffee Break da tarde — 15:30", linhas: [{ quantidade: "23 un", item: "Cup cake Churros" }, { quantidade: "23 un", item: "Cup cake Maracujá" }] }
    ] },
    { tipo: "EXPEDICAO_ALIMENTACAO", data: "2026-11-25", avisos: [], blocos: [
      { titulo: "Coffee Break da tarde — 15:30", linhas: [{ quantidade: "46 un", item: "Cup cake Churros / Maracujá", materiais: ["1 pegador + 1 descanso", "46 palitos"] }] }
    ] }
  ] satisfies Comanda["paginas"]).map(comTarjas),
  adriana: {
    locacoes: [],
    fornecedores: [
      { data: "2026-11-24", fornecedor: "Pad. Letícia", item: "Quibe frito", quantidade: "50 un" },
      { data: "2026-11-24", fornecedor: "Padaria CPL", item: "Brioche para mini lanche", quantidade: "47 un" },
      { data: "2026-11-25", fornecedor: "Salgaderia Leal", item: "Coxinha", quantidade: "50 un" }
    ],
    freelancers: null,
    verbaCentavos: 123456
  }
};

export const plaquinhas: Plaquinhas = {
  cabecalho: cabecalhoGenerico,
  dias: [
    { data: "2026-11-24", cards: [
      { titulo: "FRANGO DEFUMADO", subtitulo: "MINI LANCHE", en: "SANDWICH / Smoked Chicken", es: "SÁNDWICH / Pollo Ahumado", selos: [] },
      { titulo: "VEGETARIANO", subtitulo: "BÚFALA, TOMATE SECO E RÚCULA", en: "SANDWICH / Buffalo Mozzarella, Sun-dried Tomato & Arugula", es: "SÁNDWICH / Búfala, Tomate Seco y Rúcula", selos: ["VEGETARIANO"] },
      { titulo: "PARMESÃO, GRUYÈRE E GORGONZOLA", subtitulo: "TÁBUA DE QUEIJOS", en: "CHEESE BOARD / Parmesan, Gruyère & Gorgonzola", es: "TABLA DE QUESOS / Parmesano, Gruyère y Gorgonzola", selos: ["VEGETARIANO"] },
      { titulo: "SUCO", subtitulo: "LARANJA", en: "JUICE / Orange", es: "JUGO / Naranja", selos: ["VEGANO"] },
      { titulo: "TRADICIONAL E INTEGRAL", subtitulo: "PÃO DE QUEIJO", en: "CHEESE BREAD / Traditional & Whole Grain", es: "PAN DE QUESO / Tradicional e Integral", selos: ["VEGETARIANO"] },
      { titulo: "MORANGO, MANGA, ABACAXI, KIWI, UVA, MAMÃO, MELÃO, PITAYA E COCO", subtitulo: "SALADA DE FRUTAS", en: "FRUIT SALAD / Strawberry, Mango, Pineapple, Kiwi, Grape, Papaya, Melon, Pitaya & Coconut", es: "ENSALADA DE FRUTAS / Fresa, Mango, Piña, Kiwi, Uva, Papaya, Melón, Pitaya y Coco", selos: ["VEGANO", "SEM_GLUTEN"] },
      { titulo: "CAFÉ", subtitulo: "TRADICIONAL", en: "COFFEE / Traditional", es: "CAFÉ / Tradicional", selos: [] }
    ] },
    { data: "2026-11-25", cards: [
      { titulo: "AZEITONAS & AGRIÃO", subtitulo: "WRAP", en: "WRAP / Olives & Watercress", es: "WRAP / Aceitunas y Berro", selos: ["VEGETARIANO"] },
      { titulo: "CHURROS E MARACUJÁ", subtitulo: "CUP CAKE", en: "CUPCAKE / Churros & Passion Fruit", es: "CUPCAKE / Churros y Maracuyá", selos: ["VEGETARIANO"] },
      { titulo: "PURÊ DE BATATA", subtitulo: null, en: "MASHED POTATOES / Lactose Free", es: "PURÉ DE PAPA / Sin Lactosa", selos: ["VEGETARIANO", "SEM_LACTOSE"] }
    ] }
  ]
};

const orcamentoBase = [
  { descritivo: "Coffee Break Executive — manhã — 24 e 25/11", pax: 42, porPessoaCentavos: 6890, valorCentavos: 578760 },
  { descritivo: "Almoço Executive — 24/11", pax: 42, porPessoaCentavos: 14500, valorCentavos: 609000 },
  { descritivo: "Restrição alimentar — 2 veganos, 1 sem glúten", pax: 3, porPessoaCentavos: 0, valorCentavos: 0 },
  { descritivo: "Logística + taxa de serviço (10%)", pax: null, porPessoaCentavos: null, valorCentavos: 158776 }
];

export const propostaCompleta: PropostaDoc = {
  cabecalho: cabecalhoGenerico, formato: "COMPLETO",
  orcamento: orcamentoBase,
  bebidasAlcoolicas: [{ descritivo: "Bar de vinhos — 1 garrafa a cada 3 pax", pax: 42, porPessoaCentavos: 4500, valorCentavos: 189000 }],
  totalCentavos: 1346536,
  opcionais: [{ descritivo: "Louça premium", valorTexto: "R$ 12,00 por pessoa" }],
  cardapios: [
    { titulo: "Coffee Break Executive — manhã", itens: [
      { nome: "Mini lanche no pão brioche — frango defumado", quantidade: 37, descricao: "Pasta de queijo Pieggi, frango defumado desfiado e rúcula." },
      { nome: "Mini lanche no brioche de cenoura — búfala", quantidade: 10, descricao: "Muçarela de búfala, tomate seco e rúcula." },
      { nome: "Cup cake Laranja & Chocolate", quantidade: 23, descricao: null },
      { nome: "Carolina", quantidade: 46, descricao: "Recheio de doce de leite." }
    ], bebidas: ["Café", "Leite", "Suco de laranja", "Chá mate gelado", "Água mineral com e sem gás"] },
    { titulo: "Almoço Executive", itens: [
      { nome: "Filé mignon ao molho roti", quantidade: null, descricao: "Servido em réchaud." },
      { nome: "Arroz branco soltinho", quantidade: null, descricao: null },
      { nome: "Mix de folhas com tomate grape", quantidade: null, descricao: "Molho de mostarda e mel à parte." },
      { nome: "Pudim de leite condensado", quantidade: null, descricao: null }
    ], bebidas: ["Refrigerantes Coca-Cola e Coca-Cola Zero", "Água mineral"] }
  ],
  validade: "2026-11-15"
};

export const propostaPocket: PropostaDoc = {
  ...propostaCompleta, formato: "POCKET", cardapios: [], bebidasAlcoolicas: [], opcionais: [],
  orcamento: orcamentoBase.slice(0, 2), totalCentavos: null
};

export const propostaStartSe: PropostaDoc = {
  cabecalho: cabecalhoStartSe, formato: "COMPLETO",
  orcamento: [
    { descritivo: "Coquetel Grazing Table — 26/10 · partes 1 e 2", pax: 65, porPessoaCentavos: null, valorCentavos: 487500 },
    { descritivo: "Serviço de auditório — 26/10 · 1 período", pax: 75, porPessoaCentavos: null, valorCentavos: 112500 },
    { descritivo: "Serviço de auditório — 27 e 28/10 · 2 períodos por dia", pax: 75, porPessoaCentavos: null, valorCentavos: 450000 },
    { descritivo: "Coffee III — 27/10 manhã", pax: 75, porPessoaCentavos: null, valorCentavos: 405000 }
  ],
  bebidasAlcoolicas: [], totalCentavos: 1455000, opcionais: [],
  cardapios: [{ titulo: "Coquetel Grazing Table", itens: [
    { nome: "Tábua de frios", quantidade: 1, descricao: "Presunto parma, copa e pastrami." },
    { nome: "Tábua de queijos", quantidade: 1, descricao: "Provolone, gruyère e gorgonzola." },
    { nome: "Mini lanche no pão brioche — peito de peru com queijo", quantidade: 52, descricao: null },
    { nome: "Verrine Banoffee Desconstruída", quantidade: 108, descricao: "Banana, doce de leite e chantilly." }
  ], bebidas: ["Água Minalba", "Pepsi e Pepsi Zero", "Budweiser long neck"] }],
  validade: null
};
