# ADR 0001 — Monorepo Vite, Next.js e Supabase

## Status

Aceito em 2026-10-01.

## Contexto

O projeto precisa iniciar frontend e backend com um único comando, manter regras no servidor e usar o Supabase somente para persistência em schema isolado.

## Decisão

- npm workspaces reúne `apps/frontend` e `apps/backend`.
- `concurrently` inicia Vite e Next.js com `npm run dev` na raiz.
- O navegador conversa somente com a API Next.js.
- O Supabase usa exclusivamente o schema `pieggi`; não criamos objetos de aplicação em `public`.
- A chave privilegiada permanece no ambiente do backend e, neste starter, é usada somente pelo health check controlado, sem input de usuário.
- Não há funções, triggers ou regras de negócio no banco. O backend mantém `updated_at` nas futuras operações de escrita.

## Consequências

O frontend não conhece credenciais do banco. Novos endpoints devem validar input com Zod, aplicar autorização no backend e acessar apenas objetos em `pieggi`. A migration inicial em `start_back` é legado do starter e não deve receber novos objetos.
