import { describe, expect, it } from "vitest";
import { chaveDoNome, doApi, impedimentos, novoServico, paraApi, pendenciasCriticas, periodoPadrao, restricoesApi } from "./eventos";

const evento = { data: "2026-12-01", inicio: "09:00", fim: "16:00", pax: 80 };

describe("fluxo guiado — ajudantes", () => {
  it("serviço novo herda data, horário e pax do evento", () => {
    const s = novoServico(evento, "COFFEE_BREAK", "EXECUTIVE");
    expect(s).toMatchObject({ data: "2026-12-01", horarioInicio: "09:00", horarioFim: "16:00", pax: 80, periodo: "MANHA", trocas: {} });
    expect(novoServico({ ...evento, inicio: "15:00" }, "COFFEE_BREAK", "EXECUTIVE").periodo).toBe("TARDE");
    expect(novoServico(evento, "ALMOCO", "EXECUTIVE").almoco).toBeDefined();
    expect([periodoPadrao("AUDITORIO", "08:00"), periodoPadrao("COQUETEL", "18:00"), periodoPadrao("LUNCH_BOX", "12:00")]).toEqual(["DIA", "NOITE", "ALMOCO"]);
  });

  it("monta o ServicoVendido sem campos vazios e volta para o formulário", () => {
    const almoco = { ...novoServico(evento, "ALMOCO", "EXECUTIVE"), almoco: { proteinas: "Frango grelhado, Filé ao molho", acompanhamentos: "Arroz", massa: "", vegetariano: "Legumes", sobremesas: "Pudim de leite" } };
    const coffee = { ...novoServico(evento, "COFFEE_BREAK", "EXECUTIVE"), trocas: { a: "b" } };
    const api = paraApi([coffee, almoco]);
    expect(api[0]).toEqual({ id: "s1", data: "2026-12-01", linha: "COFFEE_BREAK", tier: "EXECUTIVE", periodo: "MANHA", horarioInicio: "09:00", horarioFim: "16:00", pax: 80, trocas: { a: "b" } });
    expect(api[1]!.almoco).toMatchObject({ proteinas: [{ nome: "Frango grelhado" }, { nome: "Filé ao molho" }], massa: undefined, sobremesas: [{ nome: "Pudim de leite", pudim: true }] });
    const volta = doApi(api);
    expect(volta[1]!.almoco).toMatchObject({ proteinas: "Frango grelhado, Filé ao molho", vegetariano: "Legumes" });
    expect(volta[0]!.trocas).toEqual({ a: "b" });
  });

  it("reconhece cliente de regra própria pelo nome", () => {
    expect(chaveDoNome("StartSe Educação", ["INTELI", "STARTSE", "WTC"])).toBe("STARTSE");
    expect(chaveDoNome("Intelligent Ltda", ["INTELI"])).toBeNull();
  });

  it("três dados críticos: nunca deduzidos; endereço fixo dispensa endereço", () => {
    expect(pendenciasCriticas({}, false)).toEqual(["pax exato", "data", "horário de início e fim", "endereço completo", "contato"]);
    expect(pendenciasCriticas({ pax: 50, dataEvento: "2026-12-01", horarioInicio: "10:00", horarioFim: "09:00", contatoLocalNome: "Ana" }, true)).toEqual(["fim depois do início"]);
  });

  it("restrições zeradas não vão para a API; bloqueio e regra faltando impedem", () => {
    expect(restricoesApi({ itens: [{ tipo: "VEGANO", quantidade: 0 }], cobranca: "CORTESIA" })).toEqual({ itens: [] });
    expect(restricoesApi({ itens: [{ tipo: "VEGANO", quantidade: 2 }], cobranca: "PAGO" })).toEqual({ itens: [{ tipo: "VEGANO", quantidade: 2 }], cobranca: "PAGO" });
    expect(impedimentos({ bloqueios: [{ codigo: "CMV", mensagem: "CMV alto", autoriza: "DIRETORIA" }], regrasFaltando: ["preco.X"] })).toEqual(["CMV alto", "Regra não cadastrada: preco.X"]);
  });
});
