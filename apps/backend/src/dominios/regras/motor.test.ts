import { describe, expect, it } from "vitest";
import { precificar, precoSugerido, quantidadesAlmoco, quantidadesCoffee, type EntradaAlmoco, type Regra } from "./motor";
import { regrasIniciaisComoRegras } from "./regras-iniciais";

// Casos de aceite da especificação de 05/11/2026 (§15), com os números exatos.
const regras = regrasIniciaisComoRegras();
const DATA = "2026-11-20";
const qtd = (linhas: Array<{ item: string; quantidade: number }>, item: string) => linhas.filter((l) => l.item.startsWith(item)).map((l) => l.quantidade);
const linha = <T extends { item: string }>(linhas: T[], item: string) => linhas.find((l) => l.item === item);
const coffeeExterno = { data: DATA, tabela: "EXTERNOS", descontoPercentual: 0, servicos: [{ linha: "COFFEE_BREAK" as const, tier: "EXECUTIVE", pax: 50, horas: 1 }] };
const BEBIDAS = ["Suco de laranja", "Chá mate gelado"];

describe("Caso 1 — Coffee Break Executive, Externos, 50 pax, 1h", () => {
  it("cobra 10% só sobre alimentação e fecha em R$ 3.000", () => {
    const r = precificar(regras, coffeeExterno);
    expect([r.alimentacaoCentavos, r.taxaCentavos, r.logisticaCentavos, r.totalCentavos]).toEqual([250000, 25000, 25000, 300000]);
    expect(r.bloqueios).toEqual([]);
  });

  it("explode as quantidades esperadas", () => {
    const r = quantidadesCoffee(regras, { data: DATA, tier: "EXECUTIVE", pax: 50, horas: 1, bebidas: BEBIDAS });
    expect(qtd(r.linhas, "Mini lanche de proteína")).toEqual([44]);
    expect(qtd(r.linhas, "Mini lanche vegetariano")).toEqual([11]);
    expect(linha(r.linhas, "Mini lanche vegetariano — Brioche de cenoura")?.detalhe).toBe("1 sabor");
    expect(qtd(r.linhas, "Pão de queijo")).toEqual([75, 25]);
    expect(qtd(r.linhas, "Adicional")).toEqual([28, 27, 28, 27]);
    expect(qtd(r.linhas, "Cup cake")).toEqual([28, 27]);
    expect(linha(r.linhas, "Salada de frutas")?.quantidade).toBe(5);
    expect(linha(r.linhas, "Café")).toMatchObject({ quantidade: 5, detalhe: "3 garrafas térmicas" });
    expect([r.bloqueios, r.regrasFaltando, r.regrasPendentes]).toEqual([[], [], []]);
  });

  it("não deixa tirar o chá mate do suco", () => {
    const r = quantidadesCoffee(regras, { data: DATA, tier: "EXECUTIVE", pax: 50, horas: 1, bebidas: ["Suco de laranja"] });
    expect(r.bloqueios.map((b) => b.codigo)).toEqual(["DUPLA_BEBIDAS"]);
  });
});

const almocoCompleto: EntradaAlmoco = {
  data: DATA, pax: 40,
  proteinas: [{ nome: "Peito de frango grelhado", insumo: "FRANGO" }, { nome: "Filé mignon ao molho roti", insumo: "FILE" }],
  acompanhamentos: [{ nome: "Arroz branco", insumo: "ARROZ" }],
  massa: { nome: "Penne ao sugo", insumo: "MASSA_SECA" }, vegetariano: { nome: "Legumes grelhados" },
  folhas: { nome: "Mix de folhas" }, sobremesas: [{ nome: "Mousse de maracujá", pudim: false }]
};

describe("Caso 2 — Almoço Executive, 40 pax, completo, 2 proteínas", () => {
  it("pesa pronto, molho em linha própria e corrige a compra pelo rendimento", () => {
    const r = quantidadesAlmoco(regras, almocoCompleto);
    expect(r.paxCalculo).toBe(42);
    expect(r.composicao).toBe("COMPLETO");
    expect(linha(r.linhas, "Peito de frango grelhado")).toMatchObject({ quantidade: 6.3, compraKg: 7.875 });
    expect(linha(r.linhas, "Molho — Peito de frango grelhado")?.quantidade).toBe(1.89);
    expect(linha(r.linhas, "Arroz branco")).toMatchObject({ quantidade: 5.46, compraKg: 1.82 });
    expect(linha(r.linhas, "Penne ao sugo")).toMatchObject({ quantidade: 5.46, compraKg: 2.374 });
    expect(linha(r.linhas, "Molho — Penne ao sugo")?.quantidade).toBe(2.73);
    expect(linha(r.linhas, "Legumes grelhados")?.quantidade).toBe(4.2);
    expect(linha(r.linhas, "Mix de folhas")).toMatchObject({ quantidade: 3.36, compraKg: 4.8 });
    expect(linha(r.linhas, "Mousse de maracujá")?.quantidade).toBe(2.52);
  });

  it("pudim a 80 g quando há duas sobremesas, a segunda segue a 60 g", () => {
    const r = quantidadesAlmoco(regras, { ...almocoCompleto, sobremesas: [{ nome: "Pudim", pudim: true }, { nome: "Mousse", pudim: false }] });
    expect(linha(r.linhas, "Pudim")?.quantidade).toBe(3.36);
    expect(linha(r.linhas, "Pudim")?.detalhe).toContain("3 forma(s)");
    expect(linha(r.linhas, "Mousse")?.quantidade).toBe(2.52);
  });

  it("sem massa vira intermediário: 170 g, não 150 g", () => {
    const r = quantidadesAlmoco(regras, { ...almocoCompleto, massa: undefined });
    expect(linha(r.linhas, "Peito de frango grelhado")?.quantidade).toBe(7.14);
  });
});

