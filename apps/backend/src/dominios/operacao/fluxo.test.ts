import { describe, expect, it } from "vitest";
import type { CabecalhoEvento } from "@/dominios/documentos/tipos";
import { gerarDocumentoValidado } from "@/dominios/documentos/validacao";
import { catalogoDaCarga } from "@/dominios/regras/catalogo-carga";
import { gerarComanda } from "@/dominios/regras/comanda";
import { gerarPlaquinhas } from "@/dominios/regras/plaquinha";
import type { ServicoVendido } from "@/dominios/regras/programacao";
import { regrasIniciaisComoRegras } from "@/dominios/regras/regras-iniciais";
import { chaveDoNome, chavesComRegra, fixosDoCliente } from "./clientes";
import { aplicarSobrescritas, itensLegados } from "./estrutura";
import { calcular, propostaGuiadaSchema, sugestao, type ContextoEvento } from "./fluxo";
import { disposicao } from "./documentos-evento";

const regras = regrasIniciaisComoRegras();
const catalogo = catalogoDaCarga().map((i) => ({ ...i, custo: i.custo ?? null }));
const DIA = "2026-11-20";
const cabecalho: CabecalhoEvento = {
  eventoId: "ev", contratante: "Acme", cliente: "Acme", clienteChave: null, evento: "Convenção", contato: "Ana", telefoneContato: null,
  pax: 50, datas: [DIA], horarioInicio: "09:00", horarioFim: "10:00", endereco: "Rua das Flores, 100, Centro, São Paulo/SP, 01000-000", restricoes: []
};
const ctx = (extra: Partial<ContextoEvento> = {}): ContextoEvento => ({
  evento: { id: "ev", empresa_id: "", revisao: 1, titulo: "Convenção", data_evento: DIA, pax: 50 }, cliente: { nome: "Acme", chave_regras: null },
  regras, catalogo, fixos: { chave: null }, cabecalho, tabela: "EXTERNOS", regioes: [], data: DIA, comValores: true, ...extra
});
const coffee = (extra: Partial<ServicoVendido> = {}): ServicoVendido => ({ data: DIA, linha: "COFFEE_BREAK", tier: "EXECUTIVE", periodo: "MANHA", horarioInicio: "09:00", horarioFim: "10:00", pax: 50, ...extra });

describe("clientes de regra própria", () => {
  it("reconhece a chave pelo nome e preenche endereço, contato e tabela pelas regras", () => {
    const chaves = chavesComRegra(regras);
    expect(chaveDoNome("StartSe Educação Ltda", chaves)).toBe("STARTSE");
    expect(chaveDoNome("Inteli - Instituto de Tecnologia", chaves)).toBe("INTELI");
    expect(chaveDoNome("Intelligence SA", chaves)).toBeNull();
    expect(fixosDoCliente(regras, "STARTSE", DIA).endereco).toContain("12901");
    expect(fixosDoCliente(regras, "STARTSE", DIA).tabela).toBe("STARTSE_ATUAL");
    expect(fixosDoCliente(regras, "INTELI", DIA)).toMatchObject({ contato: "Gabriel", endereco: "Av. Prof. Almeida Prado, 520, São Paulo/SP" });
    expect(fixosDoCliente(regras, null, DIA)).toEqual({ chave: null, endereco: undefined, contato: undefined, tabela: "EXTERNOS" });
  });
});

describe("sugestão e proposta pelo motor (Caso 1)", () => {
  const c = ctx();
  const calc = calcular(c, [coffee()]);

  it("preço do Caso 1: R$ 2.500 + taxa R$ 250 + logística R$ 250 = R$ 3.000, sem bloqueio", () => {
    expect(calc.valores?.preco.totalCentavos).toBe(300000);
    expect(calc.bloqueios).toEqual([]);
    expect(calc.regrasFaltando).toEqual([]);
    const s = sugestao(c, calc);
    expect(s.orcamento?.linhas.map((l) => l.valorCentavos)).toEqual([250000, 25000, 25000]);
    expect(s.servicos[0]!.itens.filter((i) => i.item === "Mini lanche").map((i) => i.quantidade)).toEqual([44, 11]);
    expect(Object.keys(s.servicos[0]!.alternativas)).toContain("Mini lanche");
  });

  it("sem valores para quem não vê valores: nada de orçamento, custo ou CMV", () => {
    const s = sugestao(ctx({ comValores: false }), calcular(ctx({ comValores: false }), [coffee()]));
    expect(s.orcamento).toBeNull();
    expect(JSON.stringify(s)).not.toMatch(/custo|cmv/i);
  });

  it("trocar um item sugerido mantém posição e quantidade", () => {
    const s = sugestao(c, calc).servicos[0]!;
    const original = s.itens.find((i) => i.item === "Cup cake" && i.cardapioItemId)!;
    const outro = s.alternativas["Cup cake"]!.find((a) => a.id !== original.cardapioItemId && !s.itens.some((i) => i.cardapioItemId === a.id))!;
    const trocado = calcular(c, [coffee({ trocas: { [original.cardapioItemId!]: outro.id } })]).programacao.servicos[0]!.itens;
    const novo = trocado.find((i) => i.cardapioItemId === outro.id)!;
    expect(novo.quantidade).toBe(original.quantidade);
    expect(trocado.some((i) => i.cardapioItemId === original.cardapioItemId)).toBe(false);
  });

  it("WTC: cardápio travado não aceita troca", () => {
    const wtc = ctx({ cliente: { nome: "WTC", chave_regras: "WTC" }, cabecalho: { ...cabecalho, clienteChave: "WTC" } });
    const r = calcular(wtc, [coffee({ trocas: { a: "b" } })]);
    expect(r.bloqueios.map((b) => b.codigo)).toContain("CARDAPIO_TRAVADO");
    expect(sugestao(wtc, r).opcoes.travado).toBe(true);
  });
});

