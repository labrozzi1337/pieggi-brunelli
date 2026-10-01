# Arquitetura de referência

Este documento descreve **como construímos os sistemas** — stack, padrões, decisões e convenções. Não fala do que cada projeto faz. Use-o como ponto de partida pra qualquer projeto novo: você adapta o domínio, mas mantém a espinha igual pra ter consistência entre projetos, custo de manutenção baixo e reaproveitamento de infraestrutura.

---

## 1. Princípios

- **Multi-projeto, mesmo Supabase.** Vários projetos compartilham o mesmo Postgres/Auth do Supabase. Isso reduz custo e permite SSO entre eles.
- **RLS sempre ativo.** Toda tabela exposta via PostgREST tem RLS habilitado. Service Role só dentro de Edge Functions, nunca no client.
- **Server-side trust, client-side display.** O frontend não é fonte de verdade pra autorização. Toda permissão é re-verificada no banco (RLS) ou na Edge Function.
- **Tokens caros = otimização explícita.** LLM é caro. Tudo que entra no prompt passa por design consciente (resumo, cache, condicional).
- **Convenção sobre configuração.** Estruturas iguais entre projetos. Quem conhece um, conhece todos.
- **Sem over-engineering.** Não construir abstração antes de ter 3 usos concretos. Não adicionar dependência se a stdlib resolve.
- **Defesa em profundidade pra superfícies públicas.** Embeds, webhooks e endpoints anônimos têm pelo menos 2 camadas independentes de validação.

---

## 2. Stack

### 2.1 Frontend

| Camada | Escolha | Por quê |
|---|---|---|
| Build | **Vite** | Dev server rápido, HMR previsível, output ESM moderno |
| Framework | **React 18** | Padrão de mercado, ecossistema enorme |
| Linguagem | **TypeScript estrito** (`strict: true`, sem `any`) | Erros pegos em tempo de build, refactor seguro |
| Estilo | **Tailwind CSS** | Utility-first, zero CSS órfão, dark mode trivial |
| Componentes | **shadcn/ui** (copy-paste, não dependência) | Componentes acessíveis e estilizáveis, sem refém de versão |
| Rotas | **React Router v6** | API moderna (`<Route>` declarativo, hooks) |
| Estado servidor | **TanStack Query** quando necessário | Cache + revalidação + loading/error states gratuitos |
| Validação | **Zod** em fronteiras (forms, edge function bodies) | Tipos + runtime na mesma fonte |
| Ícones | **lucide-react** | Tree-shakeable, set consistente |
| Notificações | shadcn `useToast` + `sonner` quando precisar de stacks | Já vêm com o shadcn |

### 2.2 Backend / Plataforma

| Camada | Escolha | Por quê |
|---|---|---|
| DB | **Supabase Postgres** | Postgres real (não wrapper), RLS poderoso, extensions |
| Auth | **Supabase Auth** (com providers: email/senha, Microsoft/Azure, etc.) | Pronto, JWT padrão, gerencia sessão |
| API | **PostgREST** (auto-gerado) + **Edge Functions (Deno)** | Sem boilerplate de CRUD, edge functions só pra lógica privilegiada |
| Storage (quando necessário) | **Supabase Storage** | Integra com auth/RLS |
| Containerização | **Docker** + **nginx** (produção) | Deploy reprodutível, SPA com fallback /index.html |

### 2.3 LLM / IA

| Camada | Escolha | Por quê |
|---|---|---|
| Modelos | **Anthropic Claude** (Opus, Sonnet, Haiku) como default · **OpenAI** e **Google Gemini** como alternativas selecionáveis por agente | Time conhece os 3, mercados diferentes pedem modelos diferentes |
| Roteamento | Detecção de provider pelo **prefixo do model ID** (`claude-*`, `gpt-*`/`o*`, `gemini-*`) | Zero schema overhead, decisão no edge function |
| RAG-lite | Resumir documento antes de injetar no prompt (Haiku ~400 palavras) | Mantém tokens-por-chamada baixos sem montar pipeline de embeddings/vector DB |
| Logging | Persistir conversas + token usage por turno | Auditoria, billing interno, debugging |

