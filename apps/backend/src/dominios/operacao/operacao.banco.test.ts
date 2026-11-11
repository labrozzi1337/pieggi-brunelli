import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import * as campo from "@/dominios/campo/ganchos";
import * as compras from "@/dominios/compras/ganchos";
import * as equipe from "@/dominios/equipe/ganchos";
import { criarUsuario, empresaPadrao, sqlTeste } from "@/testes/banco";
import { atualizarEvento, eventoEntrada, hojeSaoPaulo, salvarEvento, type Evento } from "./eventos";
import { comandoSchema } from "./http";
import { painelOperacao } from "./consultas";
import { operarEvento, type Comando } from "./programacao";
import { aprovarProposta, propostaOperacional, propostaSchema, salvarProposta } from "./propostas";

// Ganchos dos outros módulos: espiões que delegam à implementação real.
vi.mock("@/dominios/campo/ganchos", async (original) => {
  const m = await original<typeof import("@/dominios/campo/ganchos")>();
  return { ...m, aoMudarStatusProgramacao: vi.fn(m.aoMudarStatusProgramacao), validarEdicaoEvento: vi.fn(m.validarEdicaoEvento) };
});
vi.mock("@/dominios/compras/ganchos", async (original) => {
  const m = await original<typeof import("@/dominios/compras/ganchos")>();
  return { ...m, aoMudarStatusProgramacao: vi.fn(m.aoMudarStatusProgramacao), aoExpedirEvento: vi.fn(m.aoExpedirEvento) };
});
vi.mock("@/dominios/equipe/ganchos", async (original) => {
  const m = await original<typeof import("@/dominios/equipe/ganchos")>();
  return { ...m, aoMudarStatusProgramacao: vi.fn(m.aoMudarStatusProgramacao) };
});

const sql = sqlTeste();
afterAll(() => sql.end());
let empresa: string;
let admin: UsuarioAutenticado, comercial: UsuarioAutenticado, programador: UsuarioAutenticado, producao: UsuarioAutenticado;
beforeAll(async () => {
  empresa = await empresaPadrao(sql);
  [admin, comercial, programador, producao] = await Promise.all([
    criarUsuario(sql, empresa, ["ADMIN"]), criarUsuario(sql, empresa, ["COMERCIAL"]),
    criarUsuario(sql, empresa, ["PROGRAMACAO"]), criarUsuario(sql, empresa, ["PRODUCAO"])
  ]);
});
beforeEach(() => vi.clearAllMocks());

const documento = () => String(Date.now()).slice(-8) + String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
const dadosEvento = () => ({
  empresaId: empresa, titulo: "Coffee de teste", pax: 50, dataEvento: "2099-12-01", horarioInicio: "08:00", horarioFim: "12:00",
  tabelaPreco: "EXTERNOS", logradouro: "Rua A", numeroEndereco: "10", bairro: "Centro", cidade: "São Paulo", uf: "sp", cep: "01000-000",
  contatoLocalNome: "Ana", contatoLocalTelefone: "11999999999", cliente: { tipo: "PJ", nome: "Cliente Teste", documento: documento(), email: "", telefone: null }
});
const criarEvento = async (u = comercial, extra: Record<string, unknown> = {}) =>
  (await sql.begin((tx) => salvarEvento(tx, u, null, eventoEntrada.parse({ ...dadosEvento(), ...extra })))).evento as Evento;
const evento = async (id: string) => (await sql<{ j: Evento }[]>`select to_jsonb(e) j from eventos e where id = ${id}`)[0]!.j;
const editar = async (u: UsuarioAutenticado, e: Evento, campos: Record<string, unknown>) =>
  (await sql.begin((tx) => salvarEvento(tx, u, e.id, eventoEntrada.parse({ empresaId: empresa, atualizadoEm: e.atualizado_em, ...campos })))).evento as Evento;
const operar = async (u: UsuarioAutenticado, id: string, comando: Comando) =>
  sql.begin(async (tx) => operarEvento(tx, u, id, (await evento(id)).revisao, comandoSchema.parse({ revisao: 1, comando }).comando));