describe("Caso 5 — travas comerciais", () => {
  it("CMV 31% avisa e segue; 35% bloqueia para a diretoria", () => {
    const aviso = precificar(regras, { ...coffeeExterno, custoEstimado: 775 });
    expect(aviso.bloqueios).toEqual([]);
    expect(aviso.avisos.join()).toContain("CMV de 31.0%");
    expect(precificar(regras, { ...coffeeExterno, custoEstimado: 875 }).bloqueios).toMatchObject([{ codigo: "CMV", autoriza: "DIRETORIA" }]);
  });

  it("desconto de 8% bloqueia até a diretoria autorizar", () => {
    expect(precificar(regras, { ...coffeeExterno, descontoPercentual: 0.08 }).bloqueios).toMatchObject([{ codigo: "DESCONTO", autoriza: "DIRETORIA" }]);
  });

  it("coffee de 4h contínuas bloqueia por segurança alimentar", () => {
    const r = precificar(regras, { ...coffeeExterno, servicos: [{ linha: "COFFEE_BREAK", tier: "EXECUTIVE", pax: 50, horas: 4 }] });
    expect(r.bloqueios).toMatchObject([{ codigo: "DURACAO", autoriza: "DIRETORIA" }]);
  });

  it("evento de 12 pax cobra 20; Alphaville cobra logística de R$ 600", () => {
    const r = precificar(regras, { ...coffeeExterno, regioes: ["ALPHAVILLE"], servicos: [{ linha: "COFFEE_BREAK", tier: "EXECUTIVE", pax: 12, horas: 1 }] });
    expect(r.servicos[0]?.paxCobrado).toBe(20);
    expect(r.logisticaCentavos).toBe(60000);
  });

  it("preço sugerido = custo ÷ 0,30 arredondado para cima em R$ 0,50", () => {
    expect(precoSugerido(3.833, 0.3)).toBe(13);
  });
});

describe("Caso 6 — regras de cliente", () => {
  it("StartSe: sem logística e sem taxa", () => {
    const r = precificar(regras, { ...coffeeExterno, tabela: "STARTSE_ATUAL", cliente: "STARTSE" });
    expect([r.taxaCentavos, r.logisticaCentavos, r.totalCentavos]).toEqual([0, 0, 220000]);
  });

  it("Inteli: reposição +60% fixo, pão de queijo 30/30/40, refresqueira extra, 2 adicionais no Standard", () => {
    const preco = precificar(regras, { ...coffeeExterno, cliente: "INTELI", servicos: [{ linha: "COFFEE_BREAK", tier: "EXECUTIVE", pax: 50, horas: 2 }] });
    expect(preco.servicos[0]?.acrescimo).toBe(0.6);
    const q = quantidadesCoffee(regras, { data: DATA, cliente: "INTELI", tier: "STANDARD", pax: 50, horas: 1, bebidas: BEBIDAS });
    expect(q.linhas.filter((l) => /queijo|Croissant/.test(l.item)).map((l) => l.quantidade)).toEqual([30, 30, 40]);
    expect(linha(q.linhas, "Refresqueira de água extra")?.quantidade).toBe(1);
    expect(qtd(q.linhas, "Adicional")).toEqual([28, 27, 28, 27]);
  });

  it("reposição comum aplica ×1,6 sobre o alimento e +80% no preço de 2h", () => {
    expect(precificar(regras, { ...coffeeExterno, servicos: [{ linha: "COFFEE_BREAK", tier: "EXECUTIVE", pax: 50, horas: 2 }] }).servicos[0]?.acrescimo).toBe(0.8);
    const q = quantidadesCoffee(regras, { data: DATA, tier: "EXECUTIVE", pax: 50, horas: 2, bebidas: BEBIDAS });
    expect(qtd(q.linhas, "Mini lanche").reduce((a, b) => a + b, 0)).toBe(88);
    // Pendência resolvida pelo adendo de águas (01/09/2026): bebida não escala com reposição.
    expect(q.regrasPendentes.map((p) => p.codigo)).not.toContain("qtd.bebidas.aplica_reposicao");
    expect(q.linhas.find((l) => l.item === "Café")?.quantidade).toBe(5);
  });
});

describe("Caso 7 — vigência de regra", () => {
  it("mudar a gramatura hoje não altera evento passado; evento novo usa a nova", () => {
    const nova: Regra = { codigo: "almoco.proteina_g", escopoTipo: "GLOBAL", escopoChave: "", valor: { COMPLETO: 160, INTERMEDIARIO: 170, REDUZIDO: 200 }, vigenteDesde: "2026-11-10", versao: 2, status: "APROVADA" };
    const comNova = [...regras, nova];
    const frango = (data: string) => linha(quantidadesAlmoco(comNova, { ...almocoCompleto, data }).linhas, "Peito de frango grelhado")?.quantidade;
    expect(frango("2026-11-06")).toBe(6.3);
    expect(frango("2026-11-10")).toBe(6.72);
  });
});
