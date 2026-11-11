// Apoio aos testes de integração (*.banco.test.ts). Só roda via `npm run test:banco`,
// que sobe um Postgres descartável com todas as migrations aplicadas.
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { definirBancoParaTestes, type Sql } from "@/integrations/banco";
import type { PapelUsuario, UsuarioAutenticado } from "@/dominios/acesso/autenticacao";

export function sqlTeste(): Sql {
  const url = process.env.PIEGGI_TEST_DATABASE_URL;
  if (!url) throw new Error("Rode com `npm run test:banco`.");
  const sql = postgres(url, { prepare: false, max: 4, onnotice: () => {}, connection: { search_path: "pieggi" },
    transform: { undefined: null },
    types: { numeric: { to: 0, from: [1700], serialize: (v: unknown) => String(v), parse: (v: string) => Number(v) } } });
  definirBancoParaTestes(sql);
  return sql;
}

/** Empresa emitente carregada pela migration 20261005130000. */
export async function empresaPadrao(sql: Sql): Promise<string> {
  const [e] = await sql<{ id: string }[]>`select id from fiscal_empresas order by criado_em limit 1`;
  if (!e) throw new Error("Empresa emitente não encontrada nas migrations.");
  return e.id;
}

/** Cria um usuário com os papéis pedidos e acesso à empresa. */
export async function criarUsuario(sql: Sql, empresaId: string, papeis: PapelUsuario[], nome = "Teste"): Promise<UsuarioAutenticado> {
  const id = randomUUID();
  const email = `${id.slice(0, 8)}@teste.local`;
  await sql`insert into auth.users (id, email) values (${id}, ${email})`;
  await sql`insert into usuarios (id, nome) values (${id}, ${nome})`;
  await sql`insert into usuario_empresas (usuario_id, empresa_id) values (${id}, ${empresaId})`;
  for (const papel of papeis) await sql`insert into usuario_papeis (usuario_id, papel) values (${id}, ${papel})`;
  return { id, email, nome, papeis, empresas: [empresaId] };
}