const assinar = (id: string) => sql.begin((tx) => atualizarEvento(tx, admin, id, { contrato_assinado_em: new Date().toISOString() }));

describe("evento", () => {
  it("cria em Frio, atualiza com controle otimista e recusa a edição concorrente", async () => {
    const e = await criarEvento();
    expect(e).toMatchObject({ etapa_comercial: "FRIO", etapa_operacao: "BLOQUEADO", revisao: 1, uf: "SP", horario_inicio: "08:00:00", data_evento: "2099-12-01" });
    const editado = await editar(comercial, e, { titulo: "Coffee revisado" });
    expect(editado).toMatchObject({ titulo: "Coffee revisado", revisao: 2 });
    await expect(editar(comercial, e, { titulo: "Versão velha" })).rejects.toMatchObject({ status: 409, message: "Evento alterado por outra pessoa. Atualize a tela." });
    await expect(editar(comercial, editado, { etapaComercial: "CONTRATO_ASSINADO" })).rejects.toThrow("Registre o PDF assinado na operação.");
    await expect(editar(comercial, editado, { horarioFim: "07:00" })).rejects.toThrow("Término deve ser posterior ao início.");
    const [{ n }] = await sql<[{ n: number }]>`select count(*)::int n from auditoria_eventos where entidade_id = ${e.id} and acao in ('EVENTO_CRIADO','EVENTO_ATUALIZADO')`;
    expect(n).toBe(2);
  });

  it("barra perfis sem papel comercial e eventos que já começam fora de Frio", async () => {
    await expect(criarEvento(producao)).rejects.toMatchObject({ status: 403 });
    await expect(criarEvento(comercial, { etapaComercial: "QUENTE" })).rejects.toThrow("Novo evento inicia em Frio.");
  });

  it("assinatura move o funil, libera a programação e enfileira integrações", async () => {
    const e = await criarEvento();
    const assinado = await assinar(e.id);
    expect(assinado).toMatchObject({ etapa_comercial: "CONTRATO_ASSINADO", etapa_operacao: "PROGRAMACAO", revisao: 2 });
    const filas = await sql<{ tipo: string }[]>`select tipo from integracao_fila where evento_id = ${e.id} order by tipo`;
    expect(filas.map((f) => f.tipo)).toEqual(["AGENDA", "FATURAMENTO"]);
    await expect(sql.begin((tx) => atualizarEvento(tx, admin, e.id, { contrato_assinado_em: null }))).rejects.toThrow("Contrato assinado exige procedimento de cancelamento.");
  });
});

const proposta = (extra: Record<string, unknown> = {}) => propostaSchema.parse({
  briefing: { startse: false, categoria: "EXTERNOS", restricoesConfirmadas: true, restricoes: "", restritos: 0, cobrancaRestritos: "SEM_RESTRICOES", escopo: "Coffee confirmado" },
  itens: [{ nome: "Coffee Executive", servico: "Manhã", quantidade: 50, unidade: "PAX", preco: 50 }],
  desconto: 0, taxas: 10.5, custoEstimado: null, fontePreco: "Tabela Externos", alteracoes: "Primeira revisão", validade: "2099-12-31", ...extra
});