### 2.4 CI/CD

| Camada | Escolha |
|---|---|
| CI | GitHub Actions — `lint` + `test` + `build` em push/PR pra `main` |
| Registry | Não usamos — deploy direto via `git pull` no servidor |
| Deploy | SSH + `docker compose up --build -d` em EC2 |
| Reaproveitamento | Workflow reutilizável (`workflow_call`) compartilhado entre projetos |

---

## 3. Convenções de banco

### 3.1 Prefixo de projeto

**Todo artefato leva o prefixo do projeto** (`<projeto>_users`, `<projeto>_can_view_x`, enum `<projeto>_role`, trigger `<projeto>_on_auth_user_created`). Motivo: vários projetos no mesmo Supabase. Sem prefixo, eles colidem.

### 3.2 Esquema padrão de tabela

```sql
CREATE TABLE public.<projeto>_<entidade> (
  id          UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  <fks>       UUID         NOT NULL REFERENCES public.<other>(id) ON DELETE CASCADE,
  <campos>    ...,
  status      <enum>       NOT NULL DEFAULT '<default>',  -- evita soft delete
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
ALTER TABLE public.<projeto>_<entidade> ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_<projeto>_<entidade>_<fk> ON public.<projeto>_<entidade>(<fk>);

CREATE TRIGGER update_<projeto>_<entidade>_updated_at
  BEFORE UPDATE ON public.<projeto>_<entidade>
  FOR EACH ROW EXECUTE FUNCTION public.<projeto>_update_updated_at();
```

- **UUID v4** sempre, `gen_random_uuid()` (pgcrypto).
- **TIMESTAMPTZ** sempre, nunca `timestamp without time zone`.
- **`updated_at` mantido por trigger**, não pelo código (evita inconsistência).
- **Soft delete não**, em vez disso use enum `status` (`active`/`blocked`/`archived`).

### 3.3 RLS por padrão

- `ENABLE ROW LEVEL SECURITY` em **toda** tabela exposta via PostgREST.
- Helpers `SECURITY DEFINER` pra checagens que cruzam tabelas (evita recursão e melhora performance):

  ```sql
  CREATE OR REPLACE FUNCTION public.<projeto>_can_x(_auth_id UUID, _resource_id UUID)
  RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS ( ... );
  $$;
  REVOKE EXECUTE ON FUNCTION public.<projeto>_can_x(uuid, uuid) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.<projeto>_can_x(uuid, uuid) TO authenticated;
  ```
- Policies em camadas: uma pra admin (full access), uma pra owner, uma pra membros via permissions table. PostgreSQL OR'a as policies do mesmo comando.

### 3.4 Identidade e auth

- `auth.users` é **global** (gerenciado pelo Supabase). **Nunca alteramos colunas dele**.
- Cada projeto tem sua tabela de perfil (`<projeto>_users`) com FK `auth_id → auth.users(id) ON DELETE CASCADE`.
- Trigger `AFTER INSERT ON auth.users` cria o perfil automaticamente, com `ON CONFLICT (email) DO NOTHING` (pra coexistir com triggers de outros projetos).
- Quando o admin cria um usuário:
  - Se o email já existe em `auth.users` (outro projeto) → **vincula** o perfil local ao `auth_id` existente, **sem** criar/alterar auth user. Senha original é preservada.
  - Se não existe → cria via `auth.admin.createUser` + perfil local.
- Lookup cross-schema (auth → public) via RPC `SECURITY DEFINER` no schema `public`, porque PostgREST não expõe `auth`.

### 3.5 Migrations

