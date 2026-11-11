import { describe, expect, it } from "vitest";
import type { CabecalhoEvento, ServicoProgramacao } from "@/dominios/documentos/tipos";
import { catalogoDaCarga } from "./catalogo-carga";
import { gerarComanda } from "./comanda";
import { precificar, resolverRegra } from "./motor";
import { gerarPlaquinhas } from "./plaquinha";
import { gerarProgramacao, type ServicoVendido } from "./programacao";
import { gerarPropostaDoc } from "./proposta";
import { regrasIniciaisComoRegras } from "./regras-iniciais";

// Carga 4: regras dos documentos de Documentos/Pieggi (ver docs/regras-rastreabilidade.md).
const regras = regrasIniciaisComoRegras();
const catalogo = catalogoDaCarga();
const DIA = "2026-11-20";
const cab = (extra: Partial<CabecalhoEvento> = {}): CabecalhoEvento => ({
  eventoId: "ev-1", contratante: "Acme", cliente: "Acme", clienteChave: null, evento: "Convenção", contato: "Ana", telefoneContato: null,
  pax: 40, datas: [DIA], horarioInicio: "09:00", horarioFim: "18:00", endereco: "Rua das Flores, 100, São Paulo/SP", restricoes: [], ...extra
});
const programar = (servicos: ServicoVendido[], extra: Partial<CabecalhoEvento> = {}) => gerarProgramacao(regras, catalogo, { cabecalho: cab(extra), servicos });
const doItem = (s: ServicoProgramacao, item: string) => s.itens.filter((i) => i.item === item);

describe("Coquetel: preço por variante de cerveja + reposição por duração", () => {
  const base = { data: DIA, tabela: "EXTERNOS", descontoPercentual: 0 };
  it("os 3 valores da tabela são sem cerveja / lata / long neck; a duração entra pela reposição (+30% em 3 h)", () => {
    const tres = precificar(regras, { ...base, servicos: [{ linha: "COQUETEL", tier: "EXECUTIVE", pax: 50, horas: 3 }] });
    expect(tres.servicos[0]).toMatchObject({ precoPax: 115, acrescimo: 0.3, valorCentavos: 747500 });
    const longNeck = precificar(regras, { ...base, servicos: [{ linha: "COQUETEL", tier: "EXECUTIVE", pax: 50, horas: 2, variante: "LONG_NECK" }] });
    expect(longNeck.servicos[0]).toMatchObject({ precoPax: 135, acrescimo: 0 });
    const errada = precificar(regras, { ...base, servicos: [{ linha: "COQUETEL", tier: "EXECUTIVE", pax: 50, horas: 2, variante: "GARRAFA" }] });
    expect(errada.bloqueios.map((b) => b.codigo)).toContain("PRECO");
  });
  it("auditório continua por faixa de horas; Externos Coffee Basic/Standard e tabela WTC carregadas", () => {
    expect(precificar(regras, { ...base, servicos: [{ linha: "AUDITORIO", tier: "EXECUTIVE", pax: 10, horas: 8 }] }).servicos[0]?.precoPax).toBe(19);
    expect(precificar(regras, { ...base, servicos: [{ linha: "COFFEE_BREAK", tier: "STANDARD", pax: 30, horas: 1 }] }).servicos[0]?.precoPax).toBe(48);
    expect(precificar(regras, { ...base, tabela: "WTC", cliente: "WTC", servicos: [{ linha: "ALMOCO", tier: "MASTER", pax: 30, horas: 2 }] }).servicos[0]?.precoPax).toBe(235);
  });
  it("Guarulhos tem logística própria", () => {
    expect(precificar(regras, { ...base, regioes: ["GUARULHOS"], servicos: [{ linha: "COFFEE_BREAK", tier: "EXECUTIVE", pax: 30, horas: 1 }] }).logisticaCentavos).toBe(50000);
  });
});

describe("Pendências respondidas pelos documentos", () => {
  it("amostra 72 h, frutas laminadas 50 g e bebida sem reposição saem de PENDENTE", () => {
    for (const codigo of ["almoco.amostra_vigilancia_horas", "qtd.frutas_laminadas", "qtd.bebidas.aplica_reposicao", "preco.avulso.CAFE_GARRAFA"]) {
      expect(resolverRegra(regras, codigo, { data: DIA })?.status).toBe("APROVADA");
    }
    expect(resolverRegra(regras, "qtd.frutas_laminadas", { data: DIA })?.valor).toEqual({ gPorPax: 50, tiers: ["EXECUTIVE", "MASTER"] });
  });
  it("a mudança não retroage: evento antes de 09/11/2026 continua com a versão antiga", () => {
    expect(resolverRegra(regras, "preco.avulso.CAFE_GARRAFA", { data: "2026-11-06" })?.valor).toBe(78);
  });
});