describe("propostas", () => {
  it("versiona com idempotência, aprova a última e grava o valor do evento", async () => {
    const e = await criarEvento();
    const chave = randomUUID();
    const salvar = (dados = proposta(), k = chave) => sql.begin(async (tx) => salvarProposta(tx, comercial, { eventoId: e.id, revisao: (await evento(e.id)).revisao, chave: k, dados }));
    const v1 = await salvar();
    expect(await salvar()).toEqual(v1);
    await expect(salvar(proposta({ desconto: 1 }))).rejects.toThrow("Chave utilizada por outra proposta.");
    await expect(sql.begin((tx) => salvarProposta(tx, comercial, { eventoId: e.id, revisao: 1, chave: randomUUID(), dados: proposta() }))).rejects.toMatchObject({ status: 409 });
    await expect(salvar(proposta({ taxas: 5, briefing: { ...proposta().briefing, categoria: "WTC" } }), randomUUID())).rejects.toThrow("Esta tabela é isenta de taxas e logística.");
    await expect(salvar(proposta({ briefing: { ...proposta().briefing, restritos: 2 } }), randomUUID())).rejects.toThrow("Confira quantidade, tipo e cobrança dos participantes com restrições.");
    const v2 = await salvar(proposta({ alteracoes: "Segunda revisão" }), randomUUID());
    const [linha] = await sql<{ versao: number; total: number; snapshot: { cliente: { nome: string } } }[]>`select versao, total, snapshot from propostas where id = ${v2.id}`;
    expect(linha).toMatchObject({ versao: 2, total: 2510.5, snapshot: { cliente: { nome: "Cliente Teste" } } });

    const aprovar = (id: string) => sql.begin(async (tx) => aprovarProposta(tx, comercial, { eventoId: e.id, revisao: (await evento(e.id)).revisao, propostaId: id, confirmado: true }));
    await expect(aprovar(v1.id)).rejects.toThrow("Aprove somente a última versão em rascunho, antes do contrato.");
    expect(await aprovar(v2.id)).toEqual(v2);
    expect(await aprovar(v2.id)).toEqual(v2);
    const [valores] = await sql`select valor_venda, proposta_id from evento_valores where evento_id = ${e.id}`;
    expect(valores).toMatchObject({ valor_venda: 2510.5, proposta_id: v2.id });
    expect((await evento(e.id)).etapa_comercial).toBe("QUENTE");
    expect(await sql.begin((tx) => propostaOperacional(tx, programador, e.id))).toMatchObject({ versao: 2, itens: [{ nome: "Coffee Executive", quantidade: 50 }] });
    expect(JSON.stringify(await sql.begin((tx) => propostaOperacional(tx, programador, e.id)))).not.toContain("preco");

    // Briefing mudou: aprovação e valor caem; o contrato fica barrado até nova aprovação.
    const atual = await editar(comercial, await evento(e.id), { pax: 60 });
    const [{ status }] = await sql<[{ status: string }]>`select status from propostas where id = ${v2.id}`;
    expect(status).toBe("INVALIDADA");
    const [semValor] = await sql`select valor_venda, proposta_id from evento_valores where evento_id = ${e.id}`;
    expect(semValor).toMatchObject({ valor_venda: null, proposta_id: null });
    await expect(editar(comercial, atual, { etapaComercial: "CONTRATO_ENVIADO" })).rejects.toThrow("Aprove a proposta vigente antes de formalizar o contrato.");
    await expect(assinar(e.id)).rejects.toThrow("Aprove a proposta vigente antes de formalizar o contrato.");
  });

  it("mudar o cliente derruba a proposta aprovada e, após o contrato, exige aditivo", async () => {
    const e = await criarEvento();
    const { id } = await sql.begin((tx) => salvarProposta(tx, comercial, { eventoId: e.id, revisao: 1, chave: randomUUID(), dados: proposta() }));
    await sql.begin(async (tx) => aprovarProposta(tx, comercial, { eventoId: e.id, revisao: (await evento(e.id)).revisao, propostaId: id, confirmado: true }));
    await assinar(e.id);
    const cliente = { ...dadosEvento().cliente, nome: "Cliente Renomeado" };
    await expect(editar(comercial, await evento(e.id), { cliente })).rejects.toThrow("Cliente vinculado a proposta contratada. Trate o aditivo antes de alterar os dados.");
    await expect(editar(comercial, await evento(e.id), { pax: 70 })).rejects.toThrow("Contrato já assinado. Trate o aditivo antes de mudar o briefing aprovado.");
  });
});

