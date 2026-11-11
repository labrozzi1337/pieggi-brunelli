import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarUsuario, empresaPadrao, sqlTeste } from "@/testes/banco";
import type { UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import type { ProgramacaoLinha } from "@/dominios/operacao/ganchos-tipos";
import { concluirEtapaCampo, concluirTarefaEvidencia, consultarCampo, gerenciarAcessoCampo, hashToken, ORDEM_FOTOS, registrarFotoCampo } from "./campo";
import { aoMudarStatusProgramacao, validarEdicaoEvento } from "./ganchos";
import { registrarTermoRemanescentes, salvarBalanco } from "./balanco";
import { operarFinanceiro, registrarContrato } from "./registros";

const sql = sqlTeste();
afterAll(() => sql.end());
let empresa: string; let expedicao: UsuarioAutenticado; let comercial: UsuarioAutenticado; let financeiro: UsuarioAutenticado; let hoje: string;

beforeAll(async () => {
  empresa = await empresaPadrao(sql);
  expedicao = await criarUsuario(sql, empresa, ["EXPEDICAO_COMPRAS"]);
  comercial = await criarUsuario(sql, empresa, ["COMERCIAL"]);
  financeiro = await criarUsuario(sql, empresa, ["FINANCEIRO"]);
  hoje = (await sql<{ d: string }[]>`select ((now() at time zone 'America/Sao_Paulo')::date)::text as d`)[0]!.d;
});

async function novoEvento(extra: Record<string, unknown> = {}) {
  const cliente = randomUUID(); const id = randomUUID();
  await sql`insert into clientes (id, empresa_id, nome) values (${cliente}, ${empresa}, 'Cliente')`;
  await sql`insert into eventos ${sql({ id, empresa_id: empresa, cliente_id: cliente, titulo: "Evento", etapa_operacao: "EM_CAMPO", contrato_assinado_em: new Date(), tabela_preco: "A",
    pax: 100, data_evento: hoje, horario_inicio: "10:00", horario_fim: "14:00", logradouro: "Rua", numero_endereco: "1", bairro: "Centro", cidade: "SP", uf: "SP", cep: "01000-000",
    contato_local_nome: "Ana", contato_local_telefone: "11999999999", ...extra })}`;
  return id;
}
const revisao = async (id: string) => (await sql<{ revisao: number }[]>`select revisao from eventos where id = ${id}`)[0]!.revisao;
const roteiro = [
  { tipo: "MONTAGEM", titulo: "Montar", orientacao: "Montar mesas", previstoEm: "2026-11-08T10:00:00-03:00" },
  { tipo: "REPOSICAO", titulo: "Repor", orientacao: "Repor itens", previstoEm: "2026-11-08T11:00:00-03:00" },
  { tipo: "DESMONTAGEM", titulo: "Desmontar", orientacao: "Desmontar tudo", previstoEm: "2026-11-08T14:00:00-03:00" }
];
const itens = [{ nome: "Arroz", quantidade: 10, unidade: "KG", setor: "COZINHA_QUENTE" }, { nome: "Mesa", quantidade: 2, unidade: "UN", setor: "ESTRUTURA" }, { nome: "Salgado", quantidade: 100, unidade: "UN", setor: "CONFEITARIA" }];

/** Evento em campo com programação aprovada pelo gancho, roteiro gerado e tarefas de foto. */
async function eventoEmCampo() {
  const eventoId = await novoEvento();
  const [p] = await sql<ProgramacaoLinha[]>`insert into programacoes (id, evento_id, empresa_id, versao, status, saida_em, itens, alteracoes, criado_por, roteiro_campo)
    values (${randomUUID()}, ${eventoId}, ${empresa}, 1, 'RASCUNHO', now(), ${sql.json(itens)}, 'Versão inicial', ${expedicao.id}, ${sql.json(roteiro)}) returning *`;
  await sql.begin(async tx => {
    await tx`update programacoes set status = 'APROVADA' where id = ${p!.id}`;
    await aoMudarStatusProgramacao(tx, expedicao, { ...p!, status: "APROVADA" }, "RASCUNHO");
  });
  const tarefas: Record<string, string> = {};
  for (const titulo of ORDEM_FOTOS) {
    const [t] = await sql<{ id: string }[]>`insert into operacao_tarefas (id, evento_id, programacao_id, empresa_id, tipo, setor, titulo, evidencia_obrigatoria)
      values (${randomUUID()}, ${eventoId}, ${p!.id}, ${empresa}, 'CAMPO', 'CAMPO', ${titulo}, true) returning id`;
    tarefas[titulo] = t!.id;
  }
  return { eventoId, programacaoId: p!.id, tarefas };
}

describe("link de campo", () => {
  it("cria, consulta, revoga ao recriar e recusa revogado/expirado/sem perfil", async () => {
    const eventoId = await novoEvento();
    await expect(gerenciarAcessoCampo(sql, comercial, { eventoId, responsavel: "Equipe" })).rejects.toMatchObject({ status: 403 });
    const a = await gerenciarAcessoCampo(sql, expedicao, { eventoId, responsavel: "Equipe A" });
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const [salvo] = await sql`select token_hash from campo_acessos where id = ${a.id}`;
    expect(salvo!.token_hash).toBe(hashToken(a.token!));
    const dados = await consultarCampo(sql, hashToken(a.token!));
    expect(dados).toMatchObject({ acessoId: a.id, responsavel: "Equipe A", evento: { id: eventoId, data: hoje, inicio: "10:00:00" }, tarefas: [], etapas: [] });

    const b = await gerenciarAcessoCampo(sql, expedicao, { eventoId, responsavel: "Equipe B" });
    await expect(consultarCampo(sql, hashToken(a.token!))).rejects.toMatchObject({ status: 403 });
    await sql`update campo_acessos set expira_em = now() - interval '1 minute' where id = ${b.id}`;
    await expect(consultarCampo(sql, hashToken(b.token!))).rejects.toMatchObject({ status: 403 });
    const c = await gerenciarAcessoCampo(sql, expedicao, { eventoId, responsavel: "Equipe C" });
    const revogado = await gerenciarAcessoCampo(sql, expedicao, { eventoId, revogarId: c.id });
    expect(revogado).toEqual({ id: c.id, expiraEm: null, token: null });
    await expect(consultarCampo(sql, hashToken(c.token!))).rejects.toMatchObject({ status: 403 });
    await expect(gerenciarAcessoCampo(sql, expedicao, { eventoId, revogarId: c.id })).rejects.toThrow("Link já revogado ou indisponível.");

    const semContrato = await novoEvento({ contrato_assinado_em: null, etapa_operacao: "BLOQUEADO" });
    await expect(gerenciarAcessoCampo(sql, expedicao, { eventoId: semContrato, responsavel: "Equipe" })).rejects.toThrow("Formalize o contrato");
  });

  it("recusa o link fora do dia do evento", async () => {
    const eventoId = await novoEvento({ data_evento: "2099-01-01" });
    const a = await gerenciarAcessoCampo(sql, expedicao, { eventoId, responsavel: "Equipe" });
    await expect(consultarCampo(sql, hashToken(a.token!))).rejects.toThrow("fora do dia do evento");
  });
});

describe("roteiro e fotos de campo", () => {
  it("gera o roteiro ao aprovar e recusa aprovação sem roteiro completo", async () => {
    const { programacaoId } = await eventoEmCampo();
    const etapas = await sql<{ ordem: number; tipo: string }[]>`select ordem, tipo from campo_etapas where programacao_id = ${programacaoId} order by ordem`;
    expect(etapas.map(e => e.tipo)).toEqual(["MONTAGEM", "REPOSICAO", "DESMONTAGEM"]);
    const base = { id: randomUUID(), evento_id: randomUUID(), empresa_id: empresa, versao: 1, status: "APROVADA" as const, itens: [], rotulos: [], saida_em: "" };
    await expect(sql.begin(tx => aoMudarStatusProgramacao(tx, expedicao, { ...base, roteiro_campo: [] }, "RASCUNHO"))).rejects.toThrow("Defina o roteiro");
    await expect(sql.begin(tx => aoMudarStatusProgramacao(tx, expedicao, { ...base, roteiro_campo: roteiro.slice(0, 2) }, "RASCUNHO"))).rejects.toThrow("montagem, reposição e desmontagem");
  });

  it("foto exige ordem, caminho do link e etapas do roteiro concluídas", async () => {
    const { eventoId, tarefas } = await eventoEmCampo();
    const link = await gerenciarAcessoCampo(sql, expedicao, { eventoId, responsavel: "Equipe" });
    const hash = hashToken(link.token!);
    const caminho = (ext = "jpg") => `${eventoId}/${link.id}/${randomUUID()}.${ext}`;
    await expect(registrarFotoCampo(sql, hash, { tarefaId: tarefas["Reposição"]!, revisao: await revisao(eventoId), path: caminho() })).rejects.toThrow("Conclua a etapa anterior");
    await expect(registrarFotoCampo(sql, hash, { tarefaId: tarefas["Chegada ao local"]!, revisao: await revisao(eventoId), path: `${eventoId}/${randomUUID()}.jpg` })).rejects.toThrow("Foto inválida");
    await expect(registrarFotoCampo(sql, hash, { tarefaId: tarefas["Chegada ao local"]!, revisao: 999, path: caminho() })).rejects.toMatchObject({ status: 409 });
    const r0 = await revisao(eventoId);
    await registrarFotoCampo(sql, hash, { tarefaId: tarefas["Chegada ao local"]!, revisao: r0, path: caminho() });
    expect(await revisao(eventoId)).toBe(r0 + 1);
    await expect(registrarFotoCampo(sql, hash, { tarefaId: tarefas["Higienização e mesa montada"]!, revisao: await revisao(eventoId), path: caminho("png") })).rejects.toThrow("Conclua as etapas correspondentes do roteiro");

    const dados = await consultarCampo(sql, hash) as { etapas: { id: string; tipo: string }[] };
    const montagem = dados.etapas.find(e => e.tipo === "MONTAGEM")!;
    const reposicao = dados.etapas.find(e => e.tipo === "REPOSICAO")!;
    await expect(concluirEtapaCampo(sql, hash, { etapaId: reposicao.id, revisao: await revisao(eventoId), observacao: "" })).rejects.toThrow("Registre a foto da fase anterior");
    await concluirEtapaCampo(sql, hash, { etapaId: montagem.id, revisao: await revisao(eventoId), observacao: " ok " });
    await registrarFotoCampo(sql, hash, { tarefaId: tarefas["Higienização e mesa montada"]!, revisao: await revisao(eventoId), path: caminho("png") });
    const [t] = await sql`select estado from operacao_tarefas where id = ${tarefas["Higienização e mesa montada"]!}`;
    expect(t!.estado).toBe("PRONTO");

    // Evidência interna também respeita o roteiro (reposição ainda aberta).
    await expect(concluirTarefaEvidencia(sql, expedicao, { tarefaId: tarefas["Reposição"]!, revisao: await revisao(eventoId), path: `${eventoId}/${randomUUID()}.jpg` })).rejects.toThrow("Conclua as etapas correspondentes do roteiro");
    await expect(concluirTarefaEvidencia(sql, comercial, { tarefaId: tarefas["Reposição"]!, revisao: await revisao(eventoId), path: `${eventoId}/${randomUUID()}.jpg` })).rejects.toMatchObject({ status: 403 });

    await sql`update campo_acessos set revogado_em = now() where id = ${link.id}`;
    await expect(registrarFotoCampo(sql, hash, { tarefaId: tarefas["Reposição"]!, revisao: await revisao(eventoId), path: caminho() })).rejects.toMatchObject({ status: 403 });
  });
});

describe("balanço, termo e encerramento", () => {
  it("salva com controle de revisão, exige termo dos remanescentes e bloqueia edição tardia", async () => {
    const { eventoId, programacaoId } = await eventoEmCampo();
    const linhas = [{ indice: 0, remanescentes: 1.5, retorno: 0.1, descarte: 0.2 }, { indice: 2, remanescentes: 0, retorno: 10, descarte: 0 }];
    const entrada = { eventoId, balancoRevisao: 0, linhas, recebedor: "Cliente", observacoes: "" };
    await expect(salvarBalanco(sql, comercial, { ...entrada, revisao: await revisao(eventoId) })).rejects.toMatchObject({ status: 403 });
    await expect(salvarBalanco(sql, expedicao, { ...entrada, revisao: 999 })).rejects.toMatchObject({ status: 409 });
    await expect(salvarBalanco(sql, expedicao, { ...entrada, balancoRevisao: 3, revisao: await revisao(eventoId) })).rejects.toThrow("Balanço alterado");
    await expect(salvarBalanco(sql, expedicao, { ...entrada, linhas: [linhas[0]!], revisao: await revisao(eventoId) })).rejects.toThrow("sem duplicações");
    await expect(salvarBalanco(sql, expedicao, { ...entrada, linhas: [linhas[0]!, { ...linhas[1]!, retorno: 0.5 }], revisao: await revisao(eventoId) })).rejects.toThrow("respeitando a unidade");
    await expect(salvarBalanco(sql, expedicao, { ...entrada, recebedor: "", revisao: await revisao(eventoId) })).rejects.toThrow("quem recebeu");
    await salvarBalanco(sql, expedicao, { ...entrada, revisao: await revisao(eventoId) });
    const [b] = await sql<{ revisao: number; linhas: { consumido: number }[] }[]>`select revisao, linhas from evento_balancos where programacao_id = ${programacaoId}`;
    expect(b!.revisao).toBe(1);
    expect(b!.linhas[0]!.consumido).toBe(8.2);
    await expect(salvarBalanco(sql, expedicao, { ...entrada, revisao: await revisao(eventoId) })).rejects.toThrow("Balanço alterado");

    // Portão de encerramento e edição tardia (antigo trigger evento_portao_balanco).
    await sql.begin(async tx => {
      await expect(validarEdicaoEvento(tx, eventoId, { pax: 120 })).rejects.toThrow("Evento já saiu");
      await validarEdicaoEvento(tx, eventoId, { pax: 100, horario_inicio: "10:00", observacoes: "livre" });
      await expect(validarEdicaoEvento(tx, eventoId, { etapa_operacao: "ENTREGUE" })).rejects.toThrow("Anexe o termo assinado");
    });

    const termo = { eventoId, balancoRevisao: 1, path: `${eventoId}/${randomUUID()}.pdf`, assinadoEm: new Date().toISOString() };
    await expect(registrarTermoRemanescentes(sql, expedicao, { ...termo, balancoRevisao: 0, revisao: await revisao(eventoId) })).rejects.toThrow("Gere o termo atualizado");
    await expect(registrarTermoRemanescentes(sql, expedicao, { ...termo, path: `outro/${randomUUID()}.pdf`, revisao: await revisao(eventoId) })).rejects.toThrow("Envie o termo assinado em PDF");
    await expect(registrarTermoRemanescentes(sql, expedicao, { ...termo, assinadoEm: "2099-01-01T00:00:00Z", revisao: await revisao(eventoId) })).rejects.toThrow("data de assinatura");
    const t = await registrarTermoRemanescentes(sql, expedicao, { ...termo, revisao: await revisao(eventoId) });
    const [salvo] = await sql<{ revisao_balanco: number; snapshot: { revisao: number } }[]>`select revisao_balanco, snapshot from remanescentes_termos where id = ${t.id}`;
    expect(salvo).toMatchObject({ revisao_balanco: 1, snapshot: { revisao: 1 } });
    await sql.begin(tx => validarEdicaoEvento(tx, eventoId, { etapa_operacao: "ENTREGUE" }));

    const semBalanco = await novoEvento();
    await expect(sql.begin(tx => validarEdicaoEvento(tx, semBalanco, { etapa_operacao: "ENTREGUE" }))).rejects.toThrow("Registre o balanço");
  });
});

describe("financeiro do evento", () => {
  it("custo idempotente, chave reutilizada recusada e cancelamento único", async () => {
    const eventoId = await novoEvento();
    const dados = { categoria: "LOGISTICA" as const, descricao: "Frete", valor: 150.5, competencia: hoje, referencia: "NF 123", idempotencia: randomUUID() };
    await expect(operarFinanceiro(sql, comercial, { eventoId, revisao: await revisao(eventoId), comando: { acao: "CUSTO_CRIAR", dados } })).rejects.toThrow("Perfil sem acesso ao financeiro.");
    const r0 = await revisao(eventoId);
    const c = await operarFinanceiro(sql, financeiro, { eventoId, revisao: r0, comando: { acao: "CUSTO_CRIAR", dados } });
    expect(await revisao(eventoId)).toBe(r0 + 1);
    // Repetição com revisão antiga devolve o mesmo lançamento.
    expect(await operarFinanceiro(sql, financeiro, { eventoId, revisao: r0, comando: { acao: "CUSTO_CRIAR", dados } })).toEqual(c);
    await expect(operarFinanceiro(sql, financeiro, { eventoId, revisao: r0, comando: { acao: "CUSTO_CRIAR", dados: { ...dados, valor: 151 } } })).rejects.toThrow("Chave já utilizada");
    await expect(operarFinanceiro(sql, financeiro, { eventoId, revisao: r0, comando: { acao: "CUSTO_CANCELAR", dados: { id: c.id, motivo: "Lançado errado" } } })).rejects.toMatchObject({ status: 409 });
    await operarFinanceiro(sql, financeiro, { eventoId, revisao: await revisao(eventoId), comando: { acao: "CUSTO_CANCELAR", dados: { id: c.id, motivo: "Lançado errado" } } });
    const [custo] = await sql`select cancelado_em, cancelado_por from evento_custos where id = ${c.id}`;
    expect(custo!.cancelado_por).toBe(financeiro.id);
    await expect(operarFinanceiro(sql, financeiro, { eventoId, revisao: await revisao(eventoId), comando: { acao: "CUSTO_CANCELAR", dados: { id: c.id, motivo: "De novo aqui" } } })).rejects.toThrow("já cancelado");
    await operarFinanceiro(sql, financeiro, { eventoId, revisao: await revisao(eventoId), comando: { acao: "VALORES_SALVAR", dados: { venda: 1000, custoEstimado: 400 } } });
    const [v] = await sql`select valor_venda, custo_estimado from evento_valores where evento_id = ${eventoId}`;
    expect(v).toMatchObject({ valor_venda: 1000, custo_estimado: 400 });
  });
});

describe("contrato", () => {
  it("valida dados, caminho e proposta; ao registrar avança etapas e enfileira integrações", async () => {
    const eventoId = await novoEvento({ contrato_assinado_em: null, etapa_operacao: "BLOQUEADO", contato_local_nome: null });
    const entrada = { eventoId, path: `${eventoId}/${randomUUID()}.pdf`, assinadoEm: new Date().toISOString() };
    await expect(registrarContrato(sql, expedicao, { ...entrada, revisao: await revisao(eventoId) })).rejects.toMatchObject({ status: 403 });
    await expect(registrarContrato(sql, comercial, { ...entrada, revisao: await revisao(eventoId) })).rejects.toThrow("Complete tabela");
    await sql`update eventos set contato_local_nome = 'Ana' where id = ${eventoId}`;
    await expect(registrarContrato(sql, comercial, { ...entrada, assinadoEm: "2099-01-01T00:00:00Z", revisao: await revisao(eventoId) })).rejects.toThrow("Data de assinatura inválida.");
    await expect(registrarContrato(sql, comercial, { ...entrada, path: `${randomUUID()}/${randomUUID()}.pdf`, revisao: await revisao(eventoId) })).rejects.toThrow("Envie o PDF assinado");
    await expect(registrarContrato(sql, comercial, { ...entrada, revisao: 999 })).rejects.toMatchObject({ status: 409 });

    // Proposta em rascunho bloqueia a formalização.
    const [ev] = await sql<{ cliente_id: string }[]>`select cliente_id from eventos where id = ${eventoId}`;
    const propostaId = randomUUID();
    await sql`insert into propostas (id, empresa_id, evento_id, versao, status, briefing, itens, snapshot, desconto, taxas, total, fonte_preco, alteracoes, validade, idempotencia, criado_por)
      values (${propostaId}, ${empresa}, ${eventoId}, 1, 'RASCUNHO', '{}', '[]', '{}', 0, 0, 100, 'TABELA', 'Inicial', '2099-01-01', ${randomUUID()}, ${comercial.id})`;
    await expect(registrarContrato(sql, comercial, { ...entrada, revisao: await revisao(eventoId) })).rejects.toThrow("Aprove a proposta vigente");
    expect(ev).toBeTruthy();
    await sql`delete from propostas where id = ${propostaId}`;

    const r0 = await revisao(eventoId);
    await registrarContrato(sql, comercial, { ...entrada, revisao: r0 });
    const [e] = await sql`select etapa_comercial, etapa_operacao, contrato_assinado_em, revisao from eventos where id = ${eventoId}`;
    expect(e).toMatchObject({ etapa_comercial: "CONTRATO_ASSINADO", etapa_operacao: "PROGRAMACAO", revisao: r0 + 1 });
    const filas = await sql<{ tipo: string }[]>`select tipo from integracao_fila where evento_id = ${eventoId} order by tipo`;
    expect(filas.map(f => f.tipo)).toEqual(["AGENDA", "FATURAMENTO"]);
    await expect(registrarContrato(sql, comercial, { ...entrada, revisao: r0 + 1 })).rejects.toThrow("Contrato já registrado.");
  });
});
