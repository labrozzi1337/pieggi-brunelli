import { expect, it } from "vitest";
import { propostaSchema } from "./propostas";

it("valida o limite comercial sem aceitar dinheiro impreciso ou campos de aprovação", () => {
  const entrada = { briefing: { startse: false, categoria: "EXTERNOS", restricoesConfirmadas: true, restricoes: "", restritos: 0, cobrancaRestritos: "SEM_RESTRICOES", escopo: "Coffee confirmado" }, itens: [{ nome: "Coffee básico", servico: "Manhã", quantidade: 3, unidade: "PAX", preco: 11.49 }], desconto: 0.01, taxas: 2.15, custoEstimado: null, fontePreco: "Tabela conferida", alteracoes: "Primeira revisão", validade: "2099-12-31" };
  expect(propostaSchema.safeParse(entrada).success).toBe(true);
  expect(propostaSchema.safeParse({ ...entrada, taxas: 2.151 }).success).toBe(false);
  expect(propostaSchema.safeParse({ ...entrada, aprovado: true }).success).toBe(false);
  expect(propostaSchema.safeParse({ ...entrada, briefing: { ...entrada.briefing, restricoesConfirmadas: false } }).success).toBe(false);
});

it("bloqueia desconto acima de 5% e CMV acima de 33,3% pelas regras vigentes", async () => {
  const { travasDaProposta } = await import("./propostas");
  const { regrasIniciaisComoRegras } = await import("@/dominios/regras/regras-iniciais");
  const base = propostaSchema.parse({ briefing: { startse: false, categoria: "EXTERNOS", restricoesConfirmadas: true, restricoes: "", restritos: 0, cobrancaRestritos: "SEM_RESTRICOES", escopo: "Coffee confirmado" }, itens: [{ nome: "Coffee Executive", servico: "Manhã", quantidade: 50, unidade: "PAX", preco: 50 }], desconto: 0, taxas: 0, custoEstimado: 775, fontePreco: "Tabela Externos", alteracoes: "Primeira revisão", validade: "2099-12-31" });
  const regras = regrasIniciaisComoRegras();
  expect(travasDaProposta(regras, "2026-11-20", base).bloqueios).toEqual([]);
  expect(travasDaProposta(regras, "2026-11-20", { ...base, desconto: 200, custoEstimado: null }).bloqueios.map(b => b.codigo)).toEqual(["DESCONTO"]);
  // Piso de desconto: 8% sobre R$ 2.500 com custo de R$ 775 leva o CMV a 33,7%.
  expect(travasDaProposta(regras, "2026-11-20", { ...base, desconto: 200 }).bloqueios.map(b => b.codigo)).toEqual(["DESCONTO", "CMV"]);
  expect(travasDaProposta(regras, "2026-11-20", { ...base, custoEstimado: 875 }).bloqueios.map(b => b.codigo)).toEqual(["CMV"]);
});
