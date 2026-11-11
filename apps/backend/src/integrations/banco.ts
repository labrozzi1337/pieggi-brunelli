import postgres from "postgres";

// Conexão direta com o Postgres (schema pieggi). O banco só armazena: toda regra, autorização,
// versionamento e auditoria acontecem no backend, dentro de transações abertas aqui.
export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;

// Um pool por processo: no dev o Next pode avaliar este módulo mais de uma vez (uma por rota).
const global = globalThis as typeof globalThis & { pieggiBanco?: Sql };

export function banco(): Sql {
  if (global.pieggiBanco) return global.pieggiBanco;
  const url = process.env.PIEGGI_DATABASE_URL;
  if (!url) throw new ErroBancoNaoConfigurado();
  global.pieggiBanco = postgres(url, {
    // Pooler de sessão (5432) aceita prepared statements: 1 ida ao banco por consulta em vez de 2.
    // O de transação (6543) não aceita, então lá continua desligado.
    prepare: new URL(url).port !== "6543",
    max: Number(process.env.PIEGGI_DATABASE_POOL ?? 10),
    // Abrir conexão custa ~1 s (TLS + pooler remoto): mantém as conexões vivas em vez de fechar por ociosidade.
    idle_timeout: 0,
    connection: { search_path: "pieggi", application_name: "pieggi-backend" },
    transform: { undefined: null },
    types: { numeric: { to: 0, from: [1700], serialize: (v: unknown) => String(v), parse: (v: string) => Number(v) } }
  });
  return global.pieggiBanco;
}

/** Abre as conexões do pool ao subir o servidor, para o primeiro clique não pagar o handshake. */
export async function aquecerBanco() {
  if (!process.env.PIEGGI_DATABASE_URL) return;
  // Nunca derruba o servidor (nem o build): sem banco, a primeira requisição abre a conexão normalmente.
  try {
    const sql = banco();
    await Promise.all(Array.from({ length: Math.min(4, Number(process.env.PIEGGI_DATABASE_POOL ?? 10)) }, () => sql`select 1`));
  } catch { /* ignora */ }
}

/** Executa `fn` numa transação; qualquer exceção desfaz tudo. */
export function transacao<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return banco().begin(fn);
}

export class ErroBancoNaoConfigurado extends Error {
  readonly status = 503 as const;
  constructor() { super("Configure PIEGGI_DATABASE_URL no backend (Supabase → Connect → Session pooler)."); }
}

/** Só para testes de integração: troca a conexão padrão. */
export function definirBancoParaTestes(sql: Sql | undefined) { global.pieggiBanco = sql; }
