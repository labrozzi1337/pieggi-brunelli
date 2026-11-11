import { describe, expect, it } from "vitest";
import { regrasIniciaisComoRegras } from "@/dominios/regras/regras-iniciais";
import {
  aComprar, calcularAlertas, cmvEstimado, consolidarPorFornecedor, converter, custoMedioPonderado, custoPorFicha, explodirNecessidade,
  precoNormalizado, ranquearCotacao, segundaDaSemana, similaridade, sugerirInsumos, type InsumoCompra
} from "./calculos";

const rendimento = regrasIniciaisComoRegras().find((r) => r.codigo === "rendimento")!.valor as Record<string, number>;
const kg = (x: number) => Math.round(x * 1000) / 1000;

describe("unidades", () => {
  it("converte na mesma grandeza e recusa grandezas diferentes", () => {
    expect(converter(1500, "G", "KG")).toBe(1.5);
    expect(converter(2, "L", "ML")).toBe(2000);
    expect(converter(1, "KG", "L")).toBeNull();
    expect(converter(3, "TRAVESSA", "TRAVESSA")).toBe(3);
  });
  it("normaliza embalagens diferentes para preço por kg", () => {
    expect(precoNormalizado(45, 5, "KG")).toEqual({ preco: 9, base: "KG" });
    expect(precoNormalizado(5, 500, "G")).toEqual({ preco: 10, base: "KG" });
    expect(precoNormalizado(12, 6, "UN")).toEqual({ preco: 2, base: "UN" });
  });
});

describe("explosão de necessidade — Caso 2 (almoço 40 pax, PAX 42)", () => {
  const ficha = (insumo: string, chave: string) => [{ insumoId: insumo, unidadeItem: "KG", quantidade: 1, rendimento: rendimento[chave]! }];
  it("corrige pelo rendimento oficial", () => {
    expect(kg(explodirNecessidade(6.3, "KG", ficha("frango", "FRANGO")).linhas[0]!.corrigida)).toBe(7.875);
    expect(kg(explodirNecessidade(5.46, "KG", ficha("arroz", "ARROZ")).linhas[0]!.corrigida)).toBe(1.82);
    expect(kg(explodirNecessidade(5.46, "KG", ficha("massa", "MASSA_SECA")).linhas[0]!.corrigida)).toBe(2.374);
    expect(kg(explodirNecessidade(3.36, "KG", ficha("folhas", "FOLHAS")).linhas[0]!.corrigida)).toBe(4.8);
  });
  it("mantém a necessidade bruta e converte a unidade do item", () => {
    const r = explodirNecessidade(6300, "G", ficha("frango", "FRANGO"));
    expect(r.linhas[0]).toMatchObject({ bruta: 6.3, rendimento: 0.8 });
    expect(kg(r.linhas[0]!.corrigida)).toBe(7.875);
  });
  it("recusa unidade incompatível com a ficha", () => {
    expect(explodirNecessidade(10, "UN", ficha("frango", "FRANGO")).erro).toMatch(/UN.*KG/);
  });
  it("a comprar desconta estoque e pedido em aberto", () => {
    expect(aComprar(7.875, 2, 1)).toBe(4.875);
    expect(aComprar(1, 5, 0)).toBe(0);
    expect(aComprar(3, -2, 0)).toBe(3);
  });
});

describe("consolidação semanal", () => {
  it("soma eventos da semana num pedido só por fornecedor e arredonda embalagens depois de somar", () => {
    const insumos = new Map<string, InsumoCompra>([
      ["frango", { id: "frango", nome: "Peito de frango", unidade: "KG", estoque: 1, emPedido: 0, fornecedorId: "F1", embalagem: "caixa 2 kg", quantidadeEmbalagem: 2, precoEmbalagem: 40 }],
      ["queijo", { id: "queijo", nome: "Muçarela", unidade: "KG", estoque: 0, emPedido: 0, fornecedorId: "F2", embalagem: "peça 1 kg", quantidadeEmbalagem: 1, precoEmbalagem: 30 }]
    ]);
    const r = consolidarPorFornecedor(
      [{ insumoId: "frango", corrigida: 2.5, evento: "A" }, { insumoId: "frango", corrigida: 2.5, evento: "B" }, { insumoId: "queijo", corrigida: 0.4, evento: "B" }],
      insumos,
      [{ fornecedorId: "LET", descricao: "Mini croissant", quantidade: 50, unidade: "UN", evento: "A", demandaId: "d1" }, { fornecedorId: "LET", descricao: "mini croissant ", quantidade: 30, unidade: "UN", evento: "B", demandaId: "d2" }]
    );
    expect([...r.keys()].sort()).toEqual(["F1", "F2", "LET"]);
    expect(r.get("F1")![0]).toMatchObject({ necessidade: 5, quantidade: 4, embalagens: 2, precoEstimado: 80, eventos: ["A", "B"] });
    expect(r.get("F2")![0]).toMatchObject({ embalagens: 1, precoEstimado: 30 });
    expect(r.get("LET")).toHaveLength(1);
    expect(r.get("LET")![0]).toMatchObject({ quantidade: 80, demandaIds: ["d1", "d2"] });
  });
  it("semana começa na segunda", () => {
    expect(segundaDaSemana("2026-11-08")).toBe("2026-11-02");
    expect(segundaDaSemana("2026-11-09")).toBe("2026-11-09");
    expect(segundaDaSemana("2026-11-13")).toBe("2026-11-09");
  });
});

