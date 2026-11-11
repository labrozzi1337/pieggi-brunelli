import { describe, expect, it } from "vitest";
import type { CabecalhoEvento, ItemProgramacao, Programacao, ServicoProgramacao } from "@/dominios/documentos/tipos";
import type { Regra } from "./motor";
import { catalogoDaCarga } from "./catalogo-carga";
import { gerarComanda } from "./comanda";
import { gerarPlaquinhas } from "./plaquinha";
import { gerarProgramacao, type ServicoVendido } from "./programacao";
import { calcularVerba, gerarPropostaDoc, precificarAvulso, textoVerba } from "./proposta";
import { regrasIniciaisComoRegras } from "./regras-iniciais";

// Casos de aceite da especificação de 05/11/2026 (§15) nos documentos derivados — números exatos.
const regras = regrasIniciaisComoRegras();
const catalogo = catalogoDaCarga();
const DIA = "2026-11-20";
const idDe = (nome: string) => catalogo.find((i) => i.nome === nome)!.id;
const cab = (extra: Partial<CabecalhoEvento> = {}): CabecalhoEvento => ({
  eventoId: "ev-1", contratante: "Acme", cliente: "Acme", clienteChave: null, evento: "Convenção", contato: "Ana", telefoneContato: null,
  pax: 50, datas: [DIA], horarioInicio: "09:00", horarioFim: "18:00", endereco: "Rua das Flores, 100, São Paulo/SP", restricoes: [], ...extra
});
const coffee = (extra: Partial<ServicoVendido> = {}): ServicoVendido => ({ data: DIA, linha: "COFFEE_BREAK", tier: "EXECUTIVE", periodo: "MANHA", horarioInicio: "09:00", horarioFim: "10:00", pax: 50, ...extra });
const programar = (servicos: ServicoVendido[], extra: Partial<CabecalhoEvento> = {}) => gerarProgramacao(regras, catalogo, { cabecalho: cab(extra), servicos });
const doItem = (s: ServicoProgramacao, item: string) => s.itens.filter((i) => i.item === item);
const qtds = (itens: ItemProgramacao[]) => itens.map((i) => i.quantidade);

describe("Caso 1 — programação do Coffee Break Executive, 50 pax, 1h", () => {
  const r = programar([coffee()]);
  const s = r.servicos[0]!;

  it("mini lanche 44 carne em brioche + 11 vegetariano em brioche de cenoura, 1 sabor de cada", () => {
    const lanches = doItem(s, "Mini lanche");
    expect(qtds(lanches)).toEqual([44, 11]);
    expect(lanches[0]!.receita).toMatch(/— Brioche$/);
    expect(lanches[1]).toMatchObject({ selo: "VEGETARIANO" });
    expect(lanches[1]!.receita).toMatch(/— Brioche de cenoura$/);
  });

  it("pão de queijo 75 tradicional + 25 integral, congelado na expedição", () => {
    expect(doItem(s, "Pão de queijo").map((i) => [i.receita, i.quantidade])).toEqual([["Pão de queijo tradicional", 75], ["Pão de queijo integral", 25]]);
    expect(doItem(s, "Pão de queijo").every((i) => i.compradoPronto && i.estacao === "EXPEDICAO_ALIMENTACAO")).toBe(true);
  });

  it("2 adicionais (manhã: 1 salgado + 1 doce), cada um 55 = 28 + 27", () => {
    const adicionais = s.itens.filter((i) => !["Mini lanche", "Pão de queijo", "Cup cake", "Salada de frutas"].includes(i.item) && !i.bebida);
    expect(qtds(adicionais)).toEqual([28, 27, 28, 27]);
  });

  it("cup cake 55 = 28 + 27, nunca dois com chocolate", () => {
    const cupcakes = doItem(s, "Cup cake");
    expect(qtds(cupcakes)).toEqual([28, 27]);
    expect(cupcakes.filter((c) => /chocolate|nutella|prest[ií]gio|nh[aá] benta/i.test(c.receita)).length).toBeLessThanOrEqual(1);
  });

  it("salada de frutas 5 L sem ×1,6; café 5 L → 3 garrafas térmicas; suco + chá mate", () => {
    expect(doItem(s, "Salada de frutas")[0]).toMatchObject({ quantidade: 5, unidade: "L" });
    expect(doItem(s, "Café")[0]).toMatchObject({ quantidade: 5, unidade: "L", quantidadeTexto: "5 L · 3 garrafas térmicas", estacao: "EXPEDICAO_BEBIDAS" });
    expect(doItem(s, "Suco")[0]!.receita).toBe("Suco de laranja");
    expect(doItem(s, "Chá gelado")[0]!.receita).toBe("Chá mate gelado");
    expect(r.bloqueios).toEqual([]);
  });

  it("não deixa tirar o chá mate do suco", () => {
    expect(programar([coffee({ bebidas: ["Café", "Suco"] })]).bloqueios.map((b) => b.codigo)).toEqual(["DUPLA_BEBIDAS"]);
  });

  it("é determinístico: mesma entrada, mesma programação", () => {
    expect(programar([coffee(), coffee({ periodo: "TARDE", horarioInicio: "15:00", horarioFim: "16:00" })]))
      .toEqual(programar([coffee(), coffee({ periodo: "TARDE", horarioInicio: "15:00", horarioFim: "16:00" })]));
  });
});

