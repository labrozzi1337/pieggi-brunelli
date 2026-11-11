import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import { transacao } from "@/integrations/banco";
import { criarUsuario, empresaPadrao, sqlTeste } from "@/testes/banco";
import { CABECALHO_FISCAL, planilhaTeste } from "@/testes/xlsx";
import { importarCatalogoFiscal, situacaoCatalogo } from "./catalogo-planilha";

const sql = sqlTeste();
afterAll(() => sql.end());
let empresa: string; let financeiro: UsuarioAutenticado;
beforeAll(async () => { empresa = await empresaPadrao(sql); financeiro = await criarUsuario(sql, empresa, ["FINANCEIRO"]); });

const linha = (n: number, nome: string, preco: number) => [n, nome, "TESTE", "1905.90.90", "Padaria", "Alimentação", "5102", "90", "4%", null, null, "01", "0,65%", "01", "3%", null, "0", 1, preco];

describe("importação do catálogo fiscal", () => {
  it("cria aprovado, atualiza pelo código e inativa o que saiu da planilha", async () => {
    const v1 = await planilhaTeste("Teste Planilha", [CABECALHO_FISCAL, linha(1, "Item A", 10), linha(2, "Item B", 20)]);
    const r1 = await transacao((tx) => importarCatalogoFiscal(tx, financeiro, empresa, "v1.xlsx", v1));
    expect(r1).toMatchObject({ produtos: 2, novos: 2, atualizados: 0 });

    const v2 = await planilhaTeste("Teste Planilha", [CABECALHO_FISCAL, linha(1, "Item A revisado", 12)]);
    const r2 = await transacao((tx) => importarCatalogoFiscal(tx, financeiro, empresa, "v2.xlsx", v2));
    expect(r2).toMatchObject({ novos: 0, atualizados: 1 });
    expect(r2.inativados).toContain("TES-002");

    const itens = await sql<{ codigo: string; descricao: string; preco_venda: number; ativo: boolean; revisao_fiscal_pendente: boolean }[]>`
      select codigo, descricao, preco_venda, ativo, revisao_fiscal_pendente from fiscal_produtos where empresa_id = ${empresa} and codigo like 'TES-%' order by codigo`;
    expect(itens).toEqual([
      { codigo: "TES-001", descricao: "Item A revisado", preco_venda: 12, ativo: true, revisao_fiscal_pendente: false },
      { codigo: "TES-002", descricao: "Item B", preco_venda: 20, ativo: false, revisao_fiscal_pendente: false }
    ]);
    expect(await situacaoCatalogo(sql, empresa)).toMatchObject({ arquivo: "v2.xlsx", pendentes: 0 });
  });
});
