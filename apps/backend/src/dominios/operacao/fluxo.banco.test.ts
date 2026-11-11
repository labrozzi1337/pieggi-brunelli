import { randomUUID } from "node:crypto";
import JSZip from "jszip";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import { registrarDocumentoOperacional } from "@/dominios/campo/registros";
import type { Programacao } from "@/dominios/documentos/tipos";
import { alterarRegra } from "@/dominios/nucleo/regras";
import type { ServicoVendido } from "@/dominios/regras/programacao";
import { criarUsuario, empresaPadrao, sqlTeste } from "@/testes/banco";
import { documentoDoEvento } from "./documentos-evento";
import { atualizarEvento, eventoEntrada, hojeSaoPaulo, salvarEvento, type Evento } from "./eventos";
import { gerarProgramacaoDoEvento, gerarPropostaGuiada, sugerirParaEvento } from "./fluxo";
import { comandoSchema } from "./http";
import { operarEvento, type Comando } from "./programacao";
import { createHash } from "node:crypto";
import { registrarContrato } from "@/dominios/campo/registros";

const sql = sqlTeste();
afterAll(() => sql.end());
let empresa: string;
let admin: UsuarioAutenticado, comercial: UsuarioAutenticado, programador: UsuarioAutenticado, cozinha: UsuarioAutenticado;
beforeAll(async () => {
  empresa = await empresaPadrao(sql);
  [admin, comercial, programador, cozinha] = await Promise.all([
    criarUsuario(sql, empresa, ["ADMIN"]), criarUsuario(sql, empresa, ["COMERCIAL"]), criarUsuario(sql, empresa, ["PROGRAMACAO"]), criarUsuario(sql, empresa, ["PRODUCAO"])
  ]);
});

const somarDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const evento = async (id: string) => (await sql<{ j: Evento }[]>`select to_jsonb(e) j from eventos e where id = ${id}`)[0]!.j;
const criar = async (data: string, extra: Record<string, unknown> = {}) => (await sql.begin((tx) => salvarEvento(tx, comercial, null, eventoEntrada.parse({
  empresaId: empresa, titulo: "Convenção anual", pax: 50, dataEvento: data, horarioInicio: "09:00", horarioFim: "16:00",
  logradouro: "Rua das Flores", numeroEndereco: "100", bairro: "Centro", cidade: "São Paulo", uf: "SP", cep: "01000-000", contatoLocalNome: "Ana",
  cliente: { tipo: "PJ", nome: `Acme ${randomUUID().slice(0, 6)}`, documento: null, email: "", telefone: null }, ...extra
})))).evento as Evento;
const proposta = async (id: string, servicos: ServicoVendido[], u = comercial) =>
  sql.begin(async (tx) => gerarPropostaGuiada(tx, u, id, { revisao: (await evento(id)).revisao, chave: randomUUID(), servicos, descontoPercentual: 0, restricoes: { itens: [] }, confirmado: true }));
const assinar = (id: string) => sql.begin((tx) => atualizarEvento(tx, admin, id, { contrato_assinado_em: new Date().toISOString() }));
const gerar = async (id: string) => sql.begin(async (tx) => gerarProgramacaoDoEvento(tx, programador, id, (await evento(id)).revisao));
const operar = async (id: string, comando: Comando) => sql.begin(async (tx) => operarEvento(tx, programador, id, (await evento(id)).revisao, comandoSchema.parse({ revisao: 1, comando }).comando));
const coffee = (data: string, extra: Partial<ServicoVendido & { descritivo: string }> = {}): ServicoVendido => ({ data, linha: "COFFEE_BREAK", tier: "EXECUTIVE", periodo: "MANHA", horarioInicio: "09:00", horarioFim: "10:00", pax: 50, ...extra });