describe("Composição e sabores", () => {
  const dia = [coffee({ tier: "STANDARD" }), coffee({ tier: "STANDARD", periodo: "TARDE", horarioInicio: "15:00", horarioFim: "16:00" })];

  it("blanquet só de manhã; frango desfiado só de tarde", () => {
    const [manha, tarde] = programar(dia).servicos;
    expect(doItem(manha!, "Mini lanche")[0]!.receita).toContain("Blanquet");
    expect(doItem(tarde!, "Mini lanche").some((i) => /blanquet/i.test(i.receita))).toBe(false);
    const exec = programar([coffee(), coffee({ periodo: "TARDE", horarioInicio: "15:00", horarioFim: "16:00" })]).servicos;
    expect(doItem(exec[0]!, "Mini lanche")[0]!.receita).not.toMatch(/desfiado/i);
  });

  it("nunca repete item entre manhã e tarde (exceto base fixa e mini lanche vegetariano)", () => {
    const [manha, tarde] = programar([coffee(), coffee({ periodo: "TARDE", horarioInicio: "15:00", horarioFim: "16:00" })]).servicos;
    const variaveis = (s: ServicoProgramacao) => s.itens.filter((i) => !i.bebida && !["Pão de queijo", "Salada de frutas"].includes(i.item) && !(i.item === "Mini lanche" && i.selo)).map((i) => i.receita);
    expect(variaveis(manha!).filter((r) => variaveis(tarde!).includes(r))).toEqual([]);
  });

  it("evento longo: nunca wrap à tarde, nunca 2 cup cakes com chocolate no período e alerta quando acabam os sem chocolate", () => {
    const dias = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"];
    const r = programar(dias.flatMap((data) => [coffee({ data, tier: "MASTER" }), coffee({ data, tier: "MASTER", periodo: "TARDE", horarioInicio: "15:00", horarioFim: "16:00" })]));
    for (const s of r.servicos) {
      if (s.periodo === "TARDE") expect(s.itens.some((i) => i.item === "Wrap" || i.item === "Envelope gourmet")).toBe(false);
      expect(doItem(s, "Cup cake").filter((c) => /chocolate|nutella|prest[ií]gio|nh[aá] benta/i.test(c.receita)).length).toBeLessThanOrEqual(1);
    }
    expect(r.avisos.some((a) => a.includes("sem chocolate"))).toBe(true);
  });

  it("suco da tarde em rodízio por dia; manhã sempre laranja", () => {
    const r = programar(["2026-11-20", "2026-11-21"].flatMap((data) => [coffee({ data }), coffee({ data, periodo: "TARDE", horarioInicio: "15:00", horarioFim: "16:00" })]));
    expect(r.servicos.map((s) => doItem(s, "Suco")[0]!.receita)).toEqual(["Suco de laranja", "Suco de laranja", "Suco de laranja", "Suco de maracujá"]);
  });

  it("item acima do tier contratado bloqueia e sinaliza ao comercial", () => {
    const r = programar([coffee({ tier: "STANDARD", itens: [{ catalogoId: idDe("Mini Cup Mix de Castanhas") }] })]);
    expect(r.bloqueios).toMatchObject([{ codigo: "TIER", autoriza: "COMERCIAL" }]);
  });

  it("lista negra: atum pula e sinaliza; com autorização explícita do cliente, entra", () => {
    const pulado = programar([coffee({ itens: [{ catalogoId: idDe("Atum") }] })]);
    expect(pulado.servicos[0]!.itens.some((i) => /atum/i.test(i.receita))).toBe(false);
    expect(pulado.avisos.join()).toContain("Lista negra");
    const autorizado = programar([coffee({ itens: [{ catalogoId: idDe("Atum"), autorizado: true }] })]);
    expect(autorizado.servicos[0]!.itens.some((i) => /atum/i.test(i.receita))).toBe(true);
  });

  it("vocabulário travado: nunca brioche integral, cumbuca, bolo redondo nem CE", () => {
    const r = programar([coffee({ itens: [{ nome: "Mini lanche de queijo no brioche integral", item: "Mini lanche" }, { nome: "Bolo redondo de cenoura" }, { nome: "Salada na cumbuca" }, { nome: "Mini lanche de peru no brioche CE", item: "Mini lanche" }] })]);
    const receitas = r.servicos[0]!.itens.map((i) => i.receita).join(" | ");
    expect(receitas).toContain("brioche de cenoura");
    expect(receitas).toContain("bolo inteiro de cenoura");
    expect(receitas).toContain("Salada na travessa");
    expect(receitas).not.toMatch(/brioche integral|cumbuca|bolo redondo|\bCE\b/i);
  });
});

