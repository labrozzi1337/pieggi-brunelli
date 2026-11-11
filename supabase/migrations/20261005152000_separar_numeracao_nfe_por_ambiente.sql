alter table pieggi.fiscal_documentos
  drop constraint if exists fiscal_documentos_empresa_id_modelo_serie_numero_key;

alter table pieggi.fiscal_documentos
  drop constraint if exists fiscal_documentos_empresa_ambiente_modelo_serie_numero_key;

alter table pieggi.fiscal_documentos
  add constraint fiscal_documentos_empresa_ambiente_modelo_serie_numero_key
  unique (empresa_id, ambiente, modelo, serie, numero);