- Numeradas por timestamp: `YYYYMMDDHHMMSS_<descrição>.sql`.
- **Não usamos `supabase db push`** quando o banco é multi-projeto — o CLI tenta sincronizar todas as migrations e bloqueia. Aplicamos manual via **SQL Editor do Dashboard**.
- Cada migration deve ser **idempotente quando faz sentido** (`IF NOT EXISTS`, `OR REPLACE`).
- Comente o topo do arquivo com **o porquê**, não o quê.

---

## 4. Edge Functions

### 4.1 Layout

```
supabase/functions/
└── <projeto>-<dominio>-<acao>/
    └── index.ts
```

- Nome com prefixo do projeto, igual ao schema.
- Uma função = uma responsabilidade. Não criar dispatcher genérico.

### 4.2 Boilerplate mínimo

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonError("Não autorizado", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Client que herda o JWT do chamador — RLS aplica
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonError("Sessão inválida", 401);

    // Lógica aqui — preferir client com JWT, escalar pra service role
    // só quando RLS realmente impede (ex: criar usuário, ler auth schema)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`<projeto>-<acao> fatal:`, err);
    return jsonError((err as Error).message || "Erro desconhecido", 500);
  }
});

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

### 4.3 Convenções

- **Nunca confie em IDs vindos do client pra autorização.** Sempre re-fetch via `supabase.auth.getUser()`.
- **Service Role** só pra:
  - Operações administrativas (criar usuário, mexer em `auth.users`)
  - Bypass intencional de RLS pra endpoints públicos (com validação manual)
- **Erros propagados com código + mensagem** (`PostgrestError` tem `.code`, `.message`, `.details`, `.hint` — propague todos):
  ```ts
  if (insertErr) return jsonError(`Falha (${insertErr.code}): ${insertErr.message}`, 500);
  ```
- **Best-effort persistence** pra side-effects não-críticos (logs, métricas) — `try/catch` ao redor, log + continua. Resposta principal não pode quebrar por causa de log.
- **CORS** — pra endpoints internos `*` está OK (auth via JWT). Pra públicos, refletir Origin validado.

### 4.4 Provider dispatcher (LLM)

Quando integramos múltiplos LLMs, o padrão é:

```ts
type Provider = "anthropic" | "openai" | "gemini";

function detectProvider(model: string): Provider | null {
  if (model.startsWith("claude-")) return "anthropic";
  if (model.startsWith("gpt-") || model.startsWith("o1") || model.startsWith("o3") || model.startsWith("o4")) return "openai";
  if (model.startsWith("gemini-")) return "gemini";
  return null;
}

// Adapters retornam shape normalizado
interface ProviderResult {
  reply: string;
  model: string;
  usage: { input_tokens?: number; output_tokens?: number } | null;
}
```

- Roles divergem entre providers (`assistant` vs `model` no Gemini, system separado vs primeira mensagem no OpenAI). Adapter resolve.
- Cada provider tem **sua secret**: `<PROJETO>_ANTHROPIC_API_KEY`, `<PROJETO>_OPENAI_API_KEY`, `<PROJETO>_GEMINI_API_KEY`. Prefixo evita colisão entre projetos no mesmo Supabase.
- Usage **sempre normalizado** pra `{input_tokens, output_tokens}` pra logging e billing interno consistentes.

### 4.5 RAG-lite (knowledge files)

Quando o agente precisa de "conhecimento" de arquivos:

- **Não armazenamos vetor**. Armazenamos um **resumo denso** gerado por LLM (Haiku é a escolha default: rápido + barato).
- Limite: ~400 palavras por resumo via prompt rígido.
- Resumo é injetado no system prompt como bloco `## Conhecimento de referência`.
- Tabela tem `enabled BOOLEAN` pra ligar/desligar sem deletar.
- UI mostra contagem aproximada de tokens (`chars / 4`) por arquivo, e total injetado por chamada.