const item = { nome: "Pão de queijo", receita: "Assar por 20 minutos", quantidade: 100, unidade: "UN", setor: "COZINHA_QUENTE", servico: "Coffee" };
const roteiro = [
  { tipo: "MONTAGEM", titulo: "Montar", orientacao: "Montar o buffet", previstoEm: "2099-12-01T07:00:00-03:00" },
  { tipo: "REPOSICAO", titulo: "Repor", orientacao: "Repor bebidas", previstoEm: "2099-12-01T09:00:00-03:00" },
  { tipo: "DESMONTAGEM", titulo: "Desmontar", orientacao: "Recolher tudo", previstoEm: "2099-12-01T12:30:00-03:00" }
];
const salvarProgramacao = (id: string, extra: Record<string, unknown> = {}) => operar(programador, id, { acao: "PROGRAMACAO_SALVAR", dados: {
  saidaEm: "2099-12-01T06:00:00-03:00", alteracoes: "Versão inicial", itens: [item], roteiroCampo: roteiro, ...extra } } as Comando);

describe("programação", () => {
  it("salva versões, aprova com ganchos, gera tarefas e é invalidada quando o evento muda", async () => {
    const e = await criarEvento();
    await expect(salvarProgramacao(e.id)).rejects.toThrow("Contrato ainda não formalizado.");
    await assinar(e.id);
    await expect(operar(comercial, e.id, { acao: "PROGRAMACAO_APROVAR", dados: {} })).rejects.toMatchObject({ status: 403 });
    await expect(salvarProgramacao(e.id, { roteiroCampo: [roteiro[1], roteiro[0]] })).rejects.toThrow("Ordene montagem, reposição e desmontagem nesta sequência.");
    await expect(sql.begin((tx) => operarEvento(tx, programador, e.id, 1, { acao: "PROGRAMACAO_APROVAR", dados: {} }))).rejects.toMatchObject({ status: 409 });

    const v1 = await salvarProgramacao(e.id);
    const v2 = await salvarProgramacao(e.id, { alteracoes: "Segunda versão" });
    const versoes = await sql<{ id: string; versao: number; status: string }[]>`select id, versao, status from programacoes where evento_id = ${e.id} order by versao`;
    expect(versoes).toEqual([{ id: v1.id, versao: 1, status: "INVALIDADA" }, { id: v2.id, versao: 2, status: "RASCUNHO" }]);
    for (const gancho of [equipe, compras, campo]) expect(gancho.aoMudarStatusProgramacao).toHaveBeenCalledWith(expect.anything(), programador, expect.objectContaining({ id: v1.id, status: "INVALIDADA" }), "RASCUNHO");

    vi.clearAllMocks();
    expect(await operar(programador, e.id, { acao: "PROGRAMACAO_APROVAR", dados: {} })).toEqual(v2);
    for (const gancho of [equipe, compras, campo]) expect(gancho.aoMudarStatusProgramacao).toHaveBeenCalledWith(expect.anything(), programador, expect.objectContaining({ id: v2.id, status: "APROVADA", roteiro_campo: roteiro }), "RASCUNHO");
    const tarefas = await sql<{ tipo: string; n: number }[]>`select tipo, count(*)::int n from operacao_tarefas where programacao_id = ${v2.id} group by tipo order by tipo`;
    expect(tarefas).toEqual([{ tipo: "CAMPO", n: 4 }, { tipo: "CONFERENCIA", n: 3 }, { tipo: "EXPEDICAO", n: 1 }, { tipo: "PRODUCAO", n: 1 }, { tipo: "RETORNO", n: 1 }]);
    expect((await evento(e.id)).etapa_operacao).toBe("PRODUCAO");

    // Sequência de produção: conferência da programação antes; produção concluída leva o evento à expedição.
    const [producaoId, conferenciaId] = await Promise.all([["PRODUCAO", item.nome], ["CONFERENCIA", "Conferência da programação"]].map(async ([tipo, titulo]) =>
      (await sql<{ id: string }[]>`select id from operacao_tarefas where programacao_id = ${v2.id} and tipo = ${tipo!} and titulo = ${titulo!}`)[0]!.id));
    await expect(operar(producao, e.id, { acao: "TAREFA_ATUALIZAR", dados: { id: producaoId!, estado: "EM_ANDAMENTO" } })).rejects.toThrow("Confira a programação antes de iniciar a produção.");
    await operar(producao, e.id, { acao: "TAREFA_ATUALIZAR", dados: { id: conferenciaId!, estado: "PRONTO" } });
    await operar(producao, e.id, { acao: "TAREFA_ATUALIZAR", dados: { id: producaoId!, estado: "EM_ANDAMENTO" } });
    await operar(producao, e.id, { acao: "TAREFA_ATUALIZAR", dados: { id: producaoId!, estado: "PRONTO" } });
    expect((await evento(e.id)).etapa_operacao).toBe("EXPEDICAO");

    // Dado operacional alterado: programação aprovada invalidada, operação volta para programação.
    vi.clearAllMocks();
    await editar(comercial, await evento(e.id), { pax: 80 });
    const [{ status }] = await sql<[{ status: string }]>`select status from programacoes where id = ${v2.id}`;
    expect(status).toBe("INVALIDADA");
    expect((await evento(e.id)).etapa_operacao).toBe("PROGRAMACAO");
    expect(campo.validarEdicaoEvento).toHaveBeenCalledWith(expect.anything(), e.id, expect.objectContaining({ pax: 80 }));
    expect(equipe.aoMudarStatusProgramacao).toHaveBeenCalledWith(expect.anything(), comercial, expect.objectContaining({ id: v2.id, status: "INVALIDADA" }), "APROVADA");
    const [{ mensagem }] = await sql<[{ mensagem: string }]>`select mensagem from operacao_notificacoes where evento_id = ${e.id} order by criado_em desc limit 1`;
    expect(mensagem).toBe("Dados do evento alterados. Programação e derivados bloqueados até nova aprovação.");
  });

  it("títulos só com contrato, idempotentes e sem recebimento futuro", async () => {
    const e = await criarEvento();
    const financeiro = await criarUsuario(sql, empresa, ["FINANCEIRO"]);
    const dados = { descricao: "Sinal", valor: 100, vencimento: "2099-12-01", forma: "PIX" as const, idempotencia: randomUUID() };
    await expect(operar(financeiro, e.id, { acao: "TITULO_CRIAR", dados })).rejects.toThrow("Contrato assinado obrigatório para contas a receber.");
    await assinar(e.id);
    const { id } = await operar(financeiro, e.id, { acao: "TITULO_CRIAR", dados });
    await expect(operar(financeiro, e.id, { acao: "TITULO_CRIAR", dados })).rejects.toThrow("Esta solicitação já foi registrada. Atualize a tela.");
    await expect(operar(financeiro, e.id, { acao: "TITULO_RECEBER", dados: { id, recebidoEm: "2099-01-01", referencia: "PIX 1" } })).rejects.toThrow("Recebimento não pode estar no futuro.");
    await operar(financeiro, e.id, { acao: "TITULO_RECEBER", dados: { id, recebidoEm: hojeSaoPaulo(), referencia: "PIX 1" } });
    await expect(operar(financeiro, e.id, { acao: "TITULO_RECEBER", dados: { id, recebidoEm: hojeSaoPaulo(), referencia: "PIX 1" } })).rejects.toThrow("Título indisponível ou já recebido.");
  });
});

describe("visibilidade financeira na central de operação", () => {
  it("valores, títulos e custos só para perfis financeiros", async () => {
    const operacional = await painelOperacao(sql, producao, empresa);
    expect(operacional).toMatchObject({ podeValores: false, valores: [], titulos: [], custos: [], integracoes: [] });
    expect(operacional.eventos.length).toBeGreaterThan(0);
    const comercialVe = await painelOperacao(sql, comercial, empresa);
    expect(comercialVe.podeValores).toBe(true);
    expect(comercialVe.valores.length).toBeGreaterThan(0);
  });
});
