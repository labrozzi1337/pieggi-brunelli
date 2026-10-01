# Boia de chamados (SAC) — receita pra levar a outro app

Prompt reutilizável pra replicar a "boia" de abertura de chamados (drawer lateral no header,
abas "Novo chamado" / "Meus chamados") em qualquer app do grupo, caindo no **pominsac** central.
A boia já está funcionando no **pominstart** — use este projeto como fonte de cópia verbatim.

Cole o bloco abaixo num agente dentro do projeto de destino e troque o que está marcado com `<...>`.

---

# Tarefa: adicionar a "boia" de chamados (abre ticket no pominsac)

Quero replicar neste projeto a mesma "boia" de abertura de chamados que já existe no
**pominstart**: um botão no header (ícone LifeBuoy) que abre um **drawer lateral** deslizando
da direita, com abas "Novo chamado" / "Meus chamados". Ao enviar, o chamado tem que **cair no
pominsac** (o SAC central).

## Arquitetura (respeite isto)
- O pominsac vive num **projeto Supabase próprio** (`dwbmfcvvlbjejyyodtol`), separado do
  projeto de auth deste app. Por isso NÃO se usa RLS por `auth.uid()`. O módulo fala com
  **RPCs SECURITY DEFINER `pominsac_external_*`** (create/list/comment/cancel/update ticket)
  que validam um **token compartilhado + email** e resolvem/criam o usuário no pominsac por email.
- Existe um **client Supabase dedicado ao projeto pominsac** (anônimo, `persistSession:false`),
  separado do client principal deste app. As RPCs são protegidas por token, não por sessão.
- Upload de anexo/screenshot vai pela edge function `pominsac-attachment-upload`
  (service_role + mesmo token). O backend do pominsac (RPCs + edge + tabelas `pominsac_*`)
  **já existe e está no ar — não crie nada no servidor**, exceto talvez 1 linha de sistema (passo 6).
- O **email é a chave de identidade** no pominsac. `getCurrentUser` do app TEM que devolver email.

## Fonte pra copiar
Copie da minha pasta `../pominstart/`, que já tem a boia funcionando:
- `src/components/sac/` (pasta inteira, 11 arquivos)
- `src/integrations/supabase/pominsacClient.ts`

## Passos

### 1. Dependências
- `@supabase/supabase-js`
- `html-to-image` (usado na captura de tela do anexo — **é fácil esquecer**, o import é dinâmico)
- util `cn` (clsx + twMerge) em `@/lib/utils`; se não existir, crie.

### 2. Copiar o módulo SAC inteiro (sem alterar a lógica)
```
src/components/sac/
  index.ts  types.ts  sacClient.ts  sacUi.ts
  SacProvider.tsx  SacTicketButton.tsx  SacTicketModal.tsx  SacTabButton.tsx
  SacNewTicketForm.tsx  SacTicketList.tsx  SacTicketDetail.tsx
```
> O módulo usa tokens de design do "hub": `hub-gradient`, `hub-btn-primary`, `font-display`,
> `premium-scroll` e cores `border-info / border-success / border-warning / border-hub-indigo`.
> Se este projeto veio do mesmo template (pominstart/pominai), já tem todos — copie verbatim.
> Se NÃO tiver, adapte essas classes ao design do app.

### 3. Client do pominsac
Copie `src/integrations/supabase/pominsacClient.ts` — é genérico. Lê
`VITE_POMINSAC_SUPABASE_URL` / `VITE_POMINSAC_SUPABASE_ANON_KEY` e cria um client com
`persistSession:false, autoRefreshToken:false, storageKey:"pominsac-anon"`.

### 4. Envs (.env + .env.example)
Os 3 valores são os mesmos de todos os apps (pominsac é central):
```
VITE_POMINSAC_SUPABASE_URL=https://dwbmfcvvlbjejyyodtol.supabase.co
VITE_POMINSAC_SUPABASE_ANON_KEY=<anon key do projeto dwbmfcvvlbjejyyodtol — copie do .env do pominstart>
VITE_POMINSAC_ATTACHMENT_TOKEN=<token da edge pominsac-attachment-upload — copie do .env do pominstart>
```
No `.env.example` só deixe placeholders. **Não commite os valores reais** (confira que `.env`
está no `.gitignore`).

### 5. Wiring no layout (1 ponto)
No shell/layout do app, envolva a árvore com `<SacProvider>` e ponha o `<SacTicketButton />`
no header (ou dispare `useSac().open("new")` de um botão que já exista):
```tsx
import { SacProvider, SacTicketButton, type SacConfig } from "@/components/sac";
import { getPominsacClient } from "@/integrations/supabase/pominsacClient";

const sacConfig = useMemo<SacConfig>(() => ({
  supabase: getPominsacClient(),
  systemSlug: "<SLUG-DESTE-APP>",                 // ver passo 6
  attachmentUploadToken: import.meta.env.VITE_POMINSAC_ATTACHMENT_TOKEN,
  getCurrentUser: async () => {
    const u = await <getCurrentUser do auth DESTE app>();
    return u ? { authId: u.id, email: u.email, name: u.name } : null;   // email obrigatório
  },
}), []);

<SacProvider config={sacConfig}>
  {/* ...app... o SacProvider já renderiza o drawer internamente */}
  <SacTicketButton />
</SacProvider>
```
> Faça `getCurrentUser` ler a identidade FRESCA (do store/contexto), não capture o user num
> closure com deps `[]`, senão fica stale.

### 6. Seedar o sistema no pominsac (única coisa no servidor — e talvez nem precise)
O `systemSlug` precisa existir em `pominsac_systems` (projeto `dwbmfcvvlbjejyyodtol`). **Antes de
inserir, cheque se já existe** — vários apps já estão seedados. Se este app for novo, insira 1 linha:
```sql
insert into public.pominsac_systems (slug, name, color, status)
values ('<slug>', '<Nome do App>', 'hub-blue', 'active')
on conflict (slug) do nothing;
```
Sem essa linha o create falha. (Se preferir, agrupe sob um slug já existente.)

### 7. ⚠️ Deploy de produção (o pulo do gato — NÃO esqueça)
O Vite **inlina `import.meta.env.VITE_*` no momento do build**. Se o app é buildado em Docker/CI,
as 3 envs `VITE_POMINSAC_*` PRECISAM ser passadas como **build args** — senão o bundle de prod cai
no client placeholder e a boia abre mas falha no submit (o `createTicket` exige o token).
- No `Dockerfile`: adicione `ARG` + `ENV` das 3 antes do `npm run build`.
- No `docker-compose.yml`: passe as 3 em `build.args`. URL e ANON_KEY podem cair no projeto
  principal se ausentes (é o mesmo projeto): `${VITE_POMINSAC_SUPABASE_URL:-${VITE_SUPABASE_URL}}`.
- O **token** é obrigatório e precisa estar no `.env` do servidor (não tem fallback).

### 8. Verificação
`npm run build` (typecheck) → abrir o app logado → clicar na boia → drawer entra pela direita →
"Novo chamado" com anexo → conferir que aparece em "Meus chamados" e no painel do pominsac.

## Não faça
- Não usar `service_role` no front. Não trocar as RPCs `pominsac_external_*` por acesso direto
  às tabelas. Não persistir sessão no client do pominsac. Não commitar os valores das envs.