describe("Outras linhas de serviço", () => {
  it("Welcome 27 pax: pão de queijo 2/pax 70/30 = 38 + 17; 1 petit four salgado + 2 doces", () => {
    const s = programar([{ data: DIA, linha: "WELCOME", tier: "EXECUTIVE", periodo: "MANHA", horarioInicio: "08:00", horarioFim: "09:00", pax: 27 }]).servicos[0]!;
    expect(qtds(doItem(s, "Pão de queijo"))).toEqual([38, 17]);
    const petit = doItem(s, "Petit four");
    expect(petit.map((p) => p.receita)).toEqual(["Petit four salgado — gergelim", "Petit four doce — ferradura", "Petit four doce — serquilho"]);
    expect(qtds(petit)).toEqual([27, 27, 27]);
    const basic = programar([{ data: DIA, linha: "WELCOME", tier: "BASIC", periodo: "MANHA", horarioInicio: "08:00", horarioFim: "09:00", pax: 27 }]).servicos[0]!;
    expect(qtds(doItem(basic, "Petit four"))).toEqual([27, 14, 14]);
  });

  it("Auditório contratado 8h = 2 períodos: café 150 ml × 40 × 2 = 12 L → 8 térmicas; águas 120 + 80", () => {
    const s = programar([{ data: DIA, linha: "AUDITORIO", tier: "EXECUTIVE", periodo: "DIA", horarioInicio: "08:00", horarioFim: "16:00", pax: 40 }]).servicos[0]!;
    expect(s.itens.map((i) => [i.receita, i.quantidade, i.quantidadeTexto ?? null])).toEqual([
      ["Café", 12, "12 L · 8 garrafas térmicas"], ["Água sem gás", 120, null], ["Água com gás", 80, null]
    ]);
  });

  it("Auditório cortesia 4h: café 6 L → 4 térmicas + água na refresqueira 6 L, sem garrafa individual", () => {
    const s = programar([{ data: DIA, linha: "AUDITORIO", tier: "EXECUTIVE", periodo: "MANHA", horarioInicio: "08:00", horarioFim: "12:00", pax: 40, cortesia: true }]).servicos[0]!;
    expect(s.itens.map((i) => [i.receita, i.quantidade, i.quantidadeTexto])).toEqual([["Café", 6, "6 L · 4 garrafas térmicas"], ["Água na refresqueira", 6, "6 L"]]);
  });

  it("Coquetel: verrine 50 × 1,65 = 83 em 2 sabores (42 + 41); tábuas arredondadas na dezena; cerveja 1,5/pessoa em 2h, proporcional", () => {
    const s = programar([{ data: DIA, linha: "COQUETEL", tier: "EXECUTIVE", periodo: "NOITE", horarioInicio: "18:00", horarioFim: "21:00", pax: 50, bebidas: ["Suco", "Cerveja"] }]).servicos[0]!;
    expect(qtds(doItem(s, "Verrine"))).toEqual([42, 41]);
    expect(doItem(s, "Cerveja")[0]).toMatchObject({ receita: "Heineken", quantidade: 113, compradoPronto: true });
    const tabua = programar([{ data: DIA, linha: "COQUETEL", tier: "EXECUTIVE", periodo: "NOITE", horarioInicio: "18:00", horarioFim: "20:00", pax: 37 }]).servicos[0]!;
    expect(doItem(tabua, "Tábua de frios")[0]).toMatchObject({ quantidade: 0.23, quantidadeTexto: "Parma 90 g · Copa 70 g · Pastrami 70 g = 0,23 kg", fornecedor: "PAD_LETICIA" });
    expect(doItem(tabua, "Tábua de queijos")[0]).toMatchObject({ fornecedor: "MERCADO" });
  });

  it("Lunch Box: 1 kit por pax com os componentes da regra", () => {
    const s = programar([{ data: DIA, linha: "LUNCH_BOX", tier: "TRADICIONAL", periodo: "ALMOCO", horarioInicio: "12:00", horarioFim: "13:00", pax: 30, itens: [{ catalogoId: idDe("Copa") }] }]).servicos[0]!;
    expect(s.itens.map((i) => [i.item, i.quantidade])).toEqual([["Mini lanche", 30], ["Cup cake", 30], ["Verrine", 30], ["Suco", 30], ["Kit", 30]]);
  });

  it("Venda avulsa: preço unitário, café por garrafa cheia (2 L = 2 garrafas), sem taxa, serviço numa linha", () => {
    const r = precificarAvulso(regras, { data: DIA, itens: [{ chave: "CROISSANT_CATUPIRY", quantidade: 40 }], cafeLitros: 2 });
    expect(r.linhas.map((l) => [l.quantidade, l.valorCentavos])).toEqual([[40, 20000], [2, 14000]]);
    expect(r.servico).toEqual({ descritivo: "Serviço", valorCentavos: 35000 });
    expect(r.totalCentavos).toBe(69000); // café 1,5 L a R$ 70 (pendência resolvida pelos STATUS de set/2026)
  });
});

