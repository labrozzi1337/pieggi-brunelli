import { describe, expect, it } from "vitest";
import { autorizarEmpresa, ErroAutorizacao, extrairToken, type UsuarioAutenticado } from "./autenticacao";

const usuario: UsuarioAutenticado = { id: "1", email: "admin@pieggi.local", nome: "Admin", papeis: ["ADMIN"], empresas: ["68b78b8c-1d79-49a7-9fae-dba38f3aeb50"] };

describe("autorizacao", () => {
  it("aceita token Bearer e bloqueia empresa fora do escopo", () => {
    expect(extrairToken(new Request("http://localhost", { headers: { authorization: "Bearer token-valido" } }))).toBe("token-valido");
    expect(() => autorizarEmpresa(usuario, "2443116f-d5ec-5376-a535-02b9b3712ca0")).toThrow(ErroAutorizacao);
  });
});
