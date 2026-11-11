import { describe, expect, it } from "vitest";
import { calcularTotaisDocumento, itemDocumentoFiscalSchema } from "./validacao";

describe("calcularTotaisDocumento", () => {
  it("recalcula o total fiscal sem aceitar total vindo do cliente", () => {
    expect(calcularTotaisDocumento([{ descricao: "Produto", ncm: "12345678", cfop: "5102", unidade: "UN", quantidade: 2, valorUnitario: 10, origem: "0", cst: "000", desconto: 1, frete: 2 }])).toEqual({ produtos: 20, desconto: 1, frete: 2, seguro: 0, outrasDespesas: 0, notaFiscal: 21 });
  });

  it("preserva o vinculo valido do item com o catalogo", () => {
    const item = itemDocumentoFiscalSchema.parse({ produtoId: "2443116f-d5ec-5376-a535-02b9b3712ca0", descricao: "Produto", ncm: "12345678", cfop: "5102", unidade: "UN", quantidade: 1, valorUnitario: 10, origem: "0", cst: "90" });

    expect(item.produtoId).toBe("2443116f-d5ec-5376-a535-02b9b3712ca0");
  });
});