const almoco: ServicoVendido = {
  data: DIA, linha: "ALMOCO", tier: "EXECUTIVE", periodo: "ALMOCO", horarioInicio: "12:00", horarioFim: "14:00", pax: 40,
  almoco: {
    proteinas: [{ nome: "Peito de frango grelhado", insumo: "FRANGO" }, { nome: "Filé mignon ao molho roti", insumo: "FILE" }],
    acompanhamentos: [{ nome: "Arroz branco", insumo: "ARROZ" }], massa: { nome: "Penne ao sugo", insumo: "MASSA_SECA" },
    vegetariano: { nome: "Legumes grelhados" }, folhas: { nome: "Mix de folhas" }, sobremesas: [{ nome: "Mousse de maracujá", pudim: false }]
  }
};

describe("Caso 2 — comanda do almoço Executive, 40 pax", () => {
  const prog = programar([almoco]);
  const comanda = gerarComanda(regras, prog, { freelancers: null, locacoes: [] });
  const pagina = (tipo: string) => comanda.paginas.find((p) => p.tipo === tipo)!;
  const linhas = (tipo: string) => pagina(tipo).blocos.flatMap((b) => b.linhas);

  it("Cozinha Quente: só peso pronto, molho em linha própria, amostra 72 h, marmita e saída em branco", () => {
    const cq = linhas("COZINHA_QUENTE");
    expect(cq.find((l) => l.item === "Peito de frango grelhado")?.quantidade).toBe("6,3 kg");
    expect(cq.find((l) => l.item === "Molho — Peito de frango grelhado")?.quantidade).toBe("1,89 kg");
    expect(cq.find((l) => l.item === "Penne ao sugo")?.quantidade).toBe("5,46 kg");
    expect(JSON.stringify(comanda)).not.toMatch(/\bcru\b/i);
    const avisos = pagina("COZINHA_QUENTE").avisos.join(" | ");
    expect(avisos).toContain("congelada por 72 horas");
    expect(avisos).toContain("MARMITA DA EQUIPE PIEGGI (à parte do buffet): ____");
    expect(avisos).toContain("DIA E HORÁRIO DA SAÍDA: ______");
    expect(avisos).toContain("PESAGEM");
  });

  it("sobremesa em travessa × peso na Confeitaria; salada na Cozinha Fria", () => {
    expect(linhas("CONFEITARIA").find((l) => l.item === "Mousse de maracujá")?.quantidade).toBe("1 travessa · 42 pax × 60 g = 2,52 kg");
    expect(linhas("COZINHA_FRIA").find((l) => l.item === "Mix de folhas")?.quantidade).toBe("3,36 kg");
  });
});

