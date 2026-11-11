-- A senha do A1 é persistida apenas cifrada pelo backend.

alter table pieggi.fiscal_certificados
  add column if not exists senha_criptografada text not null default '';
