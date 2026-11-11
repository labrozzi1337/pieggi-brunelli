import { randomUUID } from "node:crypto";
import { autorizarEmpresa, type UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import { hojeSaoPaulo, linhas, podeAcessar, veValores, type Leitura, type Linha } from "@/dominios/operacao/eventos";
import { auditar, ErroOperacao } from "@/dominios/operacao/http";
import type { EscopoTipo } from "@/dominios/regras/motor";
import { carregarRegras } from "@/dominios/regras/repositorio";
import type { Tx } from "@/integrations/banco";

const ehAdmin = (usuario: UsuarioAutenticado) => usuario.papeis.includes("ADMIN");
const tipoJson = (v: unknown) => v === null ? "null" : Array.isArray(v) ? "array" : typeof v;

/** Regras vigentes e clientes com a chave de regras. Clientes só para perfis comerciais/financeiros. */
export async function listarRegras(sql: Leitura, usuario: UsuarioAutenticado, empresa: string) {
  autorizarEmpresa(usuario, empresa);
  const [regras, clientes] = await Promise.all([
    carregarRegras(sql, usuario),
    veValores(usuario) ? sql<{ id: string; nome: string; chave_regras: string | null }[]>`select id, nome, chave_regras from clientes where empresa_id = ${empresa} order by nome` : Promise.resolve([])
  ]);
  return { regras, clientes: clientes.map((c) => ({ id: c.id, nome: c.nome, chaveRegras: c.chave_regras })) };
}

export interface AlteracaoRegra { codigo: string; escopoTipo: EscopoTipo; escopoChave: string; valor: unknown; vigenteDesde: string; justificativa: string; titulo?: string }

/** Nova versão de regra. Vigência nunca retroativa: evento já calculado não muda (Caso 7). Só a diretoria. */
export async function alterarRegra(tx: Tx, usuario: UsuarioAutenticado, a: AlteracaoRegra) {
  if (!ehAdmin(usuario)) throw new ErroOperacao("Somente a diretoria altera regras.", 403);
  if (!/^[a-z0-9_]+(\.[A-Za-z0-9_]+)*$/.test(a.codigo) || a.valor === null || a.valor === undefined) throw new ErroOperacao("Regra inválida.", 400);
  if (!a.vigenteDesde || a.vigenteDesde < hojeSaoPaulo()) throw new ErroOperacao("A vigência não pode ser retroativa: eventos já calculados não podem mudar.", 409);
  const justificativa = a.justificativa.trim();
  if (justificativa.length < 5 || justificativa.length > 1000) throw new ErroOperacao("Informe a justificativa da alteração.", 400);
  const chave = a.escopoTipo === "GLOBAL" ? "" : a.escopoChave;
  // Serializa versões concorrentes do mesmo código.
  await tx`select pg_advisory_xact_lock(hashtext(${"pieggi.regra:" + a.codigo}))`;
  const [anterior] = await tx<{ id: string; titulo: string; descricao: string; financeiro: boolean; valor: unknown }[]>`
    select id, titulo, descricao, financeiro, valor from regras_negocio
    where codigo = ${a.codigo} and escopo_tipo = ${a.escopoTipo} and escopo_chave = ${chave} and valor is not null and status <> 'REVOGADA'
    order by vigente_desde desc, versao desc limit 1`;
  const titulo = a.titulo?.trim() ?? "";
  if (!anterior && titulo.length < 3) throw new ErroOperacao("Informe o título da nova regra.", 400);
  if (anterior && tipoJson(anterior.valor) !== tipoJson(a.valor)) throw new ErroOperacao("O novo valor precisa ter o mesmo formato do anterior.", 409);
  const [proxima] = await tx<{ versao: number; financeiro: boolean | null }[]>`
    select coalesce(max(versao), 0) + 1 versao, bool_or(financeiro) financeiro from regras_negocio where codigo = ${a.codigo}`;
  const versao = proxima?.versao ?? 1;
  const id = randomUUID();
  await tx`insert into regras_negocio (id, codigo, versao, titulo, descricao, origem, status, escopo, vigente_desde, substitui_regra_id, criado_por, valor, escopo_tipo, escopo_chave, financeiro, justificativa)
    values (${id}, ${a.codigo}, ${versao}, ${titulo || anterior?.titulo || null}, ${anterior?.descricao ?? titulo}, 'Admin', 'APROVADA', '{}'::jsonb,
      (${a.vigenteDesde}::date::timestamp at time zone 'America/Sao_Paulo'), ${anterior?.id ?? null}, ${usuario.id}, ${tx.json(a.valor)},
      ${a.escopoTipo}, ${chave}, ${anterior?.financeiro ?? proxima?.financeiro ?? true}, ${justificativa})`;
  await auditar(tx, usuario, { acao: "REGRA_ALTERADA", entidade: "regra_negocio", entidadeId: id, dados: {
    codigo: a.codigo, escopo: `${a.escopoTipo}:${chave}`, antes: anterior?.valor ?? null, depois: a.valor, vigenteDesde: a.vigenteDesde, justificativa } });
  return { id, versao };
}

/** Chave de regras do cliente (STARTSE, INTELI, WTC, IPT…). A regra segue o cliente, não o endereço. */
export async function definirChaveRegrasCliente(tx: Tx, usuario: UsuarioAutenticado, clienteId: string, chave: string) {
  const [c] = await tx<{ id: string; empresa_id: string; chave_regras: string | null }[]>`select id, empresa_id, chave_regras from clientes where id = ${clienteId} for update`;
  if (!c || !ehAdmin(usuario) || !podeAcessar(usuario, c.empresa_id)) throw new ErroOperacao("Acesso negado.", 403);
  const depois = chave.trim().toUpperCase() || null;
  await tx`update clientes set chave_regras = ${depois}, atualizado_em = now() where id = ${c.id}`;
  await auditar(tx, usuario, { acao: "CLIENTE_CHAVE_REGRAS", entidade: "cliente", entidadeId: c.id, empresaId: c.empresa_id, dados: { antes: c.chave_regras, depois } });
}

/** Cardápio; custo só para perfis comerciais/financeiros. */
export async function listarCardapio(sql: Leitura, usuario: UsuarioAutenticado) {
  const [itens, custos] = await Promise.all([
    sql<Linha[]>`select id,familia,grupo,categoria,tier,nome,ingredientes,unidade,nome_en,nome_es,selo,estacao,fornecedor,ativo from cardapio_itens order by grupo, nome`,
    veValores(usuario) ? sql<{ item_id: string; custo: number }[]>`select item_id, custo from cardapio_custos` : Promise.resolve([])
  ]);
  const custo = new Map(custos.map((c) => [c.item_id, c.custo]));
  return itens.map((i) => ({
    id: i.id, familia: i.familia, grupo: i.grupo, categoria: i.categoria, tier: i.tier, nome: i.nome, ingredientes: i.ingredientes,
    unidade: i.unidade, nomeEn: i.nome_en, nomeEs: i.nome_es, selo: i.selo, estacao: i.estacao, fornecedor: i.fornecedor, ativo: i.ativo, custo: custo.get(String(i.id)) ?? null
  }));
}

export interface AlteracaoCardapio { nomeEn?: string; nomeEs?: string; selo?: string; estacao?: string; fornecedor?: string; ativo?: boolean; custo?: number }

/** Só a diretoria altera o cardápio; campo ausente fica como está; texto vazio vira nulo. */
export async function salvarItemCardapio(tx: Tx, usuario: UsuarioAutenticado, id: string, dados: AlteracaoCardapio) {
  if (!ehAdmin(usuario)) throw new ErroOperacao("Somente a diretoria altera o cardápio.", 403);
  const [antes] = await linhas(tx`select to_jsonb(i) || jsonb_build_object('custo', (select custo from cardapio_custos where item_id = i.id)) j from cardapio_itens i where id = ${id} for update`);
  if (!antes) throw new ErroOperacao("Item não encontrado.", 404);
  const vazioNulo = (v: string) => v.trim() || null;
  const campos = Object.fromEntries(Object.entries({
    nome_en: dados.nomeEn === undefined ? undefined : vazioNulo(dados.nomeEn), nome_es: dados.nomeEs === undefined ? undefined : vazioNulo(dados.nomeEs),
    selo: dados.selo === undefined ? undefined : dados.selo || null, estacao: dados.estacao === undefined ? undefined : dados.estacao || null,
    fornecedor: dados.fornecedor === undefined ? undefined : vazioNulo(dados.fornecedor), ativo: dados.ativo
  }).filter(([, v]) => v !== undefined));
  await tx`update cardapio_itens set ${tx({ ...campos, atualizado_por: usuario.id })}, atualizado_em = now() where id = ${id}`;
  if (dados.custo !== undefined) {
    if (dados.custo < 0) throw new ErroOperacao("Custo inválido.", 400);
    await tx`insert into cardapio_custos (item_id, custo) values (${id}, ${dados.custo}) on conflict (item_id) do update set custo = excluded.custo, atualizado_em = now()`;
  }
  await auditar(tx, usuario, { acao: "CARDAPIO_ITEM_ALTERADO", entidade: "cardapio_item", entidadeId: id, dados: { antes, alteracoes: dados } });
}
