import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Banco descartável local, sem porta publicada e sem acesso ao Supabase real.
const container = `pieggi-test-${randomUUID().slice(0, 8)}`;
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', timeout: 120000 });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || result.stdout);
  return result.stdout;
}
function sql(input) { return docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], input); }
try {
  docker(['run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine']);
  for (let i = 0; i < 30; i++) {
    const ready = spawnSync('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], { encoding: 'utf8' });
    if (ready.status === 0) break;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  sql(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated; grant select,insert on storage.objects to authenticated;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;`);
  for (const name of ['20261005120000_fiscal_nfe.sql','20261005150000_catalogo_fiscal_produtos.sql','20261005153000_fundacao_acessos_regras_auditoria.sql','20261005154000_nucleo_eventos.sql','20261006100000_fluxo_operacional_versionado.sql']) {
    sql(readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'));
  }
  for (const name of ['20261006101000_evidencias_operacionais.sql','20261006102000_contratos_e_crm_transacional.sql','20261006103000_documentos_operacionais.sql','20261006104000_compras_consolidadas.sql','20261006105000_acesso_temporario_campo.sql','20261006106000_balanco_e_remanescentes.sql','20261006107000_financeiro_custos_realizados.sql','20261006108000_equipe_e_verbas.sql']) {
    const migration = readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
    sql(migration); sql(migration);
  }
  // Reexecutar a migration nova deve ser seguro.
  const resumo=readFileSync(new URL('../supabase/migrations/20261006109000_resumo_artefatos_eventos.sql',import.meta.url),'utf8');sql(resumo);sql(resumo);
  const roteiro=readFileSync(new URL('../supabase/migrations/20261006110000_roteiro_de_campo.sql',import.meta.url),'utf8');sql(roteiro);sql(roteiro);
  const propostas=readFileSync(new URL('../supabase/migrations/20261006111000_propostas_versionadas.sql',import.meta.url),'utf8');sql(propostas);sql(propostas);
  for (const name of ['20261108100000_motor_de_regras_e_cardapio.sql','20261108101000_carga_regras_e_cardapio.sql']) {
    const migration = readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
    sql(migration); sql(migration);
  }
  sql(readFileSync(new URL('../supabase/migrations/20261006100000_fluxo_operacional_versionado.sql', import.meta.url), 'utf8'));
  console.log(sql(readFileSync(new URL('./test-operacao-db.sql', import.meta.url), 'utf8')));
  console.log(sql(readFileSync(new URL('./test-compras-db.sql', import.meta.url), 'utf8')));
  console.log(sql(readFileSync(new URL('./test-campo-db.sql', import.meta.url), 'utf8')));
  console.log(sql(readFileSync(new URL('./test-balanco-db.sql', import.meta.url), 'utf8')));
  console.log(sql(readFileSync(new URL('./test-financeiro-db.sql', import.meta.url), 'utf8')));
  console.log(sql(readFileSync(new URL('./test-equipe-db.sql', import.meta.url), 'utf8')));
  console.log(sql(readFileSync(new URL('./test-roteiro-db.sql', import.meta.url), 'utf8')));
  console.log(sql(readFileSync(new URL('./test-propostas-db.sql', import.meta.url), 'utf8')));
  console.log(sql(readFileSync(new URL('./test-regras-db.sql', import.meta.url), 'utf8')));
  console.log(sql(`set role authenticated;set request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
    do $$ declare r jsonb;begin
      r:=pieggi.resumo_artefatos_eventos('20000000-0000-4000-8000-000000000001');
      if jsonb_array_length(r)=0 or r::text like '%valor%' or r::text like '%fornecedor%' then raise exception 'TESTE: indicadores ausentes ou vazando valores';end if;
      if exists(select 1 from jsonb_array_elements(r) a where a->>'programacao'='INVALIDADA' and a->>'comanda'<>'BLOQUEADO') then raise exception 'TESTE: comanda invalidada parece pronta';end if;
    end $$;`));
  console.log('OK: migrations, reexecução, isolamento RLS, versionamento e portões operacionais.');
} finally {
  spawnSync('docker', ['stop', container], { encoding: 'utf8', timeout: 30000 });
}