describe("Brunch: composição sugerida (tabela 2026 + cardápios de brunch)", () => {
  const prog = programar([{ data: DIA, linha: "BRUNCH", tier: "BASIC", periodo: "ALMOCO", horarioInicio: "12:00", horarioFim: "14:00", pax: 40 }]);
  const s = prog.servicos[0]!;
  it("2 tortas salgadas, 1 quiche, estações com piso de 600 g + 15 g/pax acima de 30, verrine 2,2/pax em 2 sabores, sem pão de queijo", () => {
    expect(doItem(s, "Torta salgada")).toHaveLength(2);
    expect(doItem(s, "Quiche")).toHaveLength(1);
    const guaca = s.itens.find((i) => /guacamole/i.test(i.receita))!;
    expect(guaca).toMatchObject({ quantidade: 0.75, unidade: "KG", estacao: "COZINHA_FRIA" });
    expect(doItem(s, "Verrine").map((i) => i.quantidade)).toEqual([44, 44]);
    expect(doItem(s, "Pão de queijo")).toHaveLength(0);
    expect(s.itens.filter((i) => i.bebida).map((i) => i.receita)).toEqual(["Suco de laranja", "Água na refresqueira", "Coca-Cola", "Coca-Cola Zero"]);
  });
  it("a plaquinha da estação sai num card só, com o nome inteiro e a tradução do cadastro", () => {
    const p = gerarPlaquinhas(regras, prog);
    expect(p.faltandoTraducao).toEqual([]);
    expect(p.dias[0]!.cards).toContainEqual(expect.objectContaining({ titulo: "GUACAMOLE COM DORITOS", subtitulo: null, en: "Guacamole with Doritos" }));
  });
});

describe("Coquetel Standard: o motor sugere a composição do tier", () => {
  it("estações + mini hambúrguer 2/pax + patês", () => {
    const s = programar([{ data: DIA, linha: "COQUETEL", tier: "STANDARD", periodo: "NOITE", horarioInicio: "18:00", horarioFim: "20:00", pax: 50 }]).servicos[0]!;
    expect(doItem(s, "Mini hambúrguer")[0]).toMatchObject({ quantidade: 100, estacao: "COZINHA_QUENTE" });
    expect(doItem(s, "Estação").map((i) => i.receita)).toEqual(expect.arrayContaining(["Guacamole com Doritos", "Homus com pão sírio"]));
    expect(doItem(s, "Cerveja")[0]).toMatchObject({ receita: "Heineken", quantidade: 75 });
  });
});

describe("Comanda: suco na Confeitaria, açúcar/adoçante por dose de café, água de preparo", () => {
  const prog = programar([{ data: DIA, linha: "COFFEE_BREAK", tier: "EXECUTIVE", periodo: "MANHA", horarioInicio: "09:00", horarioFim: "10:00", pax: 50 }]);
  const c = gerarComanda(regras, prog, { freelancers: 2, locacoes: [] });
  const pagina = (tipo: string) => c.paginas.find((p) => p.tipo === tipo)!;
  const linhas = (tipo: string) => pagina(tipo).blocos.flatMap((b) => b.linhas);
  it("suco: receitas de 1,7 L na Confeitaria e separado na Expedição — Alimentação, nunca na Bebidas", () => {
    const suco = linhas("CONFEITARIA").find((l) => /suco/i.test(l.item))!;
    expect(suco.detalhe).toMatch(/^4 receita\(s\) de ~1,7 L/);
    expect(linhas("EXPEDICAO_ALIMENTACAO").find((l) => /suco/i.test(l.item))?.materiais).toEqual(["Enviar limpa/escaldada"]);
    expect(linhas("EXPEDICAO_BEBIDAS").some((l) => /^suco/i.test(l.item))).toBe(false);
  });
  it("café 5 L → 50 sachês de açúcar e 50 de adoçante; água de preparo = café + água quente", () => {
    const estrutura = linhas("EXPEDICAO_BEBIDAS").map((l) => `${l.quantidade} ${l.item}`);
    expect(estrutura).toEqual(expect.arrayContaining([expect.stringMatching(/^50 Sachê de açúcar/), expect.stringMatching(/^50 Sachê de adoçante/), expect.stringMatching(/^7 L — ÁGUA MINALBA EM GALÃO/)]));
    expect(estrutura.some((l) => /MALETA DE FINALIZAÇÃO/.test(l))).toBe(false);
  });
  it("Zup e Celebrar: tarjas próprias", () => {
    const zup = gerarComanda(regras, { ...prog, cabecalho: { ...prog.cabecalho, clienteChave: "CELEBRAR" } }, { freelancers: 1, locacoes: [] });
    expect(zup.paginas.find((p) => p.tipo === "EXPEDICAO_ALIMENTACAO")!.avisos.join(" ")).toMatch(/CELEBRAR: pão de queijo em várias entregas/);
  });
});

describe("Proposta StartSe: nome do serviço da StartSe × linha Pieggi", () => {
  it("Coffee III vendido como Standard gera aviso", () => {
    const r = gerarPropostaDoc(regras, {
      cabecalho: cab({ clienteChave: "STARTSE" }), data: DIA, tabela: "STARTSE_ATUAL",
      opcoes: [{ servicos: [{ descritivo: "Coffee III", linha: "COFFEE_BREAK", tier: "STANDARD", pax: 40, horas: 1 }] }]
    });
    expect(r.avisos.join(" ")).toMatch(/"Coffee III" é COFFEE_BREAK EXECUTIVE/);
  });
});
