import { randomBytes, randomUUID } from "node:crypto";
import { invalidarRegras } from "@/dominios/regras/repositorio";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import { transacao } from "@/integrations/banco";
import { criarUsuario, empresaPadrao, sqlTeste } from "@/testes/banco";
import {
  cancelarDiaria, criarFreelancer, editarDiaria, escalaDoEvento, fecharPeriodo, freelancersDoEvento, custoEquipeDoEvento,
  lancarDiaria, listarFreelancers, relatorioPagamento, verbaDoEvento, alterarSituacaoFreelancer
} from "./freelancers";
import { cnpjValido } from "./regras-freelancer";
import { consultarEquipe, operarEquipe } from "./contratacoes";
import { aoMudarStatusProgramacao } from "./ganchos";
import type { ProgramacaoLinha } from "@/dominios/operacao/ganchos-tipos";

const sql = sqlTeste();
afterAll(() => sql.end());
process.env.PIEGGI_CHAVE_CIFRAGEM_DADOS = randomBytes(32).toString("base64");

const DIA = "2027-03-10";
let empresa: string; let admin: UsuarioAutenticado; let adriana: UsuarioAutenticado; let financeiro: UsuarioAutenticado;

/** CNPJ válido a partir de um número (acha os dígitos verificadores). */
function cnpj(n: number) {
  const base = String(n).padStart(8, "0") + "0001";
  for (let i = 0; i < 100; i++) { const c = base + String(i).padStart(2, "0"); if (cnpjValido(c)) return c; }
  throw new Error("sem CNPJ");
}
const semente = Math.floor(Math.random() * 1e7);

async function evento(titulo: string, valorVenda: number | null) {
  const id = randomUUID(); const cliente = randomUUID();
  await sql`insert into clientes (id, empresa_id, nome) values (${cliente}, ${empresa}, 'Cliente')`;
  await sql`insert into eventos ${sql({ id, empresa_id: empresa, cliente_id: cliente, titulo, data_evento: DIA, logradouro: "Av. das Nações Unidas", numero_endereco: "12551", cidade: "São Paulo" })}`;
  if (valorVenda !== null) await sql`insert into evento_valores (evento_id, valor_venda) values (${id}, ${valorVenda})`;
  return id;
}

async function novaVersaoCopeira(valor: number, vigente: string) {
  await sql`insert into regras_negocio (id, codigo, versao, titulo, descricao, origem, status, escopo, vigente_desde, valor, escopo_tipo, escopo_chave, financeiro)
    select ${randomUUID()}, 'freelancer.diaria', max(versao) + 1, 'Copeira (teste)', 'teste', 'teste', 'APROVADA', '{}'::jsonb, ${vigente}::timestamptz, ${sql.json(valor)}, 'ITEM', 'COPEIRA', true
    from regras_negocio where codigo = 'freelancer.diaria'`;
  invalidarRegras();
}

const copeira = (i: number) => ({ nome: `Copeira ${i}`, cnpj: cnpj(semente + i), celular: "(11) 98888-000" + i, pix: `copeira${i}@exemplo.com`, funcoes: ["COPEIRA"], valorDiaria: null, documentosPath: null });

beforeAll(async () => {
  empresa = await empresaPadrao(sql);
  admin = await criarUsuario(sql, empresa, ["ADMIN"]);
  adriana = await criarUsuario(sql, empresa, ["EXPEDICAO_COMPRAS"]);
  financeiro = await criarUsuario(sql, empresa, ["FINANCEIRO"]);
  await novaVersaoCopeira(250, "2027-01-01T00:00:00-03:00");
});

