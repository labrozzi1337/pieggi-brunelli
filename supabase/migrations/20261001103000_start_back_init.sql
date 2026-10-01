-- Isola os dados deste projeto em um schema próprio e mantém toda regra de negócio no backend.

create schema if not exists start_back;

revoke all on schema start_back from public, anon, authenticated;
grant usage on schema start_back to service_role;

create table if not exists start_back.app_metadata (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

alter table start_back.app_metadata enable row level security;

revoke all on table start_back.app_metadata from public, anon, authenticated;
grant select, insert, update, delete on table start_back.app_metadata to service_role;

alter default privileges in schema start_back revoke all on tables from public, anon, authenticated;
alter default privileges in schema start_back grant select, insert, update, delete on tables to service_role;

