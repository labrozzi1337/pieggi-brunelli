import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import { hojeSaoPaulo } from "@/dominios/operacao/eventos";
import { carregarRegras } from "@/dominios/regras/repositorio";
import { criarUsuario, empresaPadrao, sqlTeste } from "@/testes/banco";
import { alterarRegra, listarCardapio, listarRegras, salvarItemCardapio } from "./regras";

const sql = sqlTeste();
afterAll(() => sql.end());
let empresa: string, admin: UsuarioAutenticado, comercial: UsuarioAutenticado, programador: UsuarioAutenticado;
beforeAll(async () => {
  empresa = await empresaPadrao(sql);
  [admin, comercial, programador] = await Promise.all([criarUsuario(sql, empresa, ["ADMIN"]), criarUsuario(sql, empresa, ["COMERCIAL"]), criarUsuario(sql, empresa, ["PROGRAMACAO"])]);
});

describe("regras versionadas", () => {
  it("cria nova versão com vigência futura, recusa retroativa e quem não é diretoria", async () => {
    const [anterior] = await sql<{ id: string; codigo: string; versao: number; valor: unknown }[]>`
      select id, codigo, versao, valor from regras_negocio where codigo = 'preco.EXTERNOS.COFFEE_BREAK.EXECUTIVE' order by versao desc limit 1`;
    const pedido = { codigo: anterior!.codigo, escopoTipo: "GLOBAL" as const, escopoChave: "", valor: 55, vigenteDesde: hojeSaoPaulo(), justificativa: "Reajuste anual" };
    await expect(sql.begin((tx) => alterarRegra(tx, comercial, pedido))).rejects.toMatchObject({ status: 403, message: "Somente a diretoria altera regras." });
    await expect(sql.begin((tx) => alterarRegra(tx, admin, { ...pedido, vigenteDesde: "2020-01-01" }))).rejects.toThrow("A vigência não pode ser retroativa: eventos já calculados não podem mudar.");
    await expect(sql.begin((tx) => alterarRegra(tx, admin, { ...pedido, valor: "55" }))).rejects.toThrow("O novo valor precisa ter o mesmo formato do anterior.");
    await expect(sql.begin((tx) => alterarRegra(tx, admin, { ...pedido, codigo: "regra.inedita" }))).rejects.toThrow("Informe o título da nova regra.");

    const nova = await sql.begin((tx) => alterarRegra(tx, admin, pedido));
    expect(nova.versao).toBe(anterior!.versao + 1);
    const [linha] = await sql`select substitui_regra_id, valor, financeiro, status, criado_por from regras_negocio where id = ${nova.id}`;
    expect(linha).toMatchObject({ substitui_regra_id: anterior!.id, valor: 55, financeiro: true, status: "APROVADA", criado_por: admin.id });
    const [auditoria] = await sql<{ dados: Record<string, unknown> }[]>`select dados from auditoria_eventos where entidade = 'regra_negocio' and entidade_id = ${nova.id}`;
    expect(auditoria!.dados).toMatchObject({ antes: anterior!.valor, depois: 55, justificativa: "Reajuste anual" });
  });

  it("esconde regras financeiras e clientes de perfis operacionais", async () => {
    const operacional = await carregarRegras(sql, programador);
    const comercialVe = await carregarRegras(sql, comercial);
    expect(operacional.some((r) => r.financeiro)).toBe(false);
    expect(comercialVe.some((r) => r.financeiro)).toBe(true);
    expect(operacional.length).toBeGreaterThan(0);
    expect((await listarRegras(sql, programador, empresa)).clientes).toEqual([]);
  });

  it("custo do cardápio só para perfis financeiros e só a diretoria altera", async () => {
    const [item] = await sql<{ id: string }[]>`select id from cardapio_itens order by nome limit 1`;
    await expect(sql.begin((tx) => salvarItemCardapio(tx, comercial, item!.id, { custo: 1 }))).rejects.toMatchObject({ status: 403 });
    await sql.begin((tx) => salvarItemCardapio(tx, admin, item!.id, { custo: 12.5, nomeEn: "  " }));
    const ver = async (u: UsuarioAutenticado) => (await listarCardapio(sql, u)).find((i) => i.id === item!.id);
    expect(await ver(comercial)).toMatchObject({ custo: 12.5, nomeEn: null });
    expect((await ver(programador))?.custo).toBeNull();
  });
});