describe("custo", () => {
  it("custo médio ponderado", () => {
    expect(custoMedioPonderado(10, 20, 10, 30)).toBe(25);
    expect(custoMedioPonderado(0, 20, 5, 30)).toBe(30);
    expect(custoMedioPonderado(-3, 20, 5, 30)).toBe(30);
  });
  it("custo pela ficha e CMV estimado", () => {
    expect(custoPorFicha([{ quantidade: 0.15, rendimento: 0.8, custo: 20 }, { quantidade: 0.05, rendimento: 1, custo: 10 }])).toBe(4.25);
    expect(custoPorFicha([{ quantidade: 1, rendimento: 1, custo: null }])).toBeNull();
    expect(cmvEstimado(11, 10, 0.3)).toBe(0.33);
  });
});

describe("cotação", () => {
  const base = { prazoDias: 0, pedidoMinimo: 0, unidade: "KG" };
  it("normaliza embalagem e considera prazo e pedido mínimo", () => {
    const r = ranquearCotacao([
      { ...base, fornecedorId: "A", fornecedor: "A", preco: 50, quantidadeEmbalagem: 5 },            // 10/kg à vista
      { ...base, fornecedorId: "B", fornecedor: "B", preco: 5.1, quantidadeEmbalagem: 0.5, prazoDias: 60 }, // 10,2/kg em 60 dias
      { ...base, fornecedorId: "C", fornecedor: "C", preco: 9, quantidadeEmbalagem: 1, pedidoMinimo: 500 }  // 9/kg mas mínimo alto
    ], 0.02, 10);
    expect(r.map((o) => o.fornecedorId)).toEqual(["B", "A", "C"]);
    expect(r[0]).toMatchObject({ precoBase: 10.2, base: "KG", atendeMinimo: true });
    expect(r[2]!.atendeMinimo).toBe(false);
  });
});

describe("sugestão pelo nome da nota", () => {
  const candidatos = [{ id: "1", nome: "Peito de frango" }, { id: "2", nome: "Queijo muçarela" }, { id: "3", nome: "Arroz agulhinha", apelidos: ["arroz tp1 camil 5kg"] }];
  it("reconhece abreviações e acentos", () => {
    expect(similaridade("PEITO FRANGO CONG", "Peito de frango")).toBeGreaterThan(0.6);
    expect(sugerirInsumos("QJO MUCARELA FATIADO", candidatos)[0]?.id).toBe("2");
  });
  it("apelido aprendido vence", () => {
    expect(sugerirInsumos("ARROZ TP1 CAMIL 5KG", candidatos)[0]).toMatchObject({ id: "3", apelido: true, score: 1 });
  });
});

describe("alertas obrigatórios", () => {
  it("mínimo, validade, variação de preço, sem ficha e CMV", () => {
    const a = calcularAlertas({
      hoje: "2026-11-08", diasValidade: 3, variacaoPreco: 0.1, cmvAlerta: 0.32,
      insumos: [{ id: "i1", nome: "Frango", unidade: "KG", saldo: 1, estoqueMinimo: 5 }, { id: "i2", nome: "Arroz", unidade: "KG", saldo: 9, estoqueMinimo: 5 }],
      lotes: [{ insumoId: "i1", nome: "Frango", lote: "L1", validade: "2026-11-10", saldo: 1 }, { insumoId: "i1", nome: "Frango", lote: "L2", validade: "2026-12-10", saldo: 1 }],
      precos: [{ insumoId: "i1", nome: "Frango", precos: [23, 20] }, { insumoId: "i2", nome: "Arroz", precos: [5.2, 5] }],
      semFicha: [{ id: "c1", nome: "Quiche", motivo: "sem ficha técnica" }],
      cmv: [{ id: "c2", nome: "Escondidinho", cmv: 0.325 }, { id: "c3", nome: "Pão", cmv: 0.3 }]
    });
    expect(a.map((x) => x.tipo)).toEqual(["ESTOQUE_MINIMO", "VALIDADE", "VARIACAO_PRECO", "SEM_FICHA", "CMV"]);
    expect(a[2]!.mensagem).toMatch(/subiu 15%/);
  });
});
