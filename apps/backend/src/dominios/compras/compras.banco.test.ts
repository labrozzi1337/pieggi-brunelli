import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import type { ProgramacaoLinha } from "@/dominios/operacao/ganchos-tipos";
import { criarUsuario, empresaPadrao, sqlTeste } from "@/testes/banco";
import { aoExpedirEvento, aoMudarStatusProgramacao } from "./ganchos";
import { gerarPedidosSemana, lancarNotas, registrarInventario, salvarCotacao, salvarFicha, salvarInsumo, sugerir, visaoSemanal } from "./servico";

const sql = sqlTeste();
afterAll(() => sql.end());

let empresa: string;
let usuario: UsuarioAutenticado;
const sufixo = () => randomUUID().slice(0, 8);
const fornecedor = async (codigo: string) => (await sql<{ id: string }[]>`select id from fornecedores where empresa_id = ${empresa} and codigo = ${codigo}`)[0]!.id;

beforeAll(async () => {
  empresa = await empresaPadrao(sql);
  usuario = await criarUsuario(sql, empresa, ["ADMIN"], "Compras");
});

async function insumo(nome: string, extra: Partial<Parameters<typeof salvarInsumo>[3]> = {}) {
  return (await sql.begin((tx) => salvarInsumo(tx, usuario, empresa, {
    nome: `${nome} ${sufixo()}`, marca: "", setor: "PROTEINAS", unidade: "KG", unidadeCompra: "kg", fatorCompra: 1, estoqueMinimo: 0, perecivel: true, rendimentoChave: null, ativo: true, ...extra
  }))).id;
}

async function itemCardapio(nome = `Item teste ${sufixo()}`, fornecedorTexto: string | null = null) {
  const [c] = await sql<{ id: string }[]>`insert into cardapio_itens (familia, grupo, categoria, tier, nome, unidade, fornecedor)
    values ('TESTE', 'TESTE COMPRAS', 'TESTE', 'BASE', ${nome}, 'kg', ${fornecedorTexto}) returning id`;
  return { id: c!.id, nome };
}

async function aprovar(saida: string, itens: unknown[], titulo = `Evento ${sufixo()}`) {
  const cliente = randomUUID(), evento = randomUUID();
  await sql`insert into clientes (id, empresa_id, nome) values (${cliente}, ${empresa}, 'Cliente compras')`;
  await sql`insert into eventos (id, empresa_id, cliente_id, titulo, data_evento) values (${evento}, ${empresa}, ${cliente}, ${titulo}, ${saida.slice(0, 10)})`;
  const [p] = await sql<ProgramacaoLinha[]>`insert into programacoes (evento_id, empresa_id, versao, status, saida_em, itens, alteracoes, criado_por)
    values (${evento}, ${empresa}, 1, 'APROVADA', ${saida}, ${sql.json(itens)}, 'Teste de compras', ${usuario.id})
    returning id, evento_id, empresa_id, versao, status, itens, rotulos, roteiro_campo, saida_em`;
  await sql.begin((tx) => aoMudarStatusProgramacao(tx, usuario, p!, "RASCUNHO"));
  return { evento, programacao: p! };
}

const demandas = (programacao: string) => sql<{ item_nome: string; insumo_id: string | null; quantidade: number | null; pronto: boolean; fornecedor_codigo: string | null; pendencia: string | null; cancelada_em: Date | null }[]>`
  select item_nome, insumo_id, quantidade, pronto, fornecedor_codigo, pendencia, cancelada_em from compra_demandas where programacao_id = ${programacao} order by item_indice, insumo`;
const saldo = async (insumoId: string) => (await sql<{ s: number }[]>`select coalesce(sum(quantidade), 0) s from estoque_movimentos where insumo_id = ${insumoId}`)[0]!.s;