describe("Caso 3 — plaquinha de coffee com café nos 3 momentos", () => {
  const item = (receita: string, i: string, sabor: string | null, extra: Partial<ItemProgramacao> = {}): ItemProgramacao =>
    ({ quantidade: 1, unidade: "UN", receita, item: i, sabor, ...extra });
  const servico = (id: string, periodo: ServicoProgramacao["periodo"], itens: ItemProgramacao[]): ServicoProgramacao =>
    ({ id, data: DIA, linha: "COFFEE_BREAK", tier: "EXECUTIVE", nome: id, periodo, horarioInicio: id, horarioFim: id, pax: 50, comReposicao: false, itens });
  const cafe = item("Café", "Café", null, { bebida: true });
  const programacao: Programacao = {
    cabecalho: cab(), avisos: [], servicos: [
      servico("09:00", "MANHA", [cafe, item("Pão de queijo tradicional", "Pão de queijo", "Tradicional", { selo: "VEGETARIANO" }), item("Pão de queijo integral", "Pão de queijo", "Integral", { selo: "VEGETARIANO", selosExtras: ["SEM_GLUTEN"] }),
        item("Bebezinho Maracujá", "Cup cake", "Maracujá", { selo: "VEGETARIANO", nomeEn: "Passion Fruit", nomeEs: "Maracuyá" }), item("Bebezinho Churros", "Cup cake", "Churros", { selo: "VEGETARIANO" }),
        item("Salada de frutas", "Salada de frutas", null, { selo: "VEGANO" })]),
      servico("12:00", "ALMOCO", [cafe]), servico("15:00", "TARDE", [cafe])
    ]
  };
  const r = gerarPlaquinhas(regras, programacao);
  const cards = r.dias[0]!.cards;

  it("6 cards: 1 café, 1 pão de queijo TRADICIONAL E INTEGRAL, 2 cup cakes, 2 de salada de frutas", () => {
    expect(cards.map((c) => [c.titulo, c.subtitulo])).toEqual([
      ["CAFÉ", "TRADICIONAL"], ["TRADICIONAL E INTEGRAL", "PÃO DE QUEIJO"], ["MARACUJÁ", "CUP CAKE"], ["CHURROS", "CUP CAKE"],
      ["SALADA DE FRUTAS", null], ["IOGURTE, GRANOLA, AVEIA, SUCRILHOS E MEL", "ADICIONAIS"]
    ]);
    expect(r.faltandoTraducao).toEqual([]);
    expect(r.bloqueios).toEqual([]);
  });

  it("EN/ES no formato CATEGORIA / Sabor; selos só os padrões, pão de queijo nunca sem glúten", () => {
    expect(cards[0]).toMatchObject({ en: "COFFEE / Traditional", es: "CAFÉ / Tradicional", selos: [] });
    expect(cards[1]).toMatchObject({ en: "CHEESE BREAD / Traditional & Whole Grain", es: "PAN DE QUESO / Tradicional y Integral", selos: ["VEGETARIANO"] });
    expect(cards[2]).toMatchObject({ en: "CUPCAKE / Passion Fruit", es: "CUPCAKE / Maracuyá", selos: ["VEGETARIANO"] });
    expect(cards[4]).toMatchObject({ en: "FRUIT SALAD", selos: ["VEGANO"] });
    expect(cards[5]!.selos).toEqual([]);
    expect(JSON.stringify(cards)).not.toMatch(/bebezinho/i);
  });

  it("mini lanche vegetariano: título VEGETARIANO, subtítulo o recheio; tradução faltando bloqueia", () => {
    const prog = programar([coffee()]);
    const todos = gerarPlaquinhas(regras, prog);
    const veg = todos.dias[0]!.cards.find((c) => c.titulo === "VEGETARIANO")!;
    expect(veg).toMatchObject({ subtitulo: "PROVOLONE", en: "SANDWICH / Provolone", selos: ["VEGETARIANO"] });
    const semTraducao = gerarPlaquinhas(regras, { ...programacao, servicos: [servico("09:00", "MANHA", [item("Quiche de alho-poró", "Quiche", "Alho-poró")])] });
    expect(semTraducao.faltandoTraducao).toEqual(["Alho-poró"]);
    expect(semTraducao.bloqueios).toMatchObject([{ codigo: "TRADUCAO" }]);
  });
});

describe("Caso 4 — fidelidade da comanda", () => {
  it("escreve integral (não troca por multigrãos) e corrige catuoiry → catupiry", () => {
    const servico: ServicoProgramacao = {
      id: "s1", data: DIA, linha: "COFFEE_BREAK", tier: "EXECUTIVE", nome: "Coffee Break da manhã", periodo: "MANHA", horarioInicio: "09:00", horarioFim: "10:00", pax: 50, comReposicao: false,
      itens: [
        { quantidade: 25, unidade: "UN", receita: "Pão de queijo integral", item: "Pão de queijo", estacao: "EXPEDICAO_ALIMENTACAO", compradoPronto: true },
        { quantidade: 40, unidade: "UN", receita: "Croissant de catuoiry", item: "Croissant", estacao: "CONFEITARIA" }
      ]
    };
    const c = gerarComanda(regras, { cabecalho: cab(), servicos: [servico], avisos: [] }, { freelancers: 3, locacoes: [] });
    const todas = c.paginas.flatMap((p) => p.blocos.flatMap((b) => b.linhas));
    expect(todas.map((l) => l.item)).toContain("Pão de queijo integral");
    expect(todas.map((l) => l.item).join()).not.toMatch(/multigr/i);
    const croissant = c.paginas.find((p) => p.tipo === "CONFEITARIA")!.blocos[0]!.linhas[0]!;
    expect(croissant).toMatchObject({ item: "Croissant de catupiry", quantidade: "40 un" });
    expect(croissant.detalhe).toContain("Recheio total: 600 g");
    const prontos = c.paginas.find((p) => p.tipo === "EXPEDICAO_ALIMENTACAO")!.blocos.find((b) => b.destaque === "AMBAR")!;
    expect(prontos.linhas).toEqual([{ quantidade: "25 un", item: "Pão de queijo integral" }]);
  });
});

