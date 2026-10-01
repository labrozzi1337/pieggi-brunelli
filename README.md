# Start Back

Base de projeto do Grupo Pomin com frontend React/Vite, backend Next.js e persistência Supabase isolada no schema `start_back`.

## Arquitetura

```text
Browser ──HTTP──> Vite/React (:5173)
   │
   └── /api/v1/* ──> Next.js (:3000) ──> Supabase Data API ──> start_back.*
```

- O frontend não recebe URL nem chave do Supabase.
- O backend concentra validação, autorização e regras de negócio.
- O banco contém somente estrutura, constraints, índices, RLS e dados. Não há funções ou triggers.
- Nenhum objeto da aplicação é criado no schema `public`.
- O contrato HTTP está em `docs/openapi.yaml`.
- A decisão arquitetural está em `docs/adr/0001-monorepo-vite-next-supabase.md`.

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

## Configuração do Supabase

1. Abra o SQL Editor do projeto Supabase.
2. Execute `supabase/migrations/20261001103000_start_back_init.sql`.
3. Em **Project Settings → API → Exposed schemas**, exponha `start_back`. Não adicione tabelas da aplicação em `public`.
4. Preencha `START_BACK_SUPABASE_URL` e `START_BACK_SUPABASE_SERVICE_ROLE_KEY` no ambiente do backend.
5. Mantenha a service role exclusivamente no servidor. O endpoint inicial a usa apenas para o health check controlado, sem entrada do usuário.

Não use `supabase db push` em um banco compartilhado por vários projetos. Aplique a migração pelo SQL Editor, conforme a constituição do repositório.

Para gerar tipos depois de vincular o CLI ao projeto:

```bash
npx supabase link --project-ref SEU_PROJECT_ID
npm run db:types
```

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
npm test           # testes determinísticos
npm run build      # builds de produção
npm run check      # pipeline local completo
npm audit          # auditoria de dependências
```

## Container de produção

O nginx serve a SPA, aplica fallback de rotas, headers de segurança e encaminha `/api/*` ao container Next.js. Defina as variáveis do backend em um `.env` na raiz e execute:

```bash
docker compose up --build -d
```

A aplicação fica disponível em `http://localhost:8080`. Altere a porta com `START_BACK_APP_PORT`.

## Estrutura

```text
apps/
├── frontend/       # React 18 + Vite + Tailwind
└── backend/        # Next.js App Router, somente API
docs/
├── adr/            # decisões arquiteturais
└── openapi.yaml    # contrato HTTP
supabase/
└── migrations/     # DDL manual, schema start_back
Documentos/         # constituição e referências obrigatórias
```

## Como adicionar uma entidade

1. Defina a tabela em uma nova migration timestampada dentro de `start_back`.
2. Não crie função ou trigger. O backend deve preencher e atualizar campos derivados, inclusive `updated_at`.
3. Ative RLS e mantenha `anon`/`authenticated` sem acesso direto quando o fluxo for exclusivamente server-side.
4. Gere novamente os tipos do schema.
5. Crie o serviço de persistência e a rota `/api/v1/<recursos>` no backend.
6. Valide todo input externo com Zod e devolva erros no formato OpenAPI.
7. Adicione testes de regra, autorização e persistência antes de conectar a tela.

## Segurança

- Nunca use variáveis `VITE_*` para segredos; tudo com esse prefixo entra no bundle.
- Nunca envie a service role ao navegador.
- Novos endpoints com identidade de usuário devem validar o Bearer token e não podem usar uma role privilegiada para contornar autorização.
- CORS aceita somente as origens listadas em `START_BACK_ALLOWED_ORIGINS`.
- Logs são JSON e carregam `requestId`, sem PII ou segredos.
- Não existem dados fictícios ou seeds de produção nesta base.
