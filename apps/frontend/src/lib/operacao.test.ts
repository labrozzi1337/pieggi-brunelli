import { expect, it } from "vitest";
import { diasComSobrecarga, type EventoOperacao } from "./operacao";

it("alerta capacidade por data sem contar leads, perdidos ou eventos sem data", () => {
  const evento = { data_evento: "2026-12-10", etapa_comercial: "CONTRATO_ASSINADO", contrato_assinado_em: "2026-10-06T12:00:00Z" } as EventoOperacao;
  expect(diasComSobrecarga([evento, evento])).toEqual([]);
  expect(diasComSobrecarga([evento, evento, evento, { ...evento, etapa_comercial: "PERDIDO" }, { ...evento, contrato_assinado_em: null }, { ...evento, data_evento: null }])).toEqual([["2026-12-10", 3]]);
});
