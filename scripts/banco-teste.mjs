// Sobe um Postgres descartável (Docker), simula o mínimo do Supabase (roles, auth.users, storage),
// aplica TODAS as migrations duas vezes (prova de idempotência) e roda os testes de integração
// (arquivos *.banco.test.ts) com PIEGGI_TEST_DATABASE_URL apontando para ele. Nunca toca o Supabase real.
// Uso: npm run test:banco
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { migrar } from "./migrar.mjs";

const nome = `pieggi-teste-${randomUUID().slice(0, 8)}`;
const docker = (...args) => {
  const r = spawnSync("docker", args, { encoding: "utf8", timeout: 120000 });
  if (r.status !== 0) throw new Error(r.stderr || r.error?.message || r.stdout);
  return r.stdout.trim();
};

let codigo = 1;
try {
  docker("run", "--rm", "-d", "--name", nome, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-p", "127.0.0.1::5432", "postgres:17-alpine");
  const porta = docker("port", nome, "5432/tcp").split("\n")[0].split(":").pop();
  const url = `postgres://postgres@127.0.0.1:${porta}/postgres`;
  for (let i = 0; i < 60; i++) {
    if (spawnSync("docker", ["exec", nome, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]).status === 0) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  await new Promise((r) => setTimeout(r, 800));
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text, metadata jsonb);
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;`);
  await sql.end();
  const silencioso = () => {};
  await migrar(url, { log: silencioso });
  // Idempotência: esquece o registro e reaplica tudo.
  const s2 = postgres(url, { max: 1 }); await s2`truncate pieggi.schema_migracoes`; await s2.end();
  await migrar(url, { log: silencioso });
  const s3 = postgres(url, { max: 1 });
  const [{ n }] = await s3`select count(*)::int n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace where ns.nspname = 'pieggi'`;
  await s3.end();
  if (n !== 0) throw new Error(`Banco deveria ser só armazenamento, mas tem ${n} função(ões) em pieggi.`);
  console.log("migrations OK (2×) e schema sem funções");
  const r = spawnSync("npx", ["vitest", "run", "--project", "banco", ...process.argv.slice(2)], {
    stdio: "inherit", shell: true, env: { ...process.env, PIEGGI_TEST_DATABASE_URL: url }
  });
  codigo = r.status ?? 1;
} catch (e) {
  console.error(e.message);
} finally {
  spawnSync("docker", ["stop", nome], { encoding: "utf8", timeout: 30000 });
}
process.exit(codigo);