describe("freelancers com banco real", () => {
  it("Caso 8: R$ 20.000 → verba R$ 1.600; 4 copeiras × 1 diária → 4 linhas; alerta quando a escala estoura", async () => {
    const ev = await evento("Evento R$ 20 mil", 20000);
    expect(await verbaDoEvento(sql, ev)).toBe(160_000);

    const ids = await transacao(async (tx) => Promise.all([1, 2, 3, 4].map(async (i) => (await criarFreelancer(tx, adriana, empresa, copeira(i))).id)));
    for (const id of ids) {
      const r = await transacao((tx) => lancarDiaria(tx, adriana, { freelancerId: id, eventoId: ev, data: DIA, funcao: "COPEIRA", inicio: "07:00", fim: "17:00", local: "WTC" }));
      expect(r).toMatchObject({ valorCentavos: 25_000, origem: "FUNCAO", alertas: [] });
    }
    expect(await freelancersDoEvento(sql, ev)).toBe(4);
    let escala = await escalaDoEvento(sql, adriana, ev);
    expect(escala.verba).toMatchObject({ verbaCentavos: 160_000, custoCentavos: 100_000, estourou: false });

    const rel = await relatorioPagamento(sql, financeiro, empresa, { inicio: DIA, fim: DIA, eventoId: ev, situacao: "TODAS" });
    expect(rel.linhas).toHaveLength(4);
    expect(rel.linhas.map((l) => [l.nome, l.funcao, l.diarias, l.valorDiariaCentavos, l.totalCentavos, l.status])).toEqual(
      [1, 2, 3, 4].map((i) => [`Copeira ${i}`, "COPEIRA", 1, 25_000, 25_000, "PENDENTE"]));
    expect(rel.linhas[0]?.pix).toBe("copeira1@exemplo.com");
    expect(cnpjValido(rel.linhas[0]!.cnpj)).toBe(true);
    expect(rel.totais.geralCentavos).toBe(100_000);

    // Rateio: cada diária entra no custo real do evento.
    const [custos] = await sql<{ total: number }[]>`select coalesce(sum(valor),0) total from evento_custos where evento_id = ${ev} and categoria = 'EQUIPE' and cancelado_em is null`;
    expect(custos!.total).toBe(1000);

    // Segundo dia para todas: R$ 2.000 > R$ 1.600 → alerta.
    for (const id of ids) await transacao((tx) => lancarDiaria(tx, adriana, { freelancerId: id, eventoId: ev, data: "2027-03-11", funcao: "COPEIRA", inicio: "07:00", fim: "17:00", local: "WTC" }));
    escala = await escalaDoEvento(sql, adriana, ev);
    expect(escala.verba).toMatchObject({ custoCentavos: 200_000, saldoCentavos: -40_000, estourou: true });
    expect(await custoEquipeDoEvento(sql, ev)).toBe(200_000);
    expect(await freelancersDoEvento(sql, ev)).toBe(4);
  });

  it("verba zero quando o evento não tem orçamento", async () => {
    const ev = await evento("Evento sem orçamento", null);
    expect(await verbaDoEvento(sql, ev)).toBe(0);
    expect((await escalaDoEvento(sql, admin, ev)).verba).toMatchObject({ verbaCentavos: 0, exibirVerba: false });
  });

  it("CNPJ, celular e PIX nunca ficam em texto puro no banco; a leitura decifra", async () => {
    const dados = copeira(50);
    const { id } = await transacao((tx) => criarFreelancer(tx, adriana, empresa, dados));
    const [linha] = await sql`select * from freelancers where id = ${id}`;
    const bruto = JSON.stringify(linha);
    expect(bruto).not.toContain(dados.cnpj);
    expect(bruto).not.toContain(dados.pix);
    expect(bruto).not.toContain(dados.celular.replace(/\D/g, ""));
    const lido = (await listarFreelancers(sql, financeiro, empresa)).find((f) => f.id === id)!;
    expect(lido.cnpj.replace(/\D/g, "")).toBe(dados.cnpj);
    expect(lido.pix).toBe(dados.pix);
    expect(lido.celular).toBe(dados.celular.replace(/\D/g, ""));
    // CNPJ duplicado é barrado mesmo cifrado (HMAC).
    await expect(transacao((tx) => criarFreelancer(tx, adriana, empresa, { ...dados, nome: "Outra" }))).rejects.toMatchObject({ code: "23505" });
    // Anonimização: remove dados pessoais, preserva o registro.
    await transacao((tx) => alterarSituacaoFreelancer(tx, admin, id, "ANONIMIZAR", "Pedido do titular (LGPD)"));
    const [anon] = await sql`select nome, cnpj_cifrado, pix_cifrado, celular_cifrado, ativo from freelancers where id = ${id}`;
    expect(anon).toMatchObject({ nome: "Freelancer anonimizado", cnpj_cifrado: null, pix_cifrado: null, celular_cifrado: null, ativo: false });
  });

  it("valor congelado: mudar a tabela não altera diária já lançada; mesma pessoa em dois eventos no dia é sinalizada", async () => {
    const ev1 = await evento("Congelado 1", 5000); const ev2 = await evento("Congelado 2", 5000);
    const { id: f } = await transacao((tx) => criarFreelancer(tx, adriana, empresa, copeira(60)));
    const d1 = await transacao((tx) => lancarDiaria(tx, adriana, { freelancerId: f, eventoId: ev1, data: DIA, funcao: "COPEIRA", inicio: "08:00", fim: "12:00", local: "" }));
    await novaVersaoCopeira(300, "2027-02-01T00:00:00-03:00");
    const d2 = await transacao((tx) => lancarDiaria(tx, adriana, { freelancerId: f, eventoId: ev2, data: DIA, funcao: "COPEIRA", inicio: "14:00", fim: "18:00", local: "" }));
    expect(d1.valorCentavos).toBe(25_000);
    expect(d2.valorCentavos).toBe(30_000);
    expect(d2.alertas[0]).toContain("Congelado 1");
    const [salvo] = await sql<{ valor: number }[]>`select valor from freelancer_diarias where id = ${d1.id}`;
    expect(salvo!.valor).toBe(250);
    expect((await escalaDoEvento(sql, adriana, ev1)).diarias[0]?.outroEventoNoDia).toBe(true);
    // Mesma pessoa, mesmo evento, mesmo dia: uma diária só.
    await expect(transacao((tx) => lancarDiaria(tx, adriana, { freelancerId: f, eventoId: ev1, data: DIA, funcao: "COPEIRA", inicio: "13:00", fim: "15:00", local: "" }))).rejects.toMatchObject({ status: 409 });
  });

  it("fechamento trava: diária paga só muda com ADMIN + justificativa, auditado com antes/depois", async () => {
    const dia = "2027-04-02";
    const ev = await evento("Fechamento", 10000);
    const { id: f } = await transacao((tx) => criarFreelancer(tx, adriana, empresa, copeira(70)));
    const d = await transacao((tx) => lancarDiaria(tx, adriana, { freelancerId: f, eventoId: ev, data: dia, funcao: "COPEIRA", inicio: "08:00", fim: "16:00", local: "" }));
    await expect(transacao((tx) => fecharPeriodo(tx, adriana, empresa, { inicio: dia, fim: dia, pagoEm: dia, observacao: "" }))).rejects.toMatchObject({ status: 403 });
    const fech = await transacao((tx) => fecharPeriodo(tx, financeiro, empresa, { inicio: dia, fim: dia, eventoId: ev, pagoEm: dia, observacao: "" }));
    expect(fech).toMatchObject({ diarias: 1, pagamentos: 1, totalCentavos: 30_000 });
    const rel = await relatorioPagamento(sql, financeiro, empresa, { inicio: dia, fim: dia, eventoId: ev, situacao: "TODAS" });
    expect(rel.linhas[0]).toMatchObject({ status: "PAGO", pagoEm: dia });
    await expect(transacao((tx) => fecharPeriodo(tx, financeiro, empresa, { inicio: dia, fim: dia, eventoId: ev, pagoEm: dia, observacao: "" }))).rejects.toMatchObject({ status: 409 });

    await expect(transacao((tx) => editarDiaria(tx, adriana, { id: d.id, local: "Outro" }))).rejects.toMatchObject({ status: 403 });
    await expect(transacao((tx) => editarDiaria(tx, admin, { id: d.id, valor: 200 }))).rejects.toMatchObject({ status: 422 });
    await expect(transacao((tx) => cancelarDiaria(tx, adriana, d.id, "Não veio trabalhar"))).rejects.toMatchObject({ status: 403 });
    await transacao((tx) => editarDiaria(tx, admin, { id: d.id, valor: 200, justificativa: "Valor combinado foi R$ 200" }));
    const [log] = await sql<{ usuario_id: string; dados: { antes: { valorCentavos: number }; depois: { valorCentavos: number }; justificativa: string } }[]>`
      select usuario_id, dados from auditoria_eventos where entidade = 'freelancer_diaria' and entidade_id = ${d.id} and acao = 'DIARIA_EDITAR_APOS_FECHAMENTO'`;
    expect(log).toMatchObject({ usuario_id: admin.id, dados: { antes: { valorCentavos: 30_000 }, depois: { valorCentavos: 20_000 }, justificativa: "Valor combinado foi R$ 200" } });
    const [custo] = await sql<{ valor: number }[]>`select valor from evento_custos where idempotencia = ${d.id}`;
    expect(custo!.valor).toBe(200);
  });
});