describe("Comanda — 6 páginas, materiais e expedição", () => {
  const prog = programar(["2026-11-20", "2026-11-21"].map((data) => coffee({ data })));
  const c = gerarComanda(regras, prog, { freelancers: 4, locacoes: [], totalEventoCentavos: 2_000_000 });

  it("páginas por dia só das estações com item; Adriana única para o evento", () => {
    expect(c.paginas.map((p) => `${p.data} ${p.tipo}`)).toEqual([
      "2026-11-20 COZINHA_FRIA", "2026-11-20 CONFEITARIA", "2026-11-20 EXPEDICAO_ALIMENTACAO", "2026-11-20 EXPEDICAO_BEBIDAS",
      "2026-11-21 COZINHA_FRIA", "2026-11-21 CONFEITARIA", "2026-11-21 EXPEDICAO_ALIMENTACAO", "2026-11-21 EXPEDICAO_BEBIDAS"
    ]);
    expect(c.adriana).toMatchObject({ locacoes: [], freelancers: 4, verbaCentavos: 160000 });
  });

  it("materiais como sublinhas; térmica limpa/escaldada; pasta base; bandeja preta só no 1º dia", () => {
    const alim = c.paginas[2]!.blocos[0]!.linhas;
    expect(alim.find((l) => l.item.startsWith("Mini lanche"))!.materiais).toEqual(["Sem travessa (suporte de balcão); pegador + descanso", "Palito: 44"]);
    const beb = c.paginas[3]!;
    expect(beb.blocos[0]!.linhas.find((l) => l.item === "Café")).toMatchObject({ quantidade: "5 L · 3 garrafas térmicas", materiais: ["Enviar limpa/escaldada"] });
    const estrutura = (i: number) => c.paginas[i]!.blocos.find((b) => b.titulo === "ESTRUTURA E MATERIAIS")!.linhas.map((l) => `${l.quantidade} ${l.item}`);
    expect(estrutura(3)).toEqual(expect.arrayContaining(["2 Bandeja preta", "75 Copo descartável para bebida quente + mexedores", "55 Copo de vidro para suco e refri", "2 Gelo — pacote de 3 kg", "4 Uniforme, luvas e toucas (por freelancer)"]));
    expect(estrutura(7)).not.toContain("2 Bandeja preta");
    expect(c.paginas[0]!.blocos[0]!.linhas.find((l) => l.item === "Pasta base de lanche e wrap")).toMatchObject({ quantidade: "1,1 kg" });
    expect(beb.blocos.find((b) => b.titulo === "APOIO E IDENTIFICAÇÃO")!.linhas.map((l) => l.item)).toContain("1 bloco de etiquetas impressas: Acme — Convenção");
    expect(beb.avisos).toEqual(expect.arrayContaining(["MOTORISTAS: ANTES DE LEVAR, CHAMAR AS RESPONSÁVEIS PARA VALIDAR"]));
  });
});

