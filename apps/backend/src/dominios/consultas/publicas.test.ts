import { describe, expect, it } from "vitest";
import { formatarCep, formatarTelefone, mapearEmpresa } from "./publicas";

describe("consultas públicas", () => {
  it("normaliza a resposta do OpenCNPJ e prefere o endereço do ViaCEP", () => {
    const r = { cnpj: "19131243000197", razao_social: "OPEN KNOWLEDGE BRASIL", nome_fantasia: "REDE PELO CONHECIMENTO LIVRE", situacao_cadastral: "Ativa",
      tipo_logradouro: "AVENIDA", logradouro: "PAULISTA 37", numero: "37", complemento: "ANDAR 4", bairro: "BELA VISTA", cep: "01311902", uf: "SP",
      municipio: "SAO PAULO", email: "X@Y.COM", telefones: [{ ddd: "11", numero: "23851939", is_fax: false }] };
    const viaCep = { cep: "01311-902", logradouro: "Avenida Paulista", numero: "", complemento: "", bairro: "Bela Vista", cidade: "São Paulo", uf: "SP", ibge: "3550308" };
    const e = mapearEmpresa(r, viaCep);
    expect(e).toMatchObject({ razaoSocial: "Open Knowledge Brasil", email: "x@y.com", telefone: "(11) 2385-1939" });
    expect(e.endereco).toEqual({ cep: "01311-902", logradouro: "Avenida Paulista", numero: "37", complemento: "Andar 4", bairro: "Bela Vista", cidade: "São Paulo", uf: "SP", ibge: "3550308" });
    expect(mapearEmpresa(r, null).endereco).toMatchObject({ logradouro: "Avenida Paulista 37", cidade: "Sao Paulo", ibge: "" });
  });
  it("formata telefone e CEP", () => {
    expect(formatarTelefone("11987654321")).toBe("(11) 98765-4321");
    expect(formatarCep("01310100")).toBe("01310-100");
  });
});