Trade-off vs RAG completo: perdemos granularidade (cobre tudo, ou nada). Ganhamos simplicidade, custo previsível e zero infra extra. Migrar pra RAG real (pgvector + embeddings + retrieval) é incremental quando virar gargalo.

---

## 5. Padrões de segurança

### 5.1 Variáveis de ambiente

- **`VITE_*`** vai pro bundle, é **público**. Nunca colocar secret aí.
- **Secrets de servidor** (chaves de API, service role) ficam **só no Supabase Edge Functions Secrets** ou env do container.
- Prefixar com nome do projeto: `<PROJETO>_ANTHROPIC_API_KEY`, não `ANTHROPIC_API_KEY` puro (multi-projeto).

### 5.2 Endpoints públicos (embeds, webhooks)

Defesa em camadas:

1. **CSP `frame-ancestors`** no nginx pra páginas embed → browser bloqueia iframes de origens não autorizadas.
2. **Token opaco** (UUID) na URL → necessário pra qualquer chamada à API.
3. **Origin check** na edge function → rejeita XHR de origem não autorizada.
4. **Lista whitelist de domínios em um arquivo único** compartilhado entre client (UX hint) e edge function (enforcement):

```ts
const ALLOWED_DOMAINS = [
  "auditto.com.br",
  "solutta.com",
  "grupopomin.com.br",
];

function isAllowedOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return ALLOWED_DOMAINS.some(d => host === d || host.endsWith("." + d));
  } catch { return false; }
}
```

Nenhuma camada sozinha é suficiente. CSP é browser-enforced (parent iframe), Origin é browser-set (XHR), token é segredo. Juntas cobrem os 3 vetores comuns (iframe de domínio errado, XHR direto, scraping com token vazado).

### 5.3 Logs

- Estruturados em JSON via `console.error` / `console.log` (Supabase coleta).
- **Nunca logar** PII em claro: emails mascarados, sem senhas/tokens, sem documentos.
- Stack trace + contexto sempre que possível (`error.code`, `error.details`, `error.hint`).

---

## 6. Convenções de código

### 6.1 TypeScript

- `strict: true`. Sem `any`. Quando precisar escapar do tipo, use `unknown` + type guard, ou `as` com comentário explicando.
- Tipos derivados do schema vivem em `src/integrations/supabase/types.ts` (gerado por `supabase gen types typescript`).
- Re-exportar tipos do domínio em `src/lib/<projeto>Store.ts`:
  ```ts
  export type ProjetoUser = Tables<"projeto_users">;
  ```

### 6.2 Estrutura de pastas

```
src/
├── components/
│   ├── ProtectedRoute.tsx          # guards (ProtectedRoute, AdminRoute)
│   ├── ThemeProvider.tsx
│   ├── <feature>/                  # componentes específicos de feature
│   ├── layout/                     # AppLayout, AppSidebar
│   └── ui/                         # shadcn/ui (copy-paste)
├── lib/
│   ├── <projeto>Store.ts           # toda lógica de acesso a dados (não classe, só funções)
│   └── <util>.ts                   # utilitários puros e reutilizáveis
├── pages/                          # uma por rota
├── hooks/                          # custom hooks
└── integrations/
    └── supabase/                   # client + types gerados

supabase/
├── migrations/                     # SQL numerado por timestamp
└── functions/                      # uma pasta por edge function
```

### 6.3 Naming

- Componentes: `PascalCase.tsx`
- Hooks: `useXxx.ts`
- Funções de store: `verboEntidade` (`createUser`, `getAgent`, `listAgentKnowledge`)
- Tabelas/funções DB: `<projeto>_<entidade>` em `snake_case`
- Constantes: `SCREAMING_SNAKE_CASE`
- Arquivos: `kebab-case` ou `PascalCase` pra componentes

### 6.4 Componentes