describe("contratações de equipe (porte de operar_equipe) e gancho da programação", () => {
  it("solicita, aprova dentro da verba e volta para A_REVISAR quando a programação é invalidada", async () => {
    const ev = await evento("Contratações", 8000);
    await sql`update eventos set contrato_assinado_em = now() where id = ${ev}`;
    const [p] = await sql<ProgramacaoLinha[]>`insert into programacoes (id, evento_id, empresa_id, versao, status, saida_em, itens, alteracoes, criado_por)
      values (${randomUUID()}, ${ev}, ${empresa}, 1, 'APROVADA', now(), ${sql.json([{ nome: "x" }])}, 'versão inicial', ${admin.id}) returning *`;
    const [forn] = await sql<{ id: string }[]>`insert into fornecedores (id, empresa_id, nome) values (${randomUUID()}, ${empresa}, 'Locadora') returning id`;
    const revisao = async () => (await sql<{ revisao: number }[]>`select revisao from eventos where id = ${ev}`)[0]!.revisao;
    const id = randomUUID();
    const dados = { id, fornecedorId: forn!.id, categoria: "EQUIPE" as const, funcao: "Líder de montagem", inicio: "2027-03-10T10:00:00.000Z", fim: "2027-03-10T18:00:00.000Z", orientacoes: "" };
    await transacao(async (tx) => operarEquipe(tx, adriana, { eventoId: ev, revisao: await revisao(), comando: { acao: "SOLICITAR", dados } }));
    // Reenvio da mesma chave não duplica nem exige revisão nova.
    await transacao((tx) => operarEquipe(tx, adriana, { eventoId: ev, revisao: 1, comando: { acao: "SOLICITAR", dados } }));
    await expect(transacao(async (tx) => operarEquipe(tx, adriana, { eventoId: ev, revisao: await revisao(), comando: { acao: "VERBA", dados: { limite: 500 } } }))).rejects.toMatchObject({ status: 403 });
    await transacao(async (tx) => operarEquipe(tx, financeiro, { eventoId: ev, revisao: await revisao(), comando: { acao: "VERBA", dados: { limite: 500 } } }));
    await expect(transacao(async (tx) => operarEquipe(tx, financeiro, { eventoId: ev, revisao: await revisao(), comando: { acao: "APROVAR", dados: { id, valor: 600, referencia: "cotação" } } }))).rejects.toMatchObject({ status: 409 });
    await transacao(async (tx) => operarEquipe(tx, financeiro, { eventoId: ev, revisao: await revisao(), comando: { acao: "APROVAR", dados: { id, valor: 400, referencia: "cotação" } } }));
    const consulta = await consultarEquipe(sql, financeiro, ev);
    expect(consulta).toMatchObject({ verba: 500, podeValores: true, valores: [{ equipe_id: id, valor: 400 }] });

    await transacao(async (tx) => { await tx`update programacoes set status = 'INVALIDADA' where id = ${p!.id}`; await aoMudarStatusProgramacao(tx, admin, { ...p!, status: "INVALIDADA" }, "APROVADA"); });
    const [linha] = await sql<{ estado: string }[]>`select estado from evento_equipe where id = ${id}`;
    expect(linha!.estado).toBe("A_REVISAR");
  });
});
