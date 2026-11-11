import { describe, expect, it } from "vitest";
import { gerarAgenda } from "./agenda";
import { tipoImagem } from "./imagem";

describe("fronteiras operacionais", () => {
  it("exporta agenda com identidade estável, escape e linhas UTF-8 limitadas", () => {
    const texto = gerarAgenda({ id:"evento-1", titulo:"Reunião;\nBEGIN:FAKE," + "á".repeat(80), data:"2026-10-06",inicio:"10:00",fim:"12:00",local:"Rua, 1",revisao:2 }, new Date("2026-10-06T10:00:00Z"));
    expect(texto).toContain("UID:evento-1@pieggi");
    expect(texto).toContain("DTSTART;TZID=America/Sao_Paulo:20261006T100000");
    expect(texto).not.toContain("\r\nBEGIN:FAKE");
    expect(texto.split("\r\n").every(linha => Buffer.byteLength(linha) <= 75)).toBe(true);
  });
  it("não aceita HTML disfarçado de foto", () => {
    expect(tipoImagem(Buffer.from("<html>arquivo</html>"))).toBeNull();
  });
});
