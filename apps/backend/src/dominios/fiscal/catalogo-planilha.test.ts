import { describe, expect, it } from "vitest";
import { CABECALHO_FISCAL, planilhaTeste } from "@/testes/xlsx";
import { lerPlanilhaFiscal } from "./catalogo-planilha";

describe("planilha fiscal da contabilidade", () => {
  it("lê pelo cabeçalho, gera código pela aba e ignora serviço/NCM ambíguo", async () => {
    const buf = await planilhaTeste("Coffee Break", [
      ["PIEGGI EVENTOS — ESTUDO TRIBUTÁRIO"], [null],
      CABECALHO_FISCAL,
      [1, "Peito de Peru", "MINI SANDUÍCHE BASIC", "1905.90.90", "Padaria", "Alimentação (Regime Especial)", "5102", "90", "4,0% efet.", "—", "Regime especial", "01", "0,65%", "01", 0.03, null, "0 - Nacional", 3.833, 11.499],
      [2, "Kit de Descartáveis", "ITEM BASE", "—", "Serviço/locação — coberto pela taxa", "Serviço/Locação (taxa 10% — ISS)", "—", "—", "—"],
      [3, "Café", "ITEM BASE", "0901.21.00 ou 2101.12.00", "Café", "Alimentação", "5102", "90", "4%", null, null, "01", "0,65%", "01", "3%", null, "0"]
    ]);
    const { produtos, ignorados } = await lerPlanilhaFiscal(buf, "x.xlsx");
    expect(produtos).toEqual([expect.objectContaining({
      codigo: "COF-001", descricao: "Peito de Peru", ncm: "19059090", cfop_padrao: "5102", origem: "0", cst_icms: "90",
      aliquota_icms: 4, aliquota_pis: 0.65, aliquota_cofins: 3, custo_padrao: 3.833, preco_venda: 11.499, referencia_origem: "Coffee Break!4"
    })]);
    expect(ignorados.map((i) => [i.linha, i.motivo])).toEqual([[5, "Serviço/locação (ISS) — fora da NF-e de produto"], [6, "NCM não definido de forma única"]]);
  });

  it("recusa arquivo que não é planilha ou não tem as colunas fiscais", async () => {
    await expect(lerPlanilhaFiscal(Buffer.from("texto"), "a.xlsx")).rejects.toThrow("não é uma planilha");
    await expect(lerPlanilhaFiscal(await planilhaTeste("X", [["Nome", "Valor"], ["a", 1]]), "b.xlsx")).rejects.toThrow("Nenhum produto reconhecido");
  });
});