describe("Caso 6 — regras de cliente nos documentos", () => {
  const estrutura = (clienteChave: string | null, endereco = "") => {
    const prog = programar([coffee()], { clienteChave, endereco });
    const c = gerarComanda(regras, prog, { freelancers: 2, locacoes: [] });
    const beb = c.paginas.find((p) => p.tipo === "EXPEDICAO_BEBIDAS")!;
    return { prog, itens: beb.blocos.flatMap((b) => b.linhas.map((l) => l.item)).join(" | ") };
  };

  it("StartSe: endereço preenchido sozinho, sem gelo, kit de limpeza, uniforme e forno", () => {
    const { prog, itens } = estrutura("STARTSE");
    expect(prog.cabecalho.endereco).toContain("Av. das Nações Unidas, 12901");
    expect(itens).not.toMatch(/Gelo|Kit de limpeza|Uniforme|Forno|Transformador/);
  });

  it("outro cliente no prédio do WTC é externo: gelo, kit de limpeza, uniforme, extensão, transformador e forno", () => {
    const { itens } = estrutura(null, "Av. das Nações Unidas, 12551 — 6º andar");
    for (const t of ["Gelo", "Kit de limpeza", "Uniforme", "1 extensão", "Transformador", "Forno elétrico"]) expect(itens).toContain(t);
  });

  it("StartSe: bebidas Ambev; orçamento sem valor por pessoa, sem taxa e sem logística", () => {
    const aud = programar([{ data: DIA, linha: "AUDITORIO", tier: "EXECUTIVE", periodo: "MANHA", horarioInicio: "08:00", horarioFim: "12:00", pax: 40 }], { clienteChave: "STARTSE" }).servicos[0]!;
    expect(aud.itens.map((i) => i.receita)).toEqual(["Café", "Minalba sem gás", "Minalba com gás"]);
    const p = gerarPropostaDoc(regras, { cabecalho: cab({ clienteChave: "STARTSE" }), data: DIA, tabela: "STARTSE_ATUAL", opcoes: [{ servicos: [{ descritivo: "Coffee III", linha: "COFFEE_BREAK", tier: "EXECUTIVE", pax: 50, horas: 1 }] }] });
    expect(p.orcamento).toEqual([{ descritivo: "Coffee III", pax: 50, porPessoaCentavos: null, valorCentavos: 220000 }]);
    expect(p.totalCentavos).toBe(220000);
    const comNomePieggi = gerarPropostaDoc(regras, { cabecalho: cab({ clienteChave: "STARTSE" }), data: DIA, tabela: "STARTSE_ATUAL", opcoes: [{ servicos: [{ descritivo: "Coffee Break Executive", linha: "COFFEE_BREAK", tier: "EXECUTIVE", pax: 50, horas: 1 }] }] });
    expect(comNomePieggi.avisos.join()).toContain("sem nome de linha Pieggi");
  });

  it("WTC: trocar item do cardápio bloqueia; aumentar quantidade passa", () => {
    const vendido = [{ catalogoId: idDe("Salame Comum"), quantidade: 55 }, { catalogoId: idDe("Maracujá"), quantidade: 55 }];
    const trocado = programar([coffee({ cardapioVendido: vendido, itens: [vendido[0]!, { catalogoId: idDe("Nhá Benta") }] })], { clienteChave: "WTC" });
    expect(trocado.bloqueios).toMatchObject([{ codigo: "CARDAPIO_TRAVADO", autoriza: "DIRETORIA" }]);
    const aumentado = programar([coffee({ cardapioVendido: vendido, itens: [{ ...vendido[0]!, quantidade: 60 }, vendido[1]!] })], { clienteChave: "WTC" });
    expect(aumentado.bloqueios).toEqual([]);
  });

  it("Inteli: pão de queijo 30/30/40, +1 refresqueira de água, 2 adicionais no Standard com a segunda variedade vegana", () => {
    const s = programar([coffee({ tier: "STANDARD" })], { clienteChave: "INTELI", endereco: "" });
    const servico = s.servicos[0]!;
    expect(s.cabecalho.endereco).toBe("Av. Prof. Almeida Prado, 520, São Paulo/SP");
    expect(servico.itens.filter((i) => /queijo|Croissant/.test(i.receita) && i.compradoPronto !== undefined && !i.item.startsWith("Mini")).slice(0, 3).map((i) => i.quantidade)).toEqual([30, 30, 40]);
    expect(servico.itens.find((i) => i.receita === "Refresqueira de água extra")?.quantidade).toBe(1);
    const adicionais = servico.itens.filter((i) => !["Mini lanche", "Pão de queijo", "Cup cake", "Salada de frutas", "Croissant"].includes(i.item) && !i.bebida && !/Croissant/.test(i.receita));
    expect(qtds(adicionais)).toEqual([28, 27, 28, 27]);
    expect(adicionais.map((a) => a.selo)).toEqual(["VEGETARIANO", "VEGETARIANO", "VEGETARIANO", "VEGANO"]);
    expect(s.avisos.join()).toContain("sem variedade vegana");
  });
});