describe("os 4 arquivos a partir de um único cadastro", () => {
  it("proposta, programação, comanda e plaquinha saem válidos", async () => {
    const calc = calcular(ctx(), [coffee(), coffee({ periodo: "TARDE", horarioInicio: "15:00", horarioFim: "16:00" })]);
    const programacao = { cabecalho: calc.programacao.cabecalho, servicos: calc.programacao.servicos, avisos: calc.programacao.avisos };
    const comanda = gerarComanda(regras, programacao, { freelancers: null, locacoes: [] });
    const plaquinhas = gerarPlaquinhas(regras, programacao);
    expect(plaquinhas.faltandoTraducao).toEqual([]);
    const docs = await Promise.all([
      gerarDocumentoValidado({ tipo: "PROPOSTA", dados: calc.valores!.documento }),
      gerarDocumentoValidado({ tipo: "PROGRAMACAO", dados: programacao }),
      gerarDocumentoValidado({ tipo: "COMANDA", dados: comanda }),
      gerarDocumentoValidado({ tipo: "PLAQUINHA", dados: plaquinhas })
    ]);
    expect(docs.map((d) => d.nome)).toEqual([
      "Pieggi Proposta - Acme - Convenção - Ana - 20-11-2026.pptx", "Pieggi Programacao - Acme - Convenção - Ana - 20-11-2026.docx",
      "Pieggi Comanda - Acme - Convenção - Ana - 20-11-2026.docx", "Pieggi Plaquinha - Acme - Convenção - Ana - 20-11-2026.pdf"
    ]);
    expect(disposicao(docs[0].nome)).toBe(`attachment; filename="Pieggi Proposta - Acme - Convencao - Ana - 20-11-2026.pptx"; filename*=UTF-8''Pieggi%20Proposta%20-%20Acme%20-%20Conven%C3%A7%C3%A3o%20-%20Ana%20-%2020-11-2026.pptx`);
  });
});

describe("programação: formato legado e sobrescrita manual", () => {
  const p = calcular(ctx(), [coffee()]).programacao;
  const estrutura = { cabecalho: p.cabecalho, servicos: p.servicos, avisos: p.avisos };
  const itens = itensLegados(estrutura);

  it("cada item vira uma linha legada com setor, vínculo e referência", () => {
    expect(itens.length).toBe(estrutura.servicos[0]!.itens.filter((i) => i.quantidade > 0).length);
    expect(itens.every((i) => i.setor !== "A_CLASSIFICAR" && /^\d+:\d+$/.test(i.ref ?? "") && i.receita.length >= 5)).toBe(true);
    expect(itens.find((i) => i.nome === "Café")).toMatchObject({ setor: "BEBIDAS", unidade: "L", quantidade: 5 });
  });

  it("sem mudança, a estrutura não muda; mudança de quantidade e item novo ficam no antes/depois", () => {
    expect(aplicarSobrescritas(estrutura, itens)).toEqual({ estrutura, mudancas: [] });
    const editados = itens.map((i) => (i.nome === "Café" ? { ...i, quantidade: 6 } : i)).filter((i) => !/^salada de frutas/i.test(i.nome));
    editados.push({ nome: "Bolo de fubá", receita: "Bolo de fubá inteiro", quantidade: 2, unidade: "UN", setor: "CONFEITARIA", servico: itens[0]!.servico });
    const r = aplicarSobrescritas(estrutura, editados);
    const cafe = r.estrutura.servicos[0]!.itens.find((i) => i.receita === "Café")!;
    expect(cafe).toMatchObject({ quantidade: 6, quantidadeTexto: undefined, estacao: "EXPEDICAO_BEBIDAS" });
    expect(r.estrutura.servicos[0]!.itens.at(-1)).toMatchObject({ receita: "Bolo de fubá", estacao: "CONFEITARIA" });
    expect(r.mudancas.map((m) => [m.item, m.depois === null])).toEqual([["Café", false], ["Bolo de fubá", false], [expect.stringMatching(/salada de frutas/i), true]]);
  });
});

describe("contrato da API", () => {
  it("aceita o serviço vendido como a tela manda e recusa horário invertido", () => {
    const corpo = { revisao: 1, chave: "8f8e4b1e-6c1a-4d65-9b8a-1d2c3e4f5a6b", confirmado: true, servicos: [{ ...coffee(), id: "s1", descritivo: "Coffee III", trocas: { a: "b" } }], restricoes: { itens: [{ tipo: "VEGANO", quantidade: 2 }], cobranca: "CORTESIA" } };
    expect(propostaGuiadaSchema.parse(corpo).servicos[0]).toMatchObject({ horarioInicio: "09:00", descritivo: "Coffee III" });
    expect(propostaGuiadaSchema.safeParse({ ...corpo, servicos: [{ ...coffee(), horarioInicio: "11:00" }] }).success).toBe(false);
    expect(propostaGuiadaSchema.safeParse({ ...corpo, servicos: [{ ...coffee(), horarioInicio: "9h" }] }).success).toBe(false);
  });
});