describe("fluxo guiado: um cadastro, quatro arquivos", () => {
  it("cliente + evento → proposta aprovada → programação gerada → 4 documentos válidos", async () => {
    const data = somarDias(hojeSaoPaulo(), 30);
    const e = await criar(data);
    expect(e.tabela_preco).toBe("EXTERNOS");
    const servicos = [coffee(data), coffee(data, { periodo: "TARDE", horarioInicio: "15:00", horarioFim: "16:00" })];

    // Prévia do assistente: comercial vê valores; programação não vê custo nem CMV.
    const previa = await sugerirParaEvento(sql, comercial, e.id, { servicos, descontoPercentual: 0, restricoes: { itens: [] } });
    expect(previa.orcamento?.totalCentavos).toBeGreaterThan(0);
    expect(previa.servicos[0]!.itens.length).toBeGreaterThan(5);
    expect((await sugerirParaEvento(sql, programador, e.id, { servicos, descontoPercentual: 0, restricoes: { itens: [] } })).orcamento).toBeNull();

    // Antes da proposta não há programação; antes do contrato a programação não sai.
    await expect(gerar(e.id)).rejects.toThrow("Aprove a proposta antes de gerar a programação.");
    const p = await proposta(e.id, servicos);
    const [linha] = await sql<{ status: string; briefing: { servicos: ServicoVendido[] }; itens: unknown[] }[]>`select status, briefing, itens from propostas where id = ${p.propostaId}`;
    expect(linha).toMatchObject({ status: "APROVADA" });
    expect(linha!.briefing.servicos).toHaveLength(2);
    expect(linha!.briefing.servicos.every((s) => s.reposicao === false)).toBe(true);
    await expect(gerar(e.id)).rejects.toThrow("Contrato ainda não formalizado.");

    await assinar(e.id);
    const g = await gerar(e.id);
    const [prog] = await sql<{ status: string; estrutura: Programacao; itens: Array<{ setor: string; ref: string }>; roteiro_campo: unknown[] }[]>`
      select status, estrutura, itens, roteiro_campo from programacoes where id = ${g.id}`;
    expect(prog).toMatchObject({ status: "RASCUNHO" });
    expect(prog!.estrutura.servicos).toHaveLength(2);
    expect(prog!.itens.every((i) => i.setor !== "A_CLASSIFICAR" && i.ref)).toBe(true);
    expect(prog!.roteiro_campo).toHaveLength(3);

    // Programação em rascunho: o .docx sai para conferência; comanda e plaquinha só depois de aprovar.
    expect((await documentoDoEvento(sql, programador, e.id, "programacao")).nome).toMatch(/^Pieggi Programacao - .* - Convenção anual - Ana - \d{2}-\d{2}-\d{4}\.docx$/);
    await expect(documentoDoEvento(sql, programador, e.id, "comanda")).rejects.toThrow("Aprove a programação");
    await operar(e.id, { acao: "PROGRAMACAO_APROVAR", dados: {} });

    const arquivos = await Promise.all([
      documentoDoEvento(sql, comercial, e.id, "proposta"), documentoDoEvento(sql, programador, e.id, "programacao"),
      documentoDoEvento(sql, cozinha, e.id, "comanda"), documentoDoEvento(sql, programador, e.id, "plaquinha")
    ]);
    expect(arquivos.map((a) => a.nome.split(" - ")[0])).toEqual(["Pieggi Proposta", "Pieggi Programacao", "Pieggi Comanda", "Pieggi Plaquinha"]);
    expect(arquivos.map((a) => a.mime.split("/")[1]!.slice(0, 15))).toEqual(["vnd.openxmlform", "vnd.openxmlform", "vnd.openxmlform", "pdf"]);
    expect(arquivos.every((a) => a.buffer.length > 1000)).toBe(true);
    for (const a of arquivos.slice(1)) {
      await registrarDocumentoOperacional(sql, programador, { programacaoId: a.programacaoId!, tipo: a.nome.includes("Plaquinha") ? "PLAQUINHAS" : a.nome.includes("Comanda") ? "COMANDA" : "PROGRAMACAO", setor: "", sha256: createHash("sha256").update(a.buffer).digest("hex") });
    }
    const [{ n }] = await sql<[{ n: number }]>`select count(*)::int n from documentos_operacionais where programacao_id = ${g.id}`;
    expect(n).toBe(3);

    // Perfis (§13): comercial não gera comanda; cozinha não gera programação.
    await expect(documentoDoEvento(sql, comercial, e.id, "comanda")).rejects.toMatchObject({ status: 403 });
    await expect(documentoDoEvento(sql, cozinha, e.id, "programacao")).rejects.toMatchObject({ status: 403 });

    // Sobrescrita manual pela ação existente: nova versão, estrutura ajustada e antes/depois auditado.
    const [atual] = await sql<{ itens: Array<Record<string, unknown> & { nome: string; quantidade: number }>; saida_em: Date; roteiro_campo: Array<Record<string, unknown>> }[]>`select itens, saida_em, roteiro_campo from programacoes where id = ${g.id}`;
    const itens = atual!.itens.map((i) => (i.nome === "Café" ? { ...i, quantidade: 9 } : i));
    const nova = await operar(e.id, { acao: "PROGRAMACAO_SALVAR", dados: { saidaEm: atual!.saida_em.toISOString(), alteracoes: "Mais café a pedido do cliente", itens, roteiroCampo: atual!.roteiro_campo } } as Comando);
    const [v2] = await sql<{ estrutura: Programacao }[]>`select estrutura from programacoes where id = ${nova.id}`;
    expect(v2!.estrutura.servicos.flatMap((s) => s.itens).filter((i) => i.receita === "Café").map((i) => i.quantidade)).toContain(9);
    const [auditoria] = await sql<{ usuario_id: string; dados: { mudancas: Array<{ item: string }> } }[]>`select usuario_id, dados from auditoria_eventos where acao = 'PROGRAMACAO_SOBRESCRITA' and entidade_id = ${nova.id}`;
    expect(auditoria).toMatchObject({ usuario_id: programador.id, dados: { mudancas: [{ item: "Café", depois: "9 L · Café" }, { item: "Café" }] } });
  });

  it("cliente de endereço fixo: StartSe preenche endereço e tabela sozinho e a proposta passa nos gates", async () => {
    const data = somarDias(hojeSaoPaulo(), 40);
    const e = await criar(data, { logradouro: null, numeroEndereco: null, bairro: null, cidade: null, uf: null, cep: null, cliente: { tipo: "PJ", nome: `StartSe ${randomUUID().slice(0, 4)}`, documento: null, email: "", telefone: null } });
    expect(e.logradouro).toContain("Av. das Nações Unidas, 12901");
    expect(e).toMatchObject({ tabela_preco: "STARTSE_ATUAL", numero_endereco: null });
    const p = await proposta(e.id, [coffee(data, { descritivo: "Coffee III" })]);
    expect(p.totalCentavos).toBeGreaterThan(0);
    const doc = await documentoDoEvento(sql, comercial, e.id, "proposta");
    const zip = await JSZip.loadAsync(doc.buffer);
    const textos = (await Promise.all(Object.keys(zip.files).filter((f) => /slides\/slide\d+\.xml$/.test(f)).map((f) => zip.file(f)!.async("string")))).join(" ");
    expect(textos).toContain("Coffee III");
    expect(textos).toContain("12901");
  });

  it("gates: falta de dado crítico bloqueia a proposta com a lista do que falta", async () => {
    const e = await criar(somarDias(hojeSaoPaulo(), 50), { pax: null, contatoLocalNome: null });
    await expect(proposta(e.id, [coffee(somarDias(hojeSaoPaulo(), 50))])).rejects.toMatchObject({ status: 409, problemas: ["pax", "contato"] });
  });
});

