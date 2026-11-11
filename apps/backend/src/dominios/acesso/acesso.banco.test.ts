import { afterAll, describe, expect, it } from "vitest";
import { criarUsuario, empresaPadrao, sqlTeste } from "@/testes/banco";
import { carregarUsuario, ErroAutorizacao } from "./autenticacao";

const sql = sqlTeste();
afterAll(() => sql.end());

describe("acesso com banco real", () => {
  it("carrega papéis e empresas e barra perfil sem permissão", async () => {
    const empresa = await empresaPadrao(sql);
    const u = await criarUsuario(sql, empresa, ["COMERCIAL"]);
    const carregado = await carregarUsuario(u.id, u.email);
    expect(carregado.papeis).toEqual(["COMERCIAL"]);
    expect(carregado.empresas).toEqual([empresa]);
    await expect(carregarUsuario(u.id, u.email, ["ADMIN"])).rejects.toBeInstanceOf(ErroAutorizacao);
  });
});
