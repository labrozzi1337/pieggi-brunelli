// Cliente e o que as regras dizem dele: chave de regras (STARTSE, INTELI, WTC…), endereço/contato fixos e tabela padrão.
// Nada aqui é valor de negócio: tudo vem das regras vigentes na data do evento.
import type postgres from "postgres";
import { z } from "zod";
import type { UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import { Leitor, type Regra } from "@/dominios/regras/motor";
import { carregarRegras, dataSaoPaulo } from "@/dominios/regras/repositorio";
import { normalizar } from "@/dominios/regras/classificacao";

type Leitura = postgres.ISql;
const hojeSaoPaulo = () => dataSaoPaulo(new Date());

export interface FixosCliente { chave: string | null; endereco?: string; contato?: string; tabela?: string }

/** Chaves de cliente que têm alguma regra própria. */
export const chavesComRegra = (regras: readonly Regra[]) => [...new Set(regras.filter((r) => r.escopoTipo === "CLIENTE").map((r) => r.escopoChave))].sort();

/** "StartSe Educação Ltda" → STARTSE: alguma palavra do nome é uma chave de cliente com regra própria. */
export function chaveDoNome(nome: string, chaves: readonly string[]): string | null {
  const palavras = new Set(normalizar(nome).toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean));
  return chaves.find((c) => palavras.has(c)) ?? null;
}

/** Endereço, contato e tabela que o cliente tem fixos nas regras (data = data do evento). */
export function fixosDoCliente(regras: readonly Regra[], chave: string | null, data: string): FixosCliente {
  const leitor = new Leitor(regras, { data, cliente: chave ?? undefined });
  const ler = (codigo: string) => leitor.ler(codigo, z.string().min(1), {}, false);
  return { chave, endereco: ler("endereco.fixo"), contato: ler("contato.fixo"), tabela: ler("tabela_preco.padrao") };
}

/** Tabelas de preço conhecidas: as das regras de preço e as padrões por cliente. */
export const tabelasDePreco = (regras: readonly Regra[]) => [...new Set([
  ...regras.filter((r) => r.codigo.startsWith("preco.") && !r.codigo.startsWith("preco.avulso.")).map((r) => r.codigo.split(".")[1]!),
  ...regras.filter((r) => r.codigo === "tabela_preco.padrao" && typeof r.valor === "string").map((r) => r.valor as string)
])].sort();

/** Fixos do cliente do evento, na data do evento. */
export async function fixosDoEvento(sql: Leitura, usuario: Pick<UsuarioAutenticado, "papeis">, eventoId: string) {
  const [c] = await sql<{ chave_regras: string | null; data: string | null }[]>`
    select c.chave_regras, e.data_evento::text data from eventos e join clientes c on c.id = e.cliente_id where e.id = ${eventoId}`;
  return fixosDoCliente(await carregarRegras(sql, usuario), c?.chave_regras ?? null, c?.data ?? hojeSaoPaulo());
}

/** Clientes para o autocompletar + o que cada chave de cliente preenche sozinha. */
export async function listarClientes(sql: Leitura, usuario: UsuarioAutenticado, empresa: string) {
  const [regras, clientes] = await Promise.all([carregarRegras(sql, usuario), sql<{ id: string; tipo: string; nome: string; documento: string | null; email: string | null; telefone: string | null; chave_regras: string | null }[]>`
    select id, tipo, nome, documento, email, telefone, chave_regras from clientes where empresa_id = ${empresa} order by nome`]);
  const hoje = hojeSaoPaulo();
  const chaves = chavesComRegra(regras);
  return {
    clientes: clientes.map((c) => ({ id: c.id, tipo: c.tipo, nome: c.nome, documento: c.documento, email: c.email, telefone: c.telefone, chaveRegras: c.chave_regras ?? chaveDoNome(c.nome, chaves) })),
    fixos: chaves.map((chave) => fixosDoCliente(regras, chave, hoje)),
    padrao: fixosDoCliente(regras, null, hoje),
    tabelas: tabelasDePreco(regras)
  };
}