describe("automação: contrato registrado gera a programação sozinha", () => {
  it("comercial registra o contrato → programação em rascunho com itens, receitas e roteiro, sem ninguém digitar", async () => {
    const data = somarDias(hojeSaoPaulo(), 20);
    const e = await criar(data);
    await proposta(e.id, [coffee(data, { tier: "MASTER", horarioFim: "12:00" })]);
    const r = await registrarContrato(sql, comercial, { eventoId: e.id, revisao: (await evento(e.id)).revisao, path: `${e.id}/${randomUUID()}.pdf`, assinadoEm: new Date().toISOString() });
    expect(r.programacao).toEqual({ gerada: true });
    const [prog] = await sql<{ status: string; estrutura: Programacao | null; itens: Array<{ receita: string; setor: string }>; roteiro_campo: unknown[] }[]>`
      select status, estrutura, itens, roteiro_campo from programacoes where evento_id = ${e.id}`;
    expect(prog).toMatchObject({ status: "RASCUNHO" });
    expect(prog!.estrutura?.servicos).toHaveLength(1);
    expect(prog!.itens.length).toBeGreaterThan(5);
    expect(prog!.itens.every((i) => i.receita.length >= 5 && i.setor !== "A_CLASSIFICAR")).toBe(true);
    expect(prog!.roteiro_campo).toHaveLength(3);

  });
});

