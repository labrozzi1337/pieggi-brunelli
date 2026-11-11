-- Cadastro inicial da empresa emitente. Execute depois de 20261005120000_fiscal_nfe.sql.
-- CRT 3 foi definido porque a empresa não está optante pelo Simples Nacional.

insert into pieggi.fiscal_empresas (
  id,
  cnpj,
  razao_social,
  nome_fantasia,
  inscricao_estadual,
  inscricao_municipal,
  crt,
  logradouro,
  numero_endereco,
  complemento,
  bairro,
  codigo_municipio_ibge,
  municipio,
  uf,
  cep,
  telefone,
  email,
  ambiente_padrao,
  criado_em,
  atualizado_em
) values (
  '68b78b8c-1d79-49a7-9fae-dba38f3aeb50',
  '30744595000150',
  'Pieggi Eventos LTDA',
  'Mondi',
  '159425310119',
  null,
  '3',
  'Rua Dr Jose Aureo Bustamante',
  '22',
  null,
  'Santo Amaro',
  '3550308',
  'São Paulo',
  'SP',
  '04710090',
  '11992046070',
  'bruno@pieggi.com.br',
  'HOMOLOGACAO',
  current_timestamp,
  current_timestamp
)
on conflict (cnpj) do update set
  razao_social = excluded.razao_social,
  nome_fantasia = excluded.nome_fantasia,
  inscricao_estadual = excluded.inscricao_estadual,
  crt = excluded.crt,
  logradouro = excluded.logradouro,
  numero_endereco = excluded.numero_endereco,
  complemento = excluded.complemento,
  bairro = excluded.bairro,
  codigo_municipio_ibge = excluded.codigo_municipio_ibge,
  municipio = excluded.municipio,
  uf = excluded.uf,
  cep = excluded.cep,
  telefone = excluded.telefone,
  email = excluded.email,
  ambiente_padrao = excluded.ambiente_padrao,
  atualizado_em = current_timestamp;

insert into pieggi.fiscal_configuracoes (
  id,
  empresa_id,
  ambiente,
  codigo_regime_tributario,
  versao_layout_nfe,
  criado_em,
  atualizado_em
) values (
  '5f90b054-8590-485a-9d47-b0c9bc6e1451',
  '68b78b8c-1d79-49a7-9fae-dba38f3aeb50',
  'HOMOLOGACAO',
  '3',
  '4.00',
  current_timestamp,
  current_timestamp
)
on conflict (empresa_id) do update set
  ambiente = excluded.ambiente,
  codigo_regime_tributario = excluded.codigo_regime_tributario,
  versao_layout_nfe = excluded.versao_layout_nfe,
  atualizado_em = current_timestamp;

insert into pieggi.fiscal_series (
  id,
  empresa_id,
  modelo,
  serie,
  ativa,
  criado_em,
  atualizado_em
) values (
  '4cdf87b4-9b29-4d7d-8e60-e27df7ec2c60',
  '68b78b8c-1d79-49a7-9fae-dba38f3aeb50',
  '55',
  1,
  true,
  current_timestamp,
  current_timestamp
)
on conflict (empresa_id, modelo, serie) do update set
  ativa = excluded.ativa,
  atualizado_em = current_timestamp;
