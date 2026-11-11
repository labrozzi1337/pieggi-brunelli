import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cifrarSegredoFiscal, decifrarSegredoFiscal } from "./criptografia";

describe("criptografia fiscal", () => {
  it("recupera a senha sem persistir seu texto puro", () => {
    const chave = randomBytes(32).toString("base64");
    const cifrado = cifrarSegredoFiscal("senha-a1", chave);

    expect(cifrado).not.toContain("senha-a1");
    expect(decifrarSegredoFiscal(cifrado, chave)).toBe("senha-a1");
  });
});
