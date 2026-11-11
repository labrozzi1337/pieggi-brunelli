import { describe, expect, it } from "vitest";
import { mascaraCep, mascaraCpfCnpj, mascaraTelefone } from "./mascaras";

describe("máscaras", () => {
  it("CPF/CNPJ conforme a quantidade de dígitos, inclusive parcial", () => {
    expect(mascaraCpfCnpj("12345678901")).toBe("123.456.789-01");
    expect(mascaraCpfCnpj("19131243000197")).toBe("19.131.243/0001-97");
    expect(mascaraCpfCnpj("191312")).toBe("191.312");
    expect(mascaraCpfCnpj("19.131.243/0001-97 ")).toBe("19.131.243/0001-97");
  });
  it("telefone fixo e celular; CEP", () => {
    expect(mascaraTelefone("1123851939")).toBe("(11) 2385-1939");
    expect(mascaraTelefone("11987654321")).toBe("(11) 98765-4321");
    expect(mascaraTelefone("")).toBe("");
    expect(mascaraTelefone("+55 11 98765-4321")).toBe("(11) 98765-4321");
    expect(mascaraCep("01310100")).toBe("01310-100");
  });
});
