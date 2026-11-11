# Pieggi

Base da Pieggi com frontend React/Vite, backend Next.js e persistência Supabase isolada no schema `pieggi`.

## Arquitetura

```text
Browser ──HTTP──> Vite/React (:5173)
   │
   └── /api/v1/* ──> Next.js (:3000) ──Postgres (transações)──> pieggi.*
                          └──> Supabase Auth / Storage (login, fotos e PDFs)
```

- **Toda regra de negócio mora no backend** (`apps/backend/src/dominios`): cálculo, autorização, versionamento, auditoria, invalidação de derivados e geração dos documentos. O banco só armazena: tabelas e constraints, **nenhuma função, trigger ou policy** (a migration `20261109100000_banco_somente_armazenamento.sql` removeu a lógica antiga e o teste de integração garante que ela não volta).
- Os **valores** de negócio (preços, multiplicadores, gramaturas, roteamentos, textos fixos, traduções) são dados versionados em `pieggi.regras_negocio`, editáveis pela tela **Regras e cardápio**; o cálculo de um evento usa a regra vigente na data do evento.
- O frontend não recebe URL nem chave do Supabase. A Data API pública fica fechada (RLS ligado, sem policy).
- Contrato HTTP em `docs/openapi.yaml`; decisão arquitetural em `docs/adr/0001-monorepo-vite-next-supabase.md`; especificação em `docs/especificacao-2026-11-05.txt`.

## Requisitos

- Node.js 24+
- npm 11+
- Um projeto Supabase

## Instalação

```bash
npm install
```

Copie os arquivos de ambiente:

```powershell
Copy-Item apps/frontend/.env.example apps/frontend/.env.local
Copy-Item apps/backend/.env.example apps/backend/.env.local
```

Preencha apenas `apps/backend/.env.local` com as credenciais reais. Arquivos `.env*` locais são ignorados pelo Git.

## Configuração do banco

1. Em `apps/backend/.env.local`, preencha `PIEGGI_SUPABASE_URL`, `PIEGGI_SUPABASE_SERVICE_ROLE_KEY` e **`PIEGGI_DATABASE_URL`** (Supabase → **Connect** → *Session pooler*, porta 5432, com a senha do banco).
2. Aplique as migrations:

```bash
npm run db:migrar -- --listar   # mostra o que falta
npm run db:migrar               # aplica, em ordem, só o que falta
```

O executor registra cada arquivo em `pieggi.schema_migracoes` e só toca o schema `pieggi`. Todas as migrations são idempotentes, então é seguro rodar mesmo se parte delas já foi aplicada pelo SQL Editor.

3. Mantenha a service role e a URL do banco exclusivamente no servidor.

Para gerar tipos depois de vincular o CLI ao projeto:

```bash
npx supabase link --project-ref SEU_PROJECT_ID
npm run db:types
```

## Preparar a NF-e de produto

As migrations fiscais fazem parte de `npm run db:migrar`.

O catalogo importa 367 itens materiais da planilha fiscal recebida. Os seis itens de
servico/locacao e os tres de NCM ambiguo nao sao incluidos na NF-e modelo 55. Todo o
catalogo inicia com `revisao_fiscal_pendente`; aprove a tributacao e a unidade comercial
com a contabilidade antes de emitir em producao.

A migration de fundacao cria usuarios, papeis, escopo por empresa, regras versionadas
e auditoria. Se existir exatamente um usuario confirmado no Supabase Auth, ele recebe
o papel `ADMIN` e acesso as empresas existentes; com dois ou mais usuarios, nenhum
administrador e escolhido automaticamente. O acesso ao sistema usa cookies HttpOnly,
e as rotas fiscais validam papel e empresa no backend.

Preencha `PIEGGI_CHAVE_CIFRAGEM_FISCAL` no `.env` usado pelo Docker com uma chave
Base64 de 32 bytes. O A1 deve ficar em `storage/fiscal/<empresa-id>/certificados/`.
Depois de reiniciar `docker compose up -d`, use `POST /api/v1/fiscal/certificados` com
`empresaId`, nome do arquivo e senha. A senha e cifrada antes de chegar ao banco.

## Desenvolvimento

Um comando inicia os dois serviços:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- Health check: http://localhost:3000/api/v1/health

Sem credenciais, os dois servidores ainda iniciam e o health check retorna `503` com estado `unconfigured`. Isso permite preparar a interface sem fingir que o banco está conectado.

## Comandos

```bash
npm run dev        # Vite e Next em paralelo
npm run lint       # ESLint
npm run typecheck  # TypeScript estrito nos dois apps
npm test           # testes determinísticos (unidade)
npm run test:banco # integração: Postgres descartável no Docker, migrations 2×
npm run db:migrar  # aplica as migrations pendentes no banco real
npm run build      # builds de produção
npm run check      # pipeline local completo
npm audit          # auditoria de dependências
```

## Container de produção

O nginx serve a SPA, aplica fallback de rotas, headers de segurança e encaminha `/api/*` ao container Next.js. Defina as variáveis do backend em um `.env` na raiz e execute:

```bash
docker compose up --build -d
```

A aplicação fica disponível em `http://localhost:8080`. Altere a porta com `PIEGGI_APP_PORT`.

## Estrutura

```text
apps/
├── frontend/       # React 18 + Vite + Tailwind
└── backend/        # Next.js App Router, somente API
docs/
├── adr/            # decisões arquiteturais
└── openapi.yaml    # contrato HTTP
supabase/
└── migrations/     # DDL manual, schema pieggi
Documentos/         # constituição e referências obrigatórias
```

## Como adicionar uma entidade

1. Defina a tabela em uma nova migration timestampada dentro de `pieggi`.
2. Nada de função, trigger ou policy no banco: regra, autorização, revisão e auditoria ficam no serviço do backend, numa transação (`transacao`, `contexto`, `auditar`, `travarRevisao`).
3. Ative RLS sem policy (Data API fechada); o backend acessa por `PIEGGI_DATABASE_URL`.
4. Gere novamente os tipos do schema.
5. Crie o serviço de persistência e a rota `/api/v1/<recursos>` no backend.
6. Valide todo input externo com Zod e devolva erros no formato OpenAPI.
7. Adicione testes de regra, autorização e persistência antes de conectar a tela.

## Segurança

- Nunca use variáveis `VITE_*` para segredos; tudo com esse prefixo entra no bundle.
- Nunca envie a service role ao navegador.
- Todo endpoint autenticado passa por `contexto(request, papeis)`, que valida a sessão e o papel; o acesso por empresa é checado no domínio.
- CNPJ, telefone e chave PIX de freelancers são cifrados em repouso (`PIEGGI_CHAVE_CIFRAGEM_DADOS`).
- CORS aceita somente as origens listadas em `PIEGGI_ALLOWED_ORIGINS`.
- Logs são JSON e carregam `requestId`, sem PII ou segredos.
- Não existem dados fictícios ou seeds de produção nesta base.

## Estado atual

O que está pronto, o que depende de decisão da Pieggi e o que ainda falta está em `docs/lacunas-especificacao-2026-11.md`.
Amostras dos quatro documentos gerados ficam em `docs/amostras/` (gere com `GERAR_AMOSTRAS=1 npx vitest run apps/backend/src/dominios/documentos`).
