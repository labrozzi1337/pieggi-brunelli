import { describe, expect, it } from "vitest";
import { Leitor, type Regra } from "@/dominios/regras/motor";
import { arquivoPix, calcularVerba, cnpjValido, compararVerba, montarRelatorio, valorDaDiaria, type DiariaRelatorio } from "./regras-freelancer";

const regra = (escopoChave: string, valor: number, vigenteDesde = "2026-11-05", versao = 1): Regra =>
  ({ codigo: "freelancer.diaria", escopoTipo: "ITEM", escopoChave, valor, vigenteDesde, versao, status: "PENDENTE" });

describe("freelancers — regras puras", () => {
  it("valida CNPJ pelos dígitos verificadores", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11222333000181")).toBe(true);
    expect(cnpjValido("11.222.333/0001-82")).toBe(false);
    expect(cnpjValido("00000000000000")).toBe(false);
    expect(cnpjValido("123")).toBe(false);
  });

  it("diária: valor individual sobrescreve o padrão da função; tabela vale pela data do dia", () => {
    const regras = [regra("COPEIRA", 200), regra("COPEIRA", 230, "2026-12-01", 2)];
    expect(valorDaDiaria(new Leitor(regras, { data: "2026-11-20" }), "COPEIRA", null)).toEqual({ valorCentavos: 20000, origem: "FUNCAO" });
    expect(valorDaDiaria(new Leitor(regras, { data: "2026-12-05" }), "COPEIRA", null)).toEqual({ valorCentavos: 23000, origem: "FUNCAO" });
    expect(valorDaDiaria(new Leitor(regras, { data: "2026-11-20" }), "COPEIRA", 275.5)).toEqual({ valorCentavos: 27550, origem: "INDIVIDUAL" });
    expect(valorDaDiaria(new Leitor(regras, { data: "2026-11-20" }), "GARCOM", null)).toBeUndefined();
  });

  it("Caso 8: evento de R$ 20.000 → verba R$ 1.600; alerta só quando a escala estoura; verba zero", () => {
    const verba = calcularVerba(2_000_000, 0.08);
    expect(verba).toBe(160_000);
    expect(compararVerba(verba, 4 * 20_000)).toMatchObject({ estourou: false, saldoCentavos: 80_000, exibirVerba: true });
    expect(compararVerba(verba, 160_000).estourou).toBe(false);
    expect(compararVerba(verba, 160_001).estourou).toBe(true);
    expect(compararVerba(calcularVerba(0, 0.08), 0)).toMatchObject({ verbaCentavos: 0, exibirVerba: false, estourou: false });
    expect(compararVerba(0, 20_000).estourou).toBe(true);
  });

  it("Caso 8: 4 copeiras com 1 diária → 4 linhas, total geral e subtotais", () => {
    const diarias: DiariaRelatorio[] = [1, 2, 3, 4].map((i) => ({
      id: `d${i}`, freelancerId: `f${i}`, nome: `Copeira ${i}`, cnpj: "11.222.333/0001-81", pix: `pix${i}@exemplo`, funcao: "COPEIRA",
      valorCentavos: 20_000, status: "PENDENTE", eventoId: "e1", evento: "Evento 20k", data: "2026-11-20", local: "WTC", pagamentoId: null, pagoEm: null, comprovante: null
    }));
    const r = montarRelatorio(diarias);
    expect(r.linhas).toHaveLength(4);
    expect(r.linhas[0]).toMatchObject({ nome: "Copeira 1", funcao: "COPEIRA", diarias: 1, valorDiariaCentavos: 20_000, totalCentavos: 20_000, status: "PENDENTE" });
    expect(r.totais).toMatchObject({ diarias: 4, geralCentavos: 80_000, pendenteCentavos: 80_000, porFuncao: [{ funcao: "COPEIRA", diarias: 4, totalCentavos: 80_000 }] });
    expect(r.totais.porEvento).toEqual([{ eventoId: "e1", evento: "Evento 20k", diarias: 4, totalCentavos: 80_000 }]);

    const csv = arquivoPix(r.linhas, "PIEGGI-X").split("\r\n");
    expect(csv[0]).toBe("nome;documento;chave_pix;valor;identificador");
    expect(csv[1]).toBe("Copeira 1;11.222.333/0001-81;pix1@exemplo;200,00;PIEGGI-X-f1");
    expect(csv).toHaveLength(6);
  });

  it("agrupa diárias da mesma pessoa e separa o que já foi pago", () => {
    const base = { freelancerId: "f1", nome: "Ana", cnpj: "", pix: "", funcao: "COPEIRA", valorCentavos: 20_000, eventoId: "e1", evento: "E", local: "", pagoEm: null, comprovante: null };
    const r = montarRelatorio([
      { ...base, id: "a", data: "2026-11-20", status: "PENDENTE", pagamentoId: null },
      { ...base, id: "b", data: "2026-11-21", status: "PENDENTE", pagamentoId: null },
      { ...base, id: "c", data: "2026-11-01", status: "PAGO", pagamentoId: "p1", pagoEm: "2026-11-05" }
    ]);
    expect(r.linhas.map((l) => [l.status, l.diarias, l.totalCentavos])).toEqual([["PENDENTE", 2, 40_000], ["PAGO", 1, 20_000]]);
    expect(r.totais).toMatchObject({ geralCentavos: 60_000, pendenteCentavos: 40_000, pagoCentavos: 20_000 });
    expect(arquivoPix(r.linhas, "X").split("\r\n")[1]).toContain(";400,00;");
  });
});