describe("Caso 7 — vigência na comanda", () => {
  it("proteína 150 → 160 g com vigência de hoje: comanda do evento passado não muda; evento novo usa 160 g", () => {
    const nova: Regra = { codigo: "almoco.proteina_g", escopoTipo: "GLOBAL", escopoChave: "", valor: { COMPLETO: 160, INTERMEDIARIO: 170, REDUZIDO: 200 }, vigenteDesde: "2026-11-10", versao: 9, status: "APROVADA" };
    const frango = (data: string) => {
      const prog = gerarProgramacao([...regras, nova], catalogo, { cabecalho: cab({ datas: [data] }), servicos: [{ ...almoco, data }] });
      return gerarComanda([...regras, nova], prog, { freelancers: null, locacoes: [] }).paginas[0]!.blocos[0]!.linhas.find((l) => l.item === "Peito de frango grelhado")?.quantidade;
    };
    expect(frango("2026-11-06")).toBe("6,3 kg");
    expect(frango("2026-11-10")).toBe("6,72 kg");
  });
});

describe("Caso 8 — verba", () => {
  it("evento de R$ 20.000 → verba R$ 1.600, só essa linha; verba zero some", () => {
    expect(calcularVerba(regras, DIA, 2_000_000)).toBe(160000);
    expect(textoVerba(160000)).toBe("Verba: R$ 1.600,00");
    expect(textoVerba(0)).toBeNull();
    expect(gerarComanda(regras, programar([coffee()]), { freelancers: null, locacoes: [] }).adriana.verbaCentavos).toBe(0);
  });
});

describe("Proposta", () => {
  const base = { cabecalho: cab(), data: DIA, tabela: "EXTERNOS" };
  it("Caso 1 no orçamento: alimentação, taxa de 10% só sobre ela e logística; cardápio completo", () => {
    const prog = programar([coffee()]);
    const p = gerarPropostaDoc(regras, { ...base, opcoes: [{ servicos: [{ descritivo: "Coffee Break Executive — manhã", linha: "COFFEE_BREAK", tier: "EXECUTIVE", pax: 50, horas: 1, cardapio: prog.servicos[0] }] }] }, catalogo);
    expect(p.orcamento.map((l) => [l.descritivo, l.porPessoaCentavos, l.valorCentavos])).toEqual([
      ["Coffee Break Executive — manhã", 5000, 250000], ["Taxa de serviço (10%)", null, 25000], ["Logística", null, 25000]
    ]);
    expect(p.totalCentavos).toBe(300000);
    expect(p.formato).toBe("COMPLETO");
    expect(p.cardapios[0]!.itens[0]).toMatchObject({ quantidade: 44 });
    expect(p.cardapios[0]!.bebidas).toContain("Chá mate gelado");
    expect(JSON.stringify(p)).not.toMatch(/cmv|custo|repasse/i);
  });

  it("mais de uma opção: total 'a definir'; alcoólicos em bloco separado; louça premium só em almoço/jantar", () => {
    const p = gerarPropostaDoc(regras, { ...base, alcoolicos: [{ descritivo: "Bar de vinhos", pax: 50, valorCentavos: 300000 }], opcoes: [
      { titulo: "Opção 1", servicos: [{ descritivo: "Almoço", linha: "ALMOCO", tier: "EXECUTIVE", pax: 40, horas: 2 }] },
      { titulo: "Opção 2", servicos: [{ descritivo: "Coquetel", linha: "COQUETEL", tier: "BASIC", pax: 40, horas: 2 }] }
    ] });
    expect(p.totalCentavos).toBeNull();
    expect(p.formato).toBe("POCKET");
    expect(p.bebidasAlcoolicas).toEqual([{ descritivo: "Bar de vinhos", pax: 50, porPessoaCentavos: null, valorCentavos: 300000 }]);
    expect(p.opcionais).toEqual([{ descritivo: "Louça premium (opcional, não incluída no total)", valorTexto: "R$ 45,00 por pessoa" }]);
    const coquetel = gerarPropostaDoc(regras, { ...base, opcoes: [{ servicos: [{ descritivo: "Coquetel", linha: "COQUETEL", tier: "BASIC", pax: 40, horas: 2 }] }] });
    expect(coquetel.opcionais).toEqual([]);
  });

  it("Celebrar: cardápio sem quantidades; tramezzino nunca em proposta", () => {
    const prog = programar([coffee({ itens: [{ catalogoId: idDe("Tramezzino Homus") }] })]);
    const p = gerarPropostaDoc(regras, { ...base, cabecalho: cab({ clienteChave: "CELEBRAR" }), opcoes: [{ servicos: [{ descritivo: "Coffee", linha: "COFFEE_BREAK", tier: "EXECUTIVE", pax: 50, horas: 1, cardapio: prog.servicos[0] }] }] });
    expect(p.cardapios[0]!.itens.every((i) => i.quantidade === null)).toBe(true);
    expect(p.cardapios[0]!.itens.some((i) => /tramezzino/i.test(i.nome))).toBe(false);
    expect(p.bloqueios.map((b) => b.codigo)).toContain("LISTA_NEGRA");
  });
});
