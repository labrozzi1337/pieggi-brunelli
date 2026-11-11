// Estrutura da programação (Programacao do motor) ↔ formato legado `itens` das telas e ganchos, e sobrescrita manual auditada.
import type { z } from "zod";
import type { UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import type { Estacao, ItemProgramacao, Programacao } from "@/dominios/documentos/tipos";
import type { Tx } from "@/integrations/banco";
import { linhas } from "./eventos";
import { auditar, type itemProgramacaoSchema } from "./http";

export type ItemLegado = z.infer<typeof itemProgramacaoSchema>;
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

const UNIDADES_LEGADAS = new Set(["UN", "KG", "G", "L", "ML"]);
const SETORES_PRODUCAO = new Set(["COZINHA_QUENTE", "COZINHA_FRIA", "CONFEITARIA"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function setorDe(i: ItemProgramacao): ItemLegado["setor"] {
  if (i.estacao === "EXPEDICAO_BEBIDAS" || (i.bebida && !SETORES_PRODUCAO.has(i.estacao ?? ""))) return "BEBIDAS";
  if (i.estacao && SETORES_PRODUCAO.has(i.estacao)) return i.estacao as ItemLegado["setor"];
  return i.compradoPronto || i.fornecedor ? "FORNECEDOR" : "ESTRUTURA";
}
const estacaoDoSetor = (setor: string): Estacao | null =>
  SETORES_PRODUCAO.has(setor) ? setor as Estacao : setor === "BEBIDAS" ? "EXPEDICAO_BEBIDAS" : "EXPEDICAO_ALIMENTACAO";

/** Formato legado (telas de operação, ganchos de compras/campo) da estrutura do motor; `ref` = serviço:item. */
export function itensLegados(p: Programacao): ItemLegado[] {
  return p.servicos.flatMap((s, si) => s.itens.flatMap((i, ii): ItemLegado[] => {
    if (!(i.quantidade > 0)) return [];
    const receita = [i.receita, i.quantidadeTexto, i.observacao].filter(Boolean).join(" — ");
    return [{
      nome: i.receita.slice(0, 200), receita: (receita.length >= 5 ? receita : `${i.item}: ${receita}`).slice(0, 5000), quantidade: i.quantidade,
      unidade: (UNIDADES_LEGADAS.has(i.unidade) ? i.unidade : "UN") as ItemLegado["unidade"], setor: setorDe(i),
      servico: `${s.nome} ${dataBr(s.data).slice(0, 5)}`.slice(0, 100), ref: `${si}:${ii}`,
      cardapioItemId: i.cardapioItemId && uuid.test(i.cardapioItemId) ? i.cardapioItemId : null, compradoPronto: !!i.compradoPronto, fornecedor: i.fornecedor ?? null
    }];
  }));
}

/**
 * Sobrescrita manual (§2, regra de dependência): a nova lista legada manda. Item com `ref` mantém a origem e recebe nome,
 * quantidade e unidade digitados; item sem `ref` entra no serviço de mesmo nome. Devolve a estrutura nova e o antes/depois.
 */
export function aplicarSobrescritas(anterior: Programacao, itens: readonly ItemLegado[]) {
  const servicos = anterior.servicos.map((s) => ({ ...s, itens: [] as ItemProgramacao[] }));
  const mudancas: Array<{ item: string; antes: string | null; depois: string | null }> = [];
  const usados = new Set<string>();
  for (const l of itens) {
    const [si = -1, ii = -1] = l.ref?.split(":").map(Number) ?? [];
    const original = anterior.servicos[si]?.itens[ii];
    const depois = `${l.quantidade} ${l.unidade}`;
    if (original && servicos[si]) {
      usados.add(l.ref!);
      const antes = `${original.quantidade} ${original.unidade}`;
      const igual = original.quantidade === l.quantidade && (UNIDADES_LEGADAS.has(original.unidade) ? original.unidade : "UN") === l.unidade && original.receita.slice(0, 200) === l.nome;
      if (!igual) mudancas.push({ item: l.nome, antes: `${antes} · ${original.receita}`, depois: `${depois} · ${l.nome}` });
      servicos[si].itens.push(igual ? original : { ...original, receita: l.nome, quantidade: l.quantidade, unidade: l.unidade, quantidadeTexto: undefined });
      continue;
    }
    const alvo = servicos.find((s) => l.servico.startsWith(s.nome)) ?? servicos[0];
    if (!alvo) continue;
    alvo.itens.push({ quantidade: l.quantidade, unidade: l.unidade, receita: l.nome, item: l.nome, cardapioItemId: l.cardapioItemId ?? null,
      estacao: estacaoDoSetor(l.setor), fornecedor: null, compradoPronto: !!l.compradoPronto, bebida: l.setor === "BEBIDAS", quente: l.setor === "COZINHA_QUENTE" });
    mudancas.push({ item: l.nome, antes: null, depois });
  }
  anterior.servicos.forEach((s, si) => s.itens.forEach((i, ii) => {
    if (i.quantidade > 0 && !usados.has(`${si}:${ii}`)) mudancas.push({ item: i.receita, antes: `${i.quantidade} ${i.unidade}`, depois: null });
  }));
  return { estrutura: { ...anterior, servicos }, mudancas };
}

/** Grava a estrutura de uma versão recém-salva: a do motor, ou a anterior com as sobrescritas manuais (auditadas). */
export async function gravarEstrutura(tx: Tx, usuario: UsuarioAutenticado, e: { id: string; empresa_id: string }, programacaoId: string, itens: readonly ItemLegado[], estrutura?: Programacao) {
  if (!estrutura) {
    const [anterior] = await linhas<Programacao | null>(tx`select estrutura j from programacoes where evento_id = ${e.id} and id <> ${programacaoId} and estrutura is not null order by versao desc limit 1`);
    if (!anterior) return;
    const r = aplicarSobrescritas(anterior, itens);
    estrutura = r.estrutura;
    if (r.mudancas.length) await auditar(tx, usuario, { acao: "PROGRAMACAO_SOBRESCRITA", entidade: "programacao", entidadeId: programacaoId, empresaId: e.empresa_id, dados: { mudancas: r.mudancas } });
  }
  await tx`update programacoes set estrutura = ${tx.json(estrutura)} where id = ${programacaoId}`;
}