- **Funcionais** apenas, com hooks. Zero classes.
- Estado local com `useState`. Estado de servidor com TanStack Query quando vale a pena (cache compartilhado). Pra tela única, `useState` + fetch direto é OK.
- Side-effects em `useEffect` com deps explícitas. Cleanup obrigatório (`mounted = false` ou `AbortController`).
- Props tipadas inline ou via interface quando 3+ campos.

### 6.5 Discriminated unions pra resultados

Funções de store que podem dar erro:

```ts
export async function doX(): Promise<Result | { error: string }> {
  ...
}
```

**Cuidado**: se `Result` tem uma coluna chamada `error` (ex: linha do banco com `error: string | null`), `"error" in result` dá falso positivo. **Discrimine por chave única do shape "ok"** (ex: `"id" in result`).

Padrão melhor quando há margem:

```ts
Promise<{ ok: true; data: X } | { ok: false; error: string }>
```

### 6.6 Comentários

- **Default: zero comentário.** Nome de variável e função bem escolhido explica.
- Quando comentar: o **porquê** não-óbvio (constraint escondida, workaround, decisão de design). Nunca o **o quê**.
- Sem comentários narrativos ("agora vamos buscar o usuário") — ninguém lê.
- Sem TODO sem ticket associado.

---

## 7. UI / UX

### 7.1 Visual

- Dark/light theme com toggle (`ThemeProvider`).
- Layout: sidebar fixa + topbar (`AppLayout`). Sidebar collapsible em mobile.
- Premium feel: gradientes sutis, sombras suaves, animações em transições (não decorativas).
- Command palette ⌘K em todo projeto onde faz sentido.

### 7.2 Feedback

- **Toast** pra ações: sucesso ("Criado!", "Salvo!"), erro com `variant: destructive`.
- **Loading inline** quando rápido (<2s); skeleton quando lento.
- **Confirm modal** pra ações destrutivas (`useConfirm` hook).
- **Empty states** explicativos: o que fazer pra preencher.

### 7.3 Formulários

- Validação no submit, não no blur (evita ruído).
- Mensagens de erro **acima do botão** ou inline no campo.
- Botões primários à direita, "Cancelar" à esquerda.
- Atalho `Enter` envia onde fizer sentido; `Esc` fecha modais.

### 7.4 Linguagem

- Português BR, voz ativa, tempo presente.
- Direto e técnico. Sem "fico feliz em ajudar", sem "como uma IA".
- Botões com verbos (`Criar`, `Salvar`, `Excluir`).

---

## 8. Deploy

### 8.1 Container

- `Dockerfile` builda a SPA com Vite e serve via nginx.
- `nginx.conf` no projeto controla:
  - Fallback SPA (`try_files $uri $uri/ /index.html`)
  - Caching agressivo de assets com hash, zero cache de `index.html`
  - CSP `frame-ancestors` restrito por rota (embed permite domínios whitelistados; resto é `'self'`)
  - Gzip nos tipos textuais

### 8.2 Pipeline

- `.github/workflows/ci.yml` — lint, test, build, type-check.
- `.github/workflows/reusable-deploy-docker-compose.yml` — workflow reutilizável de deploy via SSH.
- Cada projeto referencia o reusable via `workflow_call`.

### 8.3 Porta por projeto

Cada projeto roda em uma porta dedicada no servidor compartilhado. Mantemos um inventário no README de cada projeto.

### 8.4 Secrets no GitHub

- Variáveis de **organização**: `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_BASE_DIR`, `DEPLOY_SSH_PRIVATE_KEY` (secret).
- Variáveis de **repositório**: `DEPLOY_PROJECT_NAME`, `DEPLOY_APP_PORT`.
- Build secrets (Vite): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

---

## 9. Checklist pra iniciar um projeto novo

Use isto como roteiro inicial. Adapte o domínio, mantenha a espinha.

### 9.1 Repositório e código