describe("Caso 7 — vigência pela camada de API", () => {
  const almoco = (data: string): ServicoVendido => ({
    data, linha: "ALMOCO", tier: "EXECUTIVE", periodo: "ALMOCO", horarioInicio: "12:00", horarioFim: "14:00", pax: 40,
    almoco: { proteinas: [{ nome: "Peito de frango grelhado", insumo: "FRANGO" }], acompanhamentos: [{ nome: "Arroz branco", insumo: "ARROZ" }],
      massa: { nome: "Penne ao sugo", insumo: "MASSA_SECA" }, vegetariano: { nome: "Legumes grelhados" }, sobremesas: [{ nome: "Mousse de maracujá", pudim: false }] }
  });
  const frango = async (programacaoId: string) => {
    const [p] = await sql<{ estrutura: Programacao }[]>`select estrutura from programacoes where id = ${programacaoId}`;
    return p!.estrutura.servicos[0]!.itens.find((i) => i.receita === "Peito de frango grelhado")?.quantidade;
  };
  const preparar = async (data: string) => {
    const e = await criar(data, { horarioInicio: "12:00", horarioFim: "14:00", pax: 40 });
    await proposta(e.id, [almoco(data)]);
    await assinar(e.id);
    return e.id;
  };

  it("proteína 150 → 160 g com vigência de hoje: o evento passado regera igual; o evento novo usa 160 g", async () => {
    const passado = somarDias(hojeSaoPaulo(), -1);
    if (passado < "2026-11-05") return; // regras iniciais começam em 05/11/2026
    const antigo = await preparar(passado);
    const v1 = await gerar(antigo);
    expect(await frango(v1.id)).toBe(6.3);
    await operar(antigo, { acao: "PROGRAMACAO_APROVAR", dados: {} });
    const comandaAntes = await documentoDoEvento(sql, programador, antigo, "comanda");

    await sql.begin((tx) => alterarRegra(tx, admin, { codigo: "almoco.proteina_g", escopoTipo: "GLOBAL", escopoChave: "", valor: { COMPLETO: 160, INTERMEDIARIO: 170, REDUZIDO: 200 }, vigenteDesde: hojeSaoPaulo(), justificativa: "Caso 7 — nova gramatura" }));

    const v2 = await gerar(antigo);
    expect(await frango(v2.id)).toBe(6.3);
    const docXml = async (b: Buffer) => (await JSZip.loadAsync(b)).file("word/document.xml")!.async("string");
    await operar(antigo, { acao: "PROGRAMACAO_APROVAR", dados: {} });
    const comandaDepois = await documentoDoEvento(sql, programador, antigo, "comanda");
    expect(await docXml(comandaDepois.buffer)).toBe(await docXml(comandaAntes.buffer));
    expect(await docXml(comandaDepois.buffer)).toContain("6,3 kg");

    const novo = await preparar(somarDias(hojeSaoPaulo(), 20));
    expect(await frango((await gerar(novo)).id)).toBe(6.72);
  });
});
