-- O banco da Pieggi passa a ser somente armazenamento (ADR 0001).
-- Toda regra de negócio, autorização, versionamento, auditoria e geração de derivados mora no backend
-- (apps/backend/src/dominios), que acessa o schema pieggi por conexão Postgres direta e transacional.
-- Esta migration remove a lógica que havia sido escrita em PL/pgSQL. Idempotente.
begin;

-- 1. Funções e triggers de negócio (CASCADE leva os triggers e as policies que dependem delas).
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'pieggi'
  loop
    execute format('drop function if exists %s cascade', f.assinatura);
  end loop;
end $$;

-- 2. Policies restantes no schema e no storage: o acesso é decidido pelo backend.
do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies where schemaname = 'pieggi' loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
  for p in select schemaname, tablename, policyname from pg_policies where schemaname = 'storage' and policyname like 'pieggi\_%' loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- 3. Nenhum acesso pela Data API pública: RLS ligado e sem policy = negado para anon/authenticated.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'pieggi' loop
    execute format('alter table pieggi.%I enable row level security', t.tablename);
    execute format('revoke all on table pieggi.%I from public, anon, authenticated', t.tablename);
  end loop;
end $$;
revoke usage on schema pieggi from anon, authenticated;

commit;