- [ ] `npm create vite@latest` com template `react-ts`
- [ ] Instalar Tailwind + configurar `tailwind.config.ts` com tokens do design system
- [ ] Copiar `src/components/ui/*` do shadcn (apenas os componentes que for usar)
- [ ] Configurar `@/` alias em `tsconfig.json` e `vite.config.ts`
- [ ] Habilitar `strict: true` no `tsconfig`
- [ ] `.env.example` com `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- [ ] `.gitignore`: `.env`, `node_modules`, `dist`, `.DS_Store`, `*.local`

### 9.2 Supabase

- [ ] Criar `supabase/migrations/<timestamp>_<projeto>_init.sql`:
  - Enums (`role`, `status`)
  - Função `update_updated_at`
  - Tabela `<projeto>_users` com FK pra `auth.users`
  - RLS + policies (admin full, owner self)
  - Trigger `<projeto>_handle_new_user` em `auth.users` (com `ON CONFLICT (email) DO NOTHING`)
- [ ] Aplicar via **SQL Editor** (não usar `db push` se multi-projeto)
- [ ] Gerar types: `supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts`
- [ ] Configurar `Site URL` + `Redirect URLs` em **Authentication → URL Configuration**

### 9.3 Edge functions iniciais

- [ ] `<projeto>-admin-create-user` — criação/vinculação de perfil
- [ ] Outras conforme domínio
- [ ] Deploy: `supabase functions deploy <nome>`
- [ ] Configurar secrets com prefixo `<PROJETO>_*`

### 9.4 Frontend base

- [ ] `Login.tsx` (email/senha + SSO se for o caso)
- [ ] `ProtectedRoute` e `AdminRoute`
- [ ] `AppLayout` + `AppSidebar`
- [ ] `<projeto>Store.ts` com helpers de auth (`login`, `logout`, `getCurrentUser`, `getCurrentUserStatus`)
- [ ] `seedAdminUser()` pra bootstrap inicial

### 9.5 CI/CD

- [ ] `.github/workflows/ci.yml` (lint + test + build)
- [ ] Referenciar workflow reutilizável de deploy
- [ ] Configurar secrets de repo (`DEPLOY_PROJECT_NAME`, `DEPLOY_APP_PORT`)
- [ ] Adicionar porta do projeto ao inventário no README

### 9.6 Docs

- [ ] README com: visão geral, stack, setup, **como testar (passo a passo)**, banco, edge functions, env vars, estrutura, scripts, CI/CD
- [ ] Apontar pra este `soul/arch.md` na seção de arquitetura: "para padrões de stack e convenções, veja `<repo-base>/soul/arch.md`"

---

## 10. Decisões que NÃO são padrão (anti-patterns que evitamos)

- **ORM no client.** Falamos Postgres direto via supabase-js. ORM em camada extra só adiciona indireção e tipos divergentes.
- **Estado global complexo (Redux, Zustand, Recoil).** TanStack Query cobre estado de servidor; `useState` cobre UI. Quando vier necessidade real, reavaliamos.
- **CSS-in-JS (styled-components, Emotion).** Tailwind tem capacidade dinâmica suficiente e zero runtime.
- **REST custom sobre Postgres.** PostgREST + RLS resolvem 90% do CRUD; o resto vai pra edge function. Não escrevemos rotas CRUD à mão.
- **Vetores/embeddings antes de necessidade comprovada.** Resumo curto é o suficiente até virar gargalo de relevância ou tamanho.
- **`supabase db push`** em banco compartilhado entre projetos — quebra.
- **Soft delete** com `deleted_at`. Quase sempre uma coluna `status` enum resolve melhor e mantém o histórico limpo.

---

## 11. Quando quebrar as regras

Este documento é uma referência, não dogma. Quebre quando:

- A regra cria mais código do que evita.
- O padrão padrão não cabe no requisito real do projeto.
- Você consegue justificar a quebra em uma frase pra outro dev do time.

Se quebrar virar recorrente, é sinal de que o padrão precisa mudar. Atualize este arquivo.
