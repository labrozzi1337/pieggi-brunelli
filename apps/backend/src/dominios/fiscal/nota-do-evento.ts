// NF-e do evento sem digitação: destinatário do cadastro do cliente e itens da programação APROVADA, cada um ligado
// ao produto fiscal da planilha da contabilidade (mesmo grupo + nome; senão só o nome). Quantidade = a programada.
import type postgres from "postgres";
import type { UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import { podeAcessar } from "@/dominios/operacao/eventos";
import { ErroOperacao } from "@/dominios/operacao/http";
import { normalizar } from "./catalogo-planilha";

export const PAPEIS_NOTA = ["ADMIN", "FINANCEIRO"] as const;

interface ItemProgramado { nome: string; quantidade: number; unidade: string; cardapioItemId?: string | null }
interface Produto { id: string; descricao: string; grupo: string | null }

/** Liga os itens programados aos produtos fiscais e soma as quantidades por produto. Pura. */
export function vincularItens(itens: readonly ItemProgramado[], cardapio: ReadonlyMap<string, { grupo: string; nome: string }>, produtos: readonly Produto[]) {
  const porGrupoNome = new Map(produtos.map((p) => [`${normalizar(p.grupo ?? "")}|${normalizar(p.descricao)}`, p]));
  const porNome = new Map<string, Produto | null>();
  for (const p of produtos) { const k = normalizar(p.descricao); porNome.set(k, porNome.has(k) ? null : p); } // nome repetido: ambíguo
  const quantidades = new Map<string, number>();
  const semProduto: string[] = [];
  for (const i of itens) {
    if (!(i.quantidade > 0)) continue;
    const c = i.cardapioItemId ? cardapio.get(i.cardapioItemId) : undefined;
    const nome = normalizar(c?.nome ?? i.nome);
    const produto = (c && porGrupoNome.get(`${normalizar(c.grupo)}|${nome}`)) || porNome.get(nome);
    if (!produto || i.unidade !== "UN") { semProduto.push(`${i.nome} (${i.quantidade} ${i.unidade.toLowerCase()})`); continue; }
    quantidades.set(produto.id, (quantidades.get(produto.id) ?? 0) + i.quantidade);
  }
  return { itens: [...quantidades].map(([produtoId, quantidade]) => ({ produtoId, quantidade })), semProduto };
}

export async function notaDoEvento(sql: postgres.ISql, usuario: UsuarioAutenticado, eventoId: string) {
  const [e] = await sql<{ empresa_id: string; titulo: string; data_evento: string | null; nome: string; documento: string | null; valor_venda: number | null }[]>`
    select e.empresa_id, e.titulo, e.data_evento::text, c.nome, c.documento, v.valor_venda
    from eventos e join clientes c on c.id = e.cliente_id left join evento_valores v on v.evento_id = e.id where e.id = ${eventoId}`;
  if (!e) throw new ErroOperacao("Evento não encontrado.", 404);
  if (!podeAcessar(usuario, e.empresa_id, PAPEIS_NOTA)) throw new ErroOperacao("Emissão restrita ao administrador e financeiro.", 403);
  const [prog] = await sql<{ versao: number; itens: ItemProgramado[] }[]>`
    select versao, itens from programacoes where evento_id = ${eventoId} and status = 'APROVADA' order by versao desc limit 1`;
  const itens = prog?.itens ?? [];
  const ids = [...new Set(itens.map((i) => i.cardapioItemId).filter((x): x is string => !!x))];
  const [cardapio, produtos] = await Promise.all([
    ids.length ? sql<{ id: string; grupo: string; nome: string }[]>`select id, grupo, nome from cardapio_itens where id = any(${ids}::uuid[])` : Promise.resolve([]),
    sql<Produto[]>`select id, descricao, grupo from fiscal_produtos where empresa_id = ${e.empresa_id} and ativo`
  ]);
  const vinculo = vincularItens(itens, new Map(cardapio.map((c) => [c.id, c])), produtos);
  return {
    empresaId: e.empresa_id, destinatario: { cpfCnpj: e.documento ?? "", nome: e.nome },
    informacoes: `Referente ao evento ${e.titulo}${e.data_evento ? ` de ${e.data_evento.split("-").reverse().join("/")}` : ""}.`,
    programacaoVersao: prog?.versao ?? null, valorProposta: e.valor_venda === null ? null : Number(e.valor_venda), ...vinculo
  };
}
