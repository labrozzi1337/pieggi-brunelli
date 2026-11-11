import { describe, expect, it } from "vitest";
import { vincularItens } from "./nota-do-evento";

describe("NF-e do evento", () => {
  it("liga por grupo+nome, cai para o nome, soma quantidades e lista o que não tem produto", () => {
    const produtos = [
      { id: "p1", descricao: "Tzatziki Pieggi", grupo: "PIEGGI BOARD EXECUTIVE" },
      { id: "p2", descricao: "Tzatziki Pieggi", grupo: "OUTRO GRUPO" },
      { id: "p3", descricao: "Peito de Peru", grupo: "MINI SANDUÍCHE BASIC" }
    ];
    const cardapio = new Map([["c1", { grupo: "PIEGGI BOARD EXECUTIVE", nome: "Tzatziki Pieggi" }]]);
    const r = vincularItens([
      { nome: "Tzatziki (travessa)", quantidade: 2, unidade: "UN", cardapioItemId: "c1" },
      { nome: "Peito de peru", quantidade: 30, unidade: "UN" },
      { nome: "Peito de Peru", quantidade: 10, unidade: "UN" },
      { nome: "Tzatziki Pieggi", quantidade: 1, unidade: "UN" }, // nome repetido em dois grupos: ambíguo
      { nome: "Café", quantidade: 3, unidade: "L" }
    ], cardapio, produtos);
    expect(r.itens).toEqual([{ produtoId: "p1", quantidade: 2 }, { produtoId: "p3", quantidade: 40 }]);
    expect(r.semProduto).toEqual(["Tzatziki Pieggi (1 un)", "Café (3 l)"]);
  });
});
