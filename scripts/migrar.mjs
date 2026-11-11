// Aplica as migrations de supabase/migrations em ordem, uma única vez cada, registrando em pieggi.schema_migracoes.
// Uso: npm run db:migrar            (lê PIEGGI_DATABASE_URL de apps/backend/.env.local ou do ambiente)
//      npm run db:migrar -- --listar (só mostra o que falta)
//      npm run db:migrar -- --registrar-ate=<arquivo.sql> (marca como aplicadas, sem rodar, as que já estão no banco)
// Todas as migrations do repositório são idempotentes, então rodar contra um banco onde parte delas
// já foi aplicada pelo SQL Editor é seguro: elas são reaplicadas e passam a ser registradas.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const pasta = `${raiz}supabase/migrations/`;

export function lerEnv() {
  for (const arquivo of [`${raiz}apps/backend/.env.local`, `${raiz}.env`]) {
    if (!existsSync(arquivo)) continue;
    for (const linha of readFileSync(arquivo, "utf8").split(/\r?\n/)) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

export async function migrar(url, { listar = false, registrarAte, log = console.log } = {}) {
  const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(`create schema if not exists pieggi;
      create table if not exists pieggi.schema_migracoes (nome text primary key, aplicada_em timestamptz not null default now());
      alter table pieggi.schema_migracoes enable row level security;`);
    // Banco que já recebeu migrations pelo SQL Editor: registra até `registrarAte` (inclusive) SEM reexecutar.
    if (registrarAte) {
      const antigas = readdirSync(pasta).filter((f) => f.endsWith(".sql") && f <= registrarAte).sort();
      for (const nome of antigas) await sql`insert into pieggi.schema_migracoes (nome) values (${nome}) on conflict do nothing`;
      log(`${antigas.length} migration(s) registradas como já aplicadas, sem reexecutar.`);
      return antigas;
    }
    const feitas = new Set((await sql`select nome from pieggi.schema_migracoes`).map((r) => r.nome));
    const pendentes = readdirSync(pasta).filter((f) => f.endsWith(".sql")).sort().filter((f) => !feitas.has(f));
    if (!pendentes.length) { log("Banco em dia: nenhuma migration pendente."); return []; }
    for (const nome of pendentes) {
      if (listar) { log(`pendente: ${nome}`); continue; }
      log(`aplicando ${nome}…`);
      await sql.unsafe(readFileSync(pasta + nome, "utf8"));
      await sql`insert into pieggi.schema_migracoes (nome) values (${nome}) on conflict do nothing`;
    }
    log(listar ? `${pendentes.length} pendente(s).` : `${pendentes.length} migration(s) aplicada(s).`);
    return pendentes;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (import.meta.url === `file:///${process.argv[1]?.replaceAll("\\", "/").replace(/^\//, "")}` || process.argv[1]?.endsWith("migrar.mjs")) {
  lerEnv();
  const url = process.env.PIEGGI_DATABASE_URL;
  if (!url) {
    console.error("Defina PIEGGI_DATABASE_URL em apps/backend/.env.local (Supabase → Connect → Session pooler, com a senha do banco).");
    process.exit(1);
  }
  const registrarAte = process.argv.find((a) => a.startsWith("--registrar-ate="))?.split("=")[1];
  migrar(url, { listar: process.argv.includes("--listar"), registrarAte }).catch((e) => { console.error(`Falhou: ${e.message}`); process.exit(1); });
}