describe("compras e estoque com banco real", () => {
  it("aprovação gera demanda corrigida pelo rendimento; invalidação cancela", async () => {
    const frango = await insumo("Peito de frango", { rendimentoChave: "FRANGO" });
    const arroz = await insumo("Arroz agulhinha", { rendimentoChave: "ARROZ", setor: "MERCEARIA" });
    const proteina = await itemCardapio();
    const acompanhamento = await itemCardapio();
    const pronto = await itemCardapio(`Mini croissant ${sufixo()}`, "Pad. Letícia");
    await sql.begin((tx) => salvarFicha(tx, usuario, empresa, proteina.id, [{ insumoId: frango, unidadeItem: "KG", quantidade: 1, rendimento: null }]));
    await sql.begin((tx) => salvarFicha(tx, usuario, empresa, acompanhamento.id, [{ insumoId: arroz, unidadeItem: "KG", quantidade: 1, rendimento: null }]));
    const { programacao } = await aprovar("2030-01-08T10:00:00-03:00", [
      { item: "Proteína", receita: "Frango grelhado", quantidade: 6.3, unidade: "KG", cardapioItemId: proteina.id },
      { nome: acompanhamento.nome, receita: "Arroz branco soltinho", quantidade: 5.46, unidade: "KG", setor: "COZINHA_QUENTE", servico: "Almoço" },
      { nome: pronto.nome, receita: "Comprado pronto", quantidade: 50, unidade: "UN", setor: "COZINHA_FRIA", servico: "Coffee" },
      { nome: "Item sem cadastro", receita: "Receita qualquer", quantidade: 1, unidade: "UN", setor: "COZINHA_FRIA", servico: "Coffee" }
    ]);
    const d = await demandas(programacao.id);
    expect(d.find((x) => x.insumo_id === frango)?.quantidade).toBeCloseTo(7.875, 6);
    expect(d.find((x) => x.insumo_id === arroz)?.quantidade).toBeCloseTo(1.82, 6);
    expect(d.find((x) => x.pronto)).toMatchObject({ fornecedor_codigo: "PAD_LETICIA", quantidade: 50, pendencia: null });
    expect(d.find((x) => x.item_nome === "Item sem cadastro")?.pendencia).toMatch(/cardápio/);

    // Aprovar de novo não duplica.
    await sql.begin((tx) => aoMudarStatusProgramacao(tx, usuario, programacao, "RASCUNHO"));
    expect(await demandas(programacao.id)).toHaveLength(4);

    await sql`update programacoes set status = 'INVALIDADA' where id = ${programacao.id}`;
    await sql.begin((tx) => aoMudarStatusProgramacao(tx, usuario, { ...programacao, status: "INVALIDADA" }, "APROVADA"));
    expect((await demandas(programacao.id)).every((x) => x.cancelada_em)).toBe(true);
  });

  it("consolida 2 eventos da mesma semana num pedido por fornecedor", async () => {
    const queijo = await insumo("Queijo muçarela", { setor: "FRIOS_QUEIJOS" });
    const pao = await insumo("Farinha de trigo", { setor: "MERCEARIA" });
    const item = await itemCardapio();
    await sql.begin((tx) => salvarFicha(tx, usuario, empresa, item.id, [
      { insumoId: queijo, unidadeItem: "KG", quantidade: 0.5, rendimento: 1 }, { insumoId: pao, unidadeItem: "KG", quantidade: 0.25, rendimento: 1 }
    ]));
    const central = await fornecedor("CENTRAL_FRIOS"), valeria = await fornecedor("VALERIA_BUFFET");
    await sql.begin((tx) => salvarCotacao(tx, usuario, empresa, { insumoId: queijo, fornecedorId: central, embalagem: "peça 2 kg", quantidadeEmbalagem: 2, unidadeEmbalagem: "KG", preco: 80, preferido: false }));
    await sql.begin((tx) => salvarCotacao(tx, usuario, empresa, { insumoId: pao, fornecedorId: valeria, embalagem: "saco 1 kg", quantidadeEmbalagem: 1000, unidadeEmbalagem: "G", preco: 6, preferido: false }));
    const linha = { nome: item.nome, receita: "Receita de teste", quantidade: 3, unidade: "KG", setor: "COZINHA_FRIA", servico: "Coffee", cardapioItemId: item.id };
    await aprovar("2030-02-05T09:00:00-03:00", [linha], "Evento A");
    await aprovar("2030-02-07T09:00:00-03:00", [linha], "Evento B");

    const visao = await visaoSemanal(sql, empresa, "2030-02-04", "2030-02-10");
    const central2 = visao.fornecedores.find((f) => f.fornecedorId === central)!;
    expect(central2.linhas).toHaveLength(1);
    expect(central2.linhas[0]).toMatchObject({ insumoId: queijo, quantidade: 3, embalagens: 2, precoEstimado: 160, eventos: ["Evento A", "Evento B"] });

    const r = await sql.begin((tx) => gerarPedidosSemana(tx, usuario, empresa, "2030-02-04", "2030-02-10"));
    expect(r.pedidos).toHaveLength(2);
    const pedidos = await sql<{ fornecedor_id: string; semana: string; n: number }[]>`
      select pc.fornecedor_id, pc.semana::text semana, count(*)::int n from pedidos_compra pc join pedido_compra_itens pi on pi.pedido_id = pc.id where pc.id in ${sql(r.pedidos)} group by 1, 2`;
    expect(pedidos.map((p) => p.fornecedor_id).sort()).toEqual([central, valeria].sort());
    expect(pedidos.every((p) => p.semana === "2030-02-04" && p.n === 1)).toBe(true);

    // O que está em pedido aberto sai da necessidade: gerar de novo não duplica.
    const de_novo = await sql.begin((tx) => gerarPedidosSemana(tx, usuario, empresa, "2030-02-04", "2030-02-10"));
    expect(de_novo.pedidos).toHaveLength(0);
  });

  it("entrada por nota atualiza custo médio ponderado, cardapio_custos e aprende o apelido; expedição baixa o estoque", async () => {
    const frango = await insumo("Peito de frango", { rendimentoChave: "FRANGO" });
    const item = await itemCardapio();
    await sql.begin((tx) => salvarFicha(tx, usuario, empresa, item.id, [{ insumoId: frango, unidadeItem: "KG", quantidade: 1, rendimento: null }]));
    const rev2 = await fornecedor("REV2");
    const nota = (valor: number, validade: string, lote: string) => ({
      fornecedorId: rev2, numero: lote, emitidaEm: "2030-03-01", itens: [{ insumoId: frango, descricao: "PEITO FGO CONG CX 10KG", quantidade: 1, fator: 10, valorTotal: valor, lote, validade }]
    });
    await sql.begin((tx) => lancarNotas(tx, usuario, empresa, [nota(200, "2030-03-20", "L1"), nota(300, "2030-03-10", "L2")]));
    const [i] = await sql<{ custo_medio: number }[]>`select custo_medio from insumos where id = ${frango}`;
    expect(i!.custo_medio).toBe(25);
    expect(await saldo(frango)).toBe(20);
    const [c] = await sql<{ custo: number }[]>`select custo from cardapio_custos where item_id = ${item.id}`;
    expect(c!.custo).toBeCloseTo(25 / 0.8, 4);
    const sugestoes = await sugerir(sql, empresa, rev2, "peito fgo cong cx 10kg");
    expect(sugestoes[0]).toMatchObject({ id: frango, apelido: true });

    const { evento } = await aprovar("2030-03-05T10:00:00-03:00", [{ nome: item.nome, receita: "Frango grelhado", quantidade: 6.3, unidade: "KG", setor: "COZINHA_QUENTE", servico: "Almoço", cardapioItemId: item.id }]);
    await sql.begin((tx) => aoExpedirEvento(tx, usuario, evento));
    expect(await saldo(frango)).toBeCloseTo(20 - 7.875, 6);
    // FEFO: o lote L2 (vence antes) sai primeiro.
    const lotes = await sql<{ lote: string; saldo: number }[]>`select lote, saldo from estoque_lotes where insumo_id = ${frango} order by lote`;
    expect(lotes).toEqual([{ lote: "L1", saldo: 10 }, { lote: "L2", saldo: 2.125 }]);
    await sql.begin((tx) => aoExpedirEvento(tx, usuario, evento));
    expect(await saldo(frango)).toBeCloseTo(12.125, 6);
  });

  it("inventário registra ajuste com justificativa e auditoria", async () => {
    const agua = await insumo("Água mineral", { setor: "BEBIDAS", unidade: "UN", perecivel: false });
    const mercado = await fornecedor("MERCADO");
    await sql.begin((tx) => lancarNotas(tx, usuario, empresa, [{ fornecedorId: mercado, numero: "1", emitidaEm: "2030-03-01", itens: [{ insumoId: agua, descricao: "AGUA 500ML", quantidade: 2, fator: 12, valorTotal: 24 }] }]));
    await expect(sql.begin((tx) => registrarInventario(tx, usuario, empresa, "BEBIDAS", [{ insumoId: agua, contado: 20 }]))).rejects.toThrow(/Justifique/);
    const r = await sql.begin((tx) => registrarInventario(tx, usuario, empresa, "BEBIDAS", [{ insumoId: agua, contado: 20, justificativa: "Quebra no transporte" }]));
    expect(r.ajustes[0]).toMatchObject({ diferenca: -4, valor: -4 });
    expect(await saldo(agua)).toBe(20);
    const [a] = await sql<{ usuario_id: string; dados: { justificativa: string } }[]>`select usuario_id, dados from auditoria_eventos where acao = 'ESTOQUE_AJUSTE_INVENTARIO' and entidade_id = ${agua}`;
    expect(a).toMatchObject({ usuario_id: usuario.id, dados: { justificativa: "Quebra no transporte" } });
  });
});
