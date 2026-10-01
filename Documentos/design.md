# Unified Design System — Grupo

> Documento unificado, padronizado e dividido por empresa, usando a mesma estrutura. APENAS USE O DESIGN SYSTEM DA EMPRESA QUE FOI PEDIDO`.
>
> Empresas cobertas:
> - Grupo Pomin Hub
> - Auditto / Fiscal Luminary
> - Solutta
> - Alerta Fiscal

---

## 1) Grupo Pomin Hub

> Copia integral do design system ja pronto.

# Design System — Grupo Pomin Hub

> Documento unico, padronizado, dividido em duas partes:
> **A · Sistema (SaaS / Painel)** — referencia fiel da aplicacao atual.
> **B · Landing Page** — adaptacao para paginas de marketing, com a estetica imersiva escura usada hoje em superficies de destaque.
>
> Convencao: cores SEMPRE em `hsl(var(--token))`. Nada de cor hardcoded em componentes (exceto excecoes explicitas marcadas em **Parte B**).

---

## 1. Principios

1. **Corporativo e calmo**: azul profundo + acentos teal/ciano. Nada de roxo, nada de neon.
2. **Tipografia unica**: `Oxanium` (300-700) em todo lugar — body, headings, inputs, botoes. Peso `normal` para titulos grandes (ar editorial); `bold` so para reforco pontual.
3. **Tokens semanticos**: `--background`, `--foreground`, `--primary`, `--muted`, etc. Componentes nunca conhecem cores cruas.
4. **Dark-first**: a aplicacao inicia em dark e persiste em `localStorage` (`hub-theme`). Light e primeira-classe, nao fallback.
5. **Superficies translucidas**: cards usam tint sutil (3% de branco no dark, 3% de preto no light) com borda 8% — leve, "de vidro", sem sombrear demais.
6. **Hover sutil**: elevacoes de -0.5px a -2px, transicoes 200-300ms. Sem bounces.

---

## 2. Tokens — Light + Dark

Todos os valores em **HSL** (formato Tailwind/shadcn). `--radius: 0.875rem` e o raio base.

### 2.1 Base, brand, estados

| Token                     | Light                  | Dark                   | Uso                                      |
| ------------------------- | ---------------------- | ---------------------- | ---------------------------------------- |
| `--background`            | `205 40% 98%`          | `207 50% 5%`           | Fundo da aplicacao                       |
| `--foreground`            | `215 25% 14%`          | `210 17% 92%`          | Texto principal                          |
| `--card`                  | `0 0% 100%`            | `207 38% 9%`           | Superficie de card padrao                |
| `--card-foreground`       | `215 25% 14%`          | `210 17% 92%`          | Texto sobre card                         |
| `--popover`               | `0 0% 100%`            | `207 38% 9%`           | Popovers / dropdowns                     |
| `--popover-foreground`    | `215 25% 14%`          | `210 17% 92%`          | Texto em popover                         |
| `--primary`               | `209 84% 36%` (#0f5fa8)| `197 71% 70%` (#7ecce4)| Cor de marca                             |
| `--primary-foreground`    | `0 0% 100%`            | `207 60% 8%`           | Texto sobre primary                      |
| `--primary-glow`          | `197 71% 70%`          | `197 71% 70%`          | Acento luminoso / gradients              |
| `--secondary`             | `210 40% 96%`          | `207 28% 14%`          | Superficies secundarias (search trigger) |
| `--secondary-foreground`  | `215 25% 18%`          | `210 17% 92%`          | Texto sobre secondary                    |
| `--muted`                 | `210 30% 96%`          | `207 26% 13%`          | Areas mudas                              |
| `--muted-foreground`      | `215 14% 45%`          | `210 10% 62%`          | Texto auxiliar / meta                    |
| `--accent`                | `207 80% 94%`          | `197 50% 18%`          | Hover suave / icon-tile                  |
| `--accent-foreground`     | `209 84% 30%`          | `197 71% 75%`          | Texto sobre accent                       |
| `--destructive`           | `0 75% 55%`            | `0 62% 50%`            | Acoes destrutivas                        |
| `--destructive-foreground`| `0 0% 100%`            | `0 0% 100%`            | Texto sobre destructive                  |
| `--border`                | `210 25% 90%`          | `207 22% 17%`          | Bordas de UI                             |
| `--input`                 | `210 25% 90%`          | `207 22% 17%`          | Bordas de input                          |
| `--ring`                  | `209 84% 36%`          | `197 71% 70%`          | Anel de foco                             |

### 2.2 Sidebar

| Token                        | Light             | Dark              |
| ---------------------------- | ----------------- | ----------------- |
| `--sidebar-background`       | `0 0% 100%`       | `207 50% 4%`      |
| `--sidebar-foreground`       | `215 14% 35%`     | `210 10% 65%`     |
| `--sidebar-primary`          | `209 84% 36%`     | `197 71% 70%`     |
| `--sidebar-primary-foreground` | `0 0% 100%`     | `207 60% 8%`      |
| `--sidebar-accent`           | `207 80% 94%`     | `197 50% 18%`     |
| `--sidebar-accent-foreground`| `209 84% 30%`     | `197 71% 75%`     |
| `--sidebar-border`           | `210 25% 92%`     | `207 22% 14%`     |
| `--sidebar-ring`             | `209 84% 36%`     | `197 71% 70%`     |

### 2.3 Paleta Hub (acentos categoricos)

| Token              | Light             | Dark              | Uso                          |
| ------------------ | ----------------- | ----------------- | ---------------------------- |
| `--hub-blue`       | `209 84% 36%`     | `197 71% 70%`     | Categoria padrao / brand     |
| `--hub-blue-soft`  | `197 71% 70%`     | `197 71% 70%`     | Variante luminosa            |
| `--hub-amber`      | `38 92% 50%`      | `38 92% 50%`      | Estrategico                  |
| `--hub-emerald`    | `160 70% 38%`     | `160 70% 38%`     | Operacional / sucesso        |
| `--hub-indigo`     | `215 60% 50%`     | `215 60% 50%`     | Reservado                    |
| `--hub-rose`       | `346 70% 55%`     | `346 70% 55%`     | Alertas suaves               |

---

## 3. Tipografia

- Familia unica: **Oxanium**, importada do Google Fonts (300, 400, 500, 600, 700). Aplicada em `*`, `body`, `h1-h6`, `button`, `input`, `select`, `textarea` via `!important`.
- Tracking padrao: `0`. Em uppercase decorativo (badges/divisores), `tracking-wider` ou `tracking-[0.2em]`.

---

## 4. Espacamento, raios e sombras

- **Raio base**: `--radius: 0.875rem`.
- **Cards**: `rounded-[14px]`.
- **Itens de sidebar**: `rounded-[5px]`.
- **Pills / badges**: `rounded-full`.
- **Sombras** por token.

---

## 5. Gradientes e backgrounds

```css
--app-bg (dark):
  radial-gradient(circle at 95% 95%, hsl(197 50% 30% / 0.10), transparent 45%),
  linear-gradient(180deg, hsl(207 50% 4%) 0%, hsl(207 45% 6%) 55%, hsl(207 50% 5%) 100%);

--surface-gradient (dark):
  radial-gradient(circle at 87% 16%, hsl(197 50% 25% / 0.30), transparent 38%),
  linear-gradient(145deg, hsl(207 38% 8% / 0.98), hsl(207 35% 12% / 0.94));
```

---

# PARTE A — Sistema (SaaS / Painel)

## 6.1 Layout (shell)

- Sidebar fixa desktop + sheet no mobile.
- Header sticky `h-16`.
- Conteudo com shift de margem no collapse.

## 6.2 Sidebar

- Estado ativo com **gradient + border mask**.
- Estado inativo com hover discreto.
- Versao colapsada com icones centralizados.

## 6.3 Header

- Busca, toggles, notificacao, avatar e menu.

## 6.4 Cards

- Card translucido padrao (`hub-card`) e variacoes.

## 6.5 Botoes, inputs, badges

- Botao primario gradient.
- Input com ring por token.
- Badge arredondado e uppercase.

## 6.6 Estados

- Hover, Focus, Active, Disabled e Loading com regras claras.

## 6.7 Animacoes

- `fade-in` simples.
- Stagger por indice.

---

# PARTE B — Landing Page

## 7.1 Hero / fundo imersivo

- Fundo escuro full-bleed com gradiente diagonal.

## 7.2 Card central

- Glass leve + borda sutil.

## 7.3 Cabecalho do card
## 7.4 Texto de apoio
## 7.5 CTA primario invertido
## 7.6 Divisor com label
## 7.7 Lista de features
## 7.8 Footer minimalista
## 7.9 Tipografia editorial
## 7.10 Microinteracoes
## 7.11 Variacoes de composicao

---

## 8. Diretrizes (do / don't)

✅ **Faca**
- Usar tokens semanticos.
- Manter Oxanium.

❌ **Evite**
- Cores hardcoded no sistema.
- Hovers exagerados.

---

## Anexo · Trecho `index.css` essencial

```css
:root {
  --background: 205 40% 98%;
  --foreground: 215 25% 14%;
  --primary: 209 84% 36%;
}
.dark {
  --background: 207 50% 5%;
  --foreground: 210 17% 92%;
  --primary: 197 71% 70%;
}
```

---

## 2) Auditto

## 1. Identidade visual

- **Personalidade:** editorial, sóbrio, premium fintech. Violeta como cor de marca, teal como suporte, fundos claros e sombras tingidas.
- **Modo claro** é o padrão (canvas cinza-azulado claro, tipografia violeta-escura).
- **Modo escuro** disponível via classe `.dark` (canvas violeta profundo).

---

## 2. Tipografia

| Uso | Família | Pesos | Notas |
|---|---|---|---|
| Headings / display | `Plus Jakarta Sans` | 500 / 600 / 700 / 800 | `letter-spacing: -0.02em` |
| Body / UI | `Manrope` | 400 / 500 / 600 / 700 | `font-feature-settings: 'cv11','ss01'` |

Fontes carregadas via Google Fonts. Classe utilitária: `.font-display`.

### Escala tipográfica (Tailwind)

| Token | Tamanho | Line-height | Tracking | Peso |
|---|---|---|---|---|
| `text-display-lg` | 3.5rem | 1.05 | -0.03em | 700 |
| `text-display-md` | 2.5rem | 1.10 | -0.02em | 700 |
| `text-headline-lg` | 2rem | 1.15 | -0.02em | 700 |
| `text-headline-md` | 1.5rem | 1.20 | -0.01em | 700 |
| `text-title-lg` | 1.375rem | 1.30 | — | 600 |
| `text-title-md` | 1.125rem | 1.35 | — | 600 |
| `text-body-lg` | 1rem | 1.55 | — | 400 |
| `text-body-md` | 0.875rem | 1.55 | — | 400 |
| `.label-sm` | 0.6875rem | 1.20 | 0.06em | 700, UPPERCASE, `muted-foreground` |

`.label-sm` é a **assinatura** das KPI cards e seções (microcaps maiúsculas).

---

## 3. Paleta de cores (tokens HSL)

Todos os tokens são definidos como triplas HSL sem `hsl()` — para serem consumidos via `hsl(var(--token))` ou `hsl(var(--token) / <alpha>)`.

### 3.1 Modo claro (`:root`)

#### Surfaces / Canvas
| Token | HSL | Hex aprox. | Uso |
|---|---|---|---|
| `--background` | `220 14% 97%` | `#F5F6F8` | Canvas global |
| `--foreground` | `258 67% 9%` | `#100828` | Texto principal |
| `--surface-bright` | `0 0% 100%` | `#FFFFFF` | Superfície elevada |
| `--surface-dim` | `220 13% 93%` | `#E9EBEF` | Superfície mais escura |
| `--surface-container-lowest` | `0 0% 100%` | `#FFFFFF` | Cards principais |
| `--surface-container-low` | `220 14% 96%` | `#F2F4F7` | Empty states, áreas inertes |
| `--surface-container` | `220 13% 94%` | `#EBEDF1` | Listas, linhas alternadas |
| `--surface-container-high` | `220 13% 92%` | `#E5E8ED` | Hover de surface |
| `--surface-container-highest` | `220 13% 90%` | `#DFE2E8` | Active de surface |
| `--inverse-surface` | `258 67% 9%` | `#100828` | Banners escuros |
| `--on-inverse-surface` | `282 100% 98%` | `#FBF4FF` | Texto sobre inverse |

#### Brand — Primary (Violet)
| Token | HSL | Hex | Uso |
|---|---|---|---|
| `--primary` | `261 82% 54%` | `#662CEA` | CTA, links, foco |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | Texto sobre primary |
| `--primary-dim` | `261 89% 47%` | `#5A13DE` | Primary pressed/active |
| `--primary-container` | `273 80% 65%` | `#A769EE` | Final do gradiente |
| `--primary-fixed-dim` | `261 50% 60%` | `#7E63C7` | Primary mais sutil |
| `--on-primary-container` | `0 0% 100%` | `#FFFFFF` | Texto sobre container |

#### Secondary (neutros violeta-tonais)
| Token | HSL | Uso |
|---|---|---|
| `--secondary` | `220 13% 92%` | Botões secundários |
| `--secondary-foreground` | `261 82% 30%` | Texto sobre secondary |
| `--secondary-container` | `220 14% 92%` | Chips, ícones bg |
| `--on-secondary-container` | `261 82% 25%` | Ícones sobre container |

#### Tertiary (Teal)
| Token | HSL | Hex | Uso |
|---|---|---|---|
| `--tertiary` | `192 100% 24%` | `#00647B` | Métricas alternativas, KPI |
| `--tertiary-foreground` | `0 0% 100%` | `#FFFFFF` | Texto sobre tertiary |
| `--tertiary-container` | `192 60% 88%` | `#C5E8EF` | Chips informativos |

#### Neutros / Muted / Accent
| Token | HSL | Uso |
|---|---|---|
| `--muted` | `220 13% 94%` | Backgrounds suaves |
| `--muted-foreground` | `220 9% 40%` | Texto auxiliar / hint |
| `--accent` | `220 14% 93%` | Hover de menu / item |
| `--accent-foreground` | `261 82% 30%` | Texto em accent |

#### Estado (semântico)
| Token | HSL | Hex | Uso |
|---|---|---|---|
| `--success` | `152 60% 36%` | `#249463` | Confirmação |
| `--warning` | `35 92% 50%` | `#F39A0A` | Atenção |
| `--error` / `--destructive` | `343 80% 39%` | `#B41340` | Erro / destrutivo |
| `--destructive-foreground` | `0 0% 100%` | `#FFFFFF` | Texto sobre destructive |

#### Bordas / Outline / Foco
| Token | HSL | Uso |
|---|---|---|
| `--border` | `220 13% 88%` | Borda padrão |
| `--input` | `220 14% 94%` | Background de input |
| `--ring` | `261 82% 54%` | Anel de foco (= primary) |
| `--outline` | `220 9% 65%` | Linha forte |
| `--outline-variant` | `220 13% 82%` | Linha sutil (`ghost-border`) |

#### Card / Popover
| Token | HSL | Uso |
|---|---|---|
| `--card` | `0 0% 100%` | Background do card |
| `--card-foreground` | `258 67% 9%` | Texto do card |
| `--popover` | `0 0% 100%` | Popover |
| `--popover-foreground` | `258 67% 9%` | Texto popover |

#### Sidebar
| Token | HSL |
|---|---|
| `--sidebar-background` | `0 0% 100%` |
| `--sidebar-foreground` | `258 67% 9%` |
| `--sidebar-primary` | `261 82% 54%` |
| `--sidebar-primary-foreground` | `0 0% 100%` |
| `--sidebar-accent` | `220 14% 94%` |
| `--sidebar-accent-foreground` | `261 82% 30%` |
| `--sidebar-border` | `220 13% 90%` |
| `--sidebar-ring` | `261 82% 54%` |

### 3.2 Modo escuro (`.dark`)

Sobrescreve apenas o necessário:

| Token | HSL |
|---|---|
| `--background` | `258 67% 7%` |
| `--foreground` | `282 100% 98%` |
| `--card` | `258 50% 11%` |
| `--popover` | `258 50% 11%` |
| `--primary` | `273 80% 70%` |
| `--primary-foreground` | `258 67% 9%` |
| `--muted` | `258 30% 15%` |
| `--muted-foreground` | `282 30% 70%` |
| `--border` | `258 30% 20%` |
| `--input` | `258 30% 18%` |
| `--ring` | `273 80% 70%` |
| `--sidebar-background` | `258 67% 9%` |
| `--sidebar-accent` | `258 50% 15%` |
| `--sidebar-border` | `258 30% 18%` |

---

## 4. Gradientes

| Token | Definição | Uso |
|---|---|---|
| `--gradient-primary` | `linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-container)) 100%)` | CTAs, ícones de marca |
| `--gradient-hero` | `linear-gradient(135deg, hsl(258 67% 9%) 0%, hsl(261 82% 25%) 60%, hsl(261 82% 54%) 100%)` | Heros, banners |
| `--gradient-surface` | `linear-gradient(180deg, hsl(var(--surface-container-low)) 0%, hsl(var(--background)) 100%)` | Fundo sutil de seções |

Classes utilitárias: `.bg-gradient-primary`, `.bg-gradient-hero`, `.bg-gradient-surface`.

---

## 5. Sombras (ambient, tingidas em violeta)

| Token | Valor | Uso |
|---|---|---|
| `--shadow-card` | `0 8px 24px hsl(258 67% 9% / 0.04)` | Card em repouso |
| `--shadow-ambient` | `0 20px 40px hsl(258 67% 9% / 0.06)` | Hover / elevação média |
| `--shadow-ambient-lg` | `0 30px 60px hsl(258 67% 9% / 0.10)` | Modais, drawers, overlays |

Classes: `.shadow-card`, `.shadow-ambient`, `.shadow-ambient-lg`.

---

## 6. Border Radius

| Token Tailwind | Valor | Uso |
|---|---|---|
| `rounded-sm` | `calc(var(--radius) - 4px)` ≈ 0.5rem | Mini-chips |
| `rounded-md` | `calc(var(--radius) - 2px)` ≈ 0.625rem | Inputs, botões padrão |
| `rounded-lg` | `var(--radius)` = **0.75rem** | Padrão geral |
| `rounded-xl` | `var(--radius-xl)` = 1.5rem | Cards de destaque |
| `rounded-2xl` | **2rem** | **Cards principais (KPI, empty state)** |
| `rounded-pill` | 9999px | Botões pill, badges, status |

Regra prática: **cards principais usam `rounded-2xl`**, badges/pills usam `rounded-pill`, inputs usam `rounded-md`.

---

## 7. Espaçamento, container e breakpoints

- Container Tailwind: centralizado, padding `1.5rem`, breakpoint `2xl: 1440px`.
- Padding interno padrão de cards: `p-7` (1.75rem) para KPI, `p-12` para empty states.
- Gaps padronizados: `gap-2`, `gap-3` em ações; `gap-4`/`gap-6` em grids.

---

## 8. Motion / Transições

| Token | Valor |
|---|---|
| `--transition-base` | `all 200ms cubic-bezier(0.4, 0, 0.2, 1)` |

### Keyframes / animações registradas

| Classe | Descrição |
|---|---|
| `animate-fade-in` | `opacity 0→1 + translateY(8px→0)`, 0.4s ease-out |
| `animate-accordion-down` / `animate-accordion-up` | Accordion Radix |
| `animate-shimmer` | Skeletons (`background-position` -200% → 200%, 2s infinite linear) |

**Hover/lift padrão de cards:** `hover:-translate-y-0.5 hover:shadow-ambient` com `transition-all`.

---

## 9. Utilitários proprietários

| Classe | Efeito |
|---|---|
| `.ghost-border` | `outline: 1px solid hsl(var(--outline-variant) / 0.15); outline-offset: -1px;` — usada em **todos os cards** para uma borda fantasma |
| `.glass` | `background: hsl(var(--surface-bright)/0.7); backdrop-filter: blur(12px);` |
| `.scrollbar-hide` | Esconde scrollbar mantendo scroll |
| `.label-sm` | Microcaps em uppercase (ver tipografia) |
| `.font-display` | Aplica `Plus Jakarta Sans` |

---

## 10. Componentes — padrões

### 10.1 Botão (`<Button>`)

Base:
```
inline-flex items-center justify-center gap-2 whitespace-nowrap
rounded-md text-sm font-medium ring-offset-background
transition-colors
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
disabled:pointer-events-none disabled:opacity-50
```

| Variant | Repouso | Hover | Active/Pressed | Foco |
|---|---|---|---|---|
| `default` | `bg-primary text-primary-foreground` | `bg-primary/90` | `bg-primary-dim` | ring `--ring` |
| **`primary`** | `bg-gradient-primary text-primary-foreground shadow-card` | `shadow-ambient` + `-translate-y-0.5` | `translate-y-0` + `shadow-card` | ring `--ring` |
| `outline` | `bg-transparent text-primary border border-primary/20` | `bg-primary/5` + `border-primary/40` | `bg-primary/10` | ring `--ring` |
| `secondary` | `bg-secondary text-secondary-foreground` | `bg-secondary/80` | `bg-secondary/70` | ring `--ring` |
| `ghost` | transparente | `bg-accent text-accent-foreground` | `bg-accent/80` | ring `--ring` |
| `link` | `text-primary` | `underline` | `text-primary-dim` | ring `--ring` |
| `destructive` | `bg-destructive text-destructive-foreground` | `bg-destructive/90` | `bg-destructive/80` | ring `--ring` |
| `tertiary` | `text-primary, p-0, h-auto` | `text-primary-dim underline` | `text-primary-dim` | ring `--ring` |

Tamanhos:

| Size | Classes |
|---|---|
| `default` | `h-10 px-5 py-2` |
| `sm` | `h-9 rounded-pill px-4` |
| `lg` | `h-12 rounded-pill px-8 text-base` |
| `pill` | `h-11 rounded-pill px-6` |
| `icon` | `h-10 w-10` |

Disabled: `pointer-events-none opacity-50`.

### 10.2 Card

Padrão visual da aplicação (não o `<Card>` shadcn cru):

```tsx
<div class="rounded-2xl bg-surface-lowest p-7 ghost-border shadow-card
            transition-all hover:shadow-ambient hover:-translate-y-0.5">
  ...
</div>
```

- **Background:** `bg-surface-lowest` (branco) ou `bg-card`.
- **Border:** sempre `.ghost-border` (linha sutil 15% outline-variant).
- **Sombra:** `shadow-card` em repouso → `shadow-ambient` em hover.
- **Hover:** elevação com `-translate-y-0.5`.
- **Radius:** `rounded-2xl` (2rem).

Variante `Card` shadcn (genérica): `rounded-lg border bg-card text-card-foreground shadow-sm`.

### 10.3 KPI Card

```tsx
<div class="rounded-2xl bg-surface-lowest p-7 ghost-border shadow-card
            transition-all hover:shadow-ambient hover:-translate-y-0.5">
  <div class="flex items-start justify-between mb-5">
    <p class="label-sm">{label}</p>
    <div class="grid h-9 w-9 place-items-center rounded-pill
                bg-secondary-container text-primary">{icon}</div>
  </div>
  <p class="font-display text-3xl sm:text-4xl font-bold tracking-tight text-primary">
    {value}
  </p>
  <p class="mt-2 text-xs text-muted-foreground">{hint}</p>
</div>
```

Tons: `primary` (violeta), `tertiary` (teal), `success`, `warning`, `neutral`.

### 10.4 Input

```
h-10 w-full rounded-md border border-input bg-background px-3 py-2
text-base md:text-sm
placeholder:text-muted-foreground
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
disabled:cursor-not-allowed disabled:opacity-50
```

- **Repouso:** `border-input`, `bg-background`.
- **Foco:** anel `--ring` (violeta) com offset.
- **Erro:** trocar `border-input` por `border-destructive` e adicionar mensagem em `text-destructive text-xs`.
- **Disabled:** `opacity-50 cursor-not-allowed`.

### 10.5 Badges / Status

Badge genérico:
```
inline-flex items-center rounded-full border px-2.5 py-0.5
text-xs font-semibold transition-colors
```

`StatusBadge` (pill com bolinha):
```
inline-flex items-center gap-1.5 rounded-pill border
px-3 py-1 text-xs font-semibold
```

| Estado | Classes |
|---|---|
| `com_oportunidade` | `bg-success/10 text-success border-success/20` |
| `sem_oportunidade` | `bg-destructive/10 text-destructive border-destructive/20` |
| `inconclusivo` | `bg-warning/10 text-warning border-warning/20` |
| `erro_calculo` | `bg-destructive/10 text-destructive border-destructive/20` |
| `processado` | `bg-primary/10 text-primary border-primary/20` |
| fallback | `bg-muted text-muted-foreground border-outline-variant/30` |

Padrão: cor de texto = cor semântica; fundo = mesma cor com `/10`; borda com `/20`.

### 10.6 Dialog / Modal

- Overlay: `fixed inset-0 bg-black/80` com fade.
- Container: `max-w-lg p-6 border bg-background shadow-lg sm:rounded-lg` centralizado, animações de zoom + slide.
- Botão close: ícone X canto superior direito, `opacity-70 hover:opacity-100`.

### 10.7 Empty State

```
rounded-2xl bg-surface-container-low p-12 text-center ghost-border
```

Ícone em círculo: `h-14 w-14 rounded-pill bg-secondary-container text-primary`.

### 10.8 Page Header

- `eyebrow` em `.label-sm` (microcaps violeta-mute).
- `title` em `font-display text-2xl→4xl font-bold tracking-tight`.
- `description` em `text-muted-foreground text-sm sm:text-base`.
- Ações alinhadas à direita em `flex flex-wrap gap-2 sm:gap-3`.

---

## 11. Estados de interação (regras gerais)

| Estado | Regra |
|---|---|
| **Hover** em CTA primário | aumenta sombra (`shadow-card → shadow-ambient`) + lift `-translate-y-0.5` |
| **Hover** em links/botões secundários | troca de fundo para `accent` ou aplica `underline` |
| **Active / pressed** | retorna `translate-y-0` e usa `--primary-dim` ou tonalidade `/80` |
| **Foco visível** | sempre `ring-2 ring-ring ring-offset-2` (violeta) — nunca remover `:focus-visible` |
| **Disabled** | `opacity-50 pointer-events-none cursor-not-allowed` |
| **Loading** | usar `animate-shimmer` ou `Skeleton` com `bg-muted` |
| **Selected** (item de lista) | `bg-secondary-container text-on-secondary-container` |
| **Error inline** | borda `border-destructive`, ícone + texto `text-destructive text-xs` |

---

## 12. Acessibilidade

- Contraste mínimo AA: foreground `258 67% 9%` sobre background `220 14% 97%` ≈ 16:1.
- **Sempre** manter `focus-visible:ring-2 ring-ring ring-offset-2`.
- Ícones decorativos: `aria-hidden="true"`; ícones interativos: `aria-label`.
- Tamanho mínimo de toque: `h-10` (40px) ou `h-11` em mobile.

---

## 13. Receitas rápidas (copia e cola)

### Card padrão
```tsx
<div className="rounded-2xl bg-surface-lowest p-7 ghost-border shadow-card
                transition-all hover:shadow-ambient hover:-translate-y-0.5">
  ...
</div>
```

### Botão CTA primário
```tsx
<Button variant="primary" size="pill">Ação principal</Button>
```

### Microcaps de seção
```tsx
<p className="label-sm">Visão geral</p>
```

### Heading display
```tsx
<h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tight">
  Título
</h1>
```

### Background com gradiente de marca
```tsx
<section className="bg-gradient-hero text-on-inverse-surface">...</section>
```

---

## 14. Regras invioláveis

1. **Nunca** use cores hex/RGB diretamente em componentes — só tokens (`bg-primary`, `text-foreground`, etc.).
2. Todas as cores em **HSL**, sem `hsl()` no token (somente as três componentes).
3. Cards principais: **`rounded-2xl` + `ghost-border` + `shadow-card`** + lift no hover.
4. Botão de marca: **gradiente** (`--gradient-primary`) + sombra ambient no hover.
5. Tipografia: títulos em **Plus Jakarta Sans** com `tracking -0.02em`; corpo em **Manrope**.
6. Anel de foco: sempre `ring-ring` (violeta) — não substituir por outline custom.
7. Estados semânticos (success/warning/destructive) sempre com padrão `cor / cor /10 fundo / cor /20 borda`.


## 3) Solutta

> Estrutura igual ao padrao do Grupo Pomin, preenchida com as especificacoes de marca e referencias informadas.
>
> Referencias:
> - [https://solutta.com/](https://solutta.com/)
> - [https://lps.solutta.com/reforma-experience/](https://lps.solutta.com/reforma-experience/)
> - [https://lps.solutta.com/solutta-experience-confirmacao-final/](https://lps.solutta.com/solutta-experience-confirmacao-final/)
> - [https://lps.solutta.com/solutta-conheca-a-solutta/](https://lps.solutta.com/solutta-conheca-a-solutta/)

# Design System — Solutta

> Documento unico, padronizado, dividido em:
> **A · Sistema (SaaS / Painel)** e **B · Landing Page**.

---

## 1. Principios

1. **Institucional e tecnologico**: azul forte com reforco ciano.
2. **Tipografia unica**: `Oxanium` em toda a interface.
3. **Conversao orientada**: CTA com alto contraste e mensagem objetiva.
4. **Tokens semanticos**: evitar cores hardcoded em componentes.
5. **Bordas controladas**: espessuras entre `0px` e `5px` conforme guia da marca.
6. **Layout limpo**: muito respiro visual e blocos claros.

---

## 2. Tokens — Light + Dark

Todos os valores abaixo em HSL para implementacao via `hsl(var(--token))`.

### 2.1 Base, brand, estados

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--background` | `220 33% 98%` | `240 82% 17%` | Fundo global |
| `--foreground` | `240 82% 17%` | `210 40% 98%` | Texto principal |
| `--card` | `0 0% 100%` | `240 60% 22%` | Superficie de card |
| `--card-foreground` | `240 82% 17%` | `210 40% 98%` | Texto em card |
| `--primary` | `224 100% 50%` | `224 100% 58%` | Acao principal |
| `--primary-foreground` | `0 0% 100%` | `0 0% 100%` | Texto sobre primary |
| `--secondary` | `187 100% 53%` | `187 100% 53%` | Acento e apoio |
| `--secondary-foreground` | `240 82% 17%` | `240 82% 17%` | Texto sobre secondary |
| `--muted` | `240 20% 96%` | `240 34% 26%` | Area auxiliar |
| `--muted-foreground` | `230 16% 44%` | `220 18% 72%` | Texto auxiliar |
| `--border` | `230 24% 88%` | `240 30% 32%` | Borda |
| `--ring` | `224 100% 50%` | `187 100% 53%` | Focus ring |

### 2.2 Sidebar

| Token | Light | Dark |
|---|---|---|
| `--sidebar-background` | `0 0% 100%` | `240 70% 14%` |
| `--sidebar-foreground` | `240 40% 22%` | `210 30% 88%` |
| `--sidebar-primary` | `224 100% 50%` | `187 100% 53%` |
| `--sidebar-border` | `230 24% 90%` | `240 35% 26%` |

### 2.3 Paleta de apoio Solutta

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--sol-blue` | `224 100% 50%` | `224 100% 58%` | Marca principal |
| `--sol-cyan` | `187 100% 53%` | `187 100% 53%` | Glow / destaque |
| `--sol-deep` | `240 82% 17%` | `240 82% 17%` | Fundo institucional |
| `--sol-surface` | `240 33% 97%` | `240 46% 21%` | Blocos internos |

---

## 3. Tipografia

- Familia unica: **Oxanium** (300, 400, 500, 600, 700).
- Headings com pesos `500-700`.
- Corpo e UI com `400-500`.

| Papel | Classe recomendada | Peso |
|---|---|---|
| H1 Hero | `text-4xl sm:text-5xl leading-tight` | 600 |
| H2 Secao | `text-2xl sm:text-3xl` | 600 |
| Body | `text-base sm:text-lg` | 400 |
| Label UI | `text-sm uppercase tracking-wide` | 500 |

---

## 4. Espacamento, raios e sombras

- **Raio base**: `5px`.
- **Cards**: `5px`.
- **Inputs**: `4px`.
- **Botoes**: `5px`.
- **Borda**: `1px` (ou `0` para ghost button).
- **Borda forte**: `2px` (somente blocos premium).

Sombras:

```css
--surface-shadow: 0 10px 30px rgba(0,66,255,.18);
--surface-shadow-strong: 0 18px 40px rgba(15,224,255,.25);
```

---

## 5. Gradientes e backgrounds

```css
--hero-gradient:
  linear-gradient(135deg, #080850 0%, #0027A8 55%, #0FE0FF 100%);

--primary-gradient:
  linear-gradient(135deg, #0042FF 0%, #0FE0FF 100%);

--surface-gradient:
  linear-gradient(180deg, #FFFFFF 0%, #F4F4F8 100%);
```

---

# PARTE A — Sistema (SaaS / Painel)

## 6.1 Layout (shell)

- Sidebar fixa no desktop, drawer no mobile.
- Header sticky com busca e CTA contextual.
- Main com grid limpo, cards claros e boa separacao visual.

## 6.2 Sidebar

- Item ativo em `primary-gradient` com texto branco.
- Item inativo com hover em `--muted`.
- Collapsed com icones centralizados.

## 6.3 Header

- Busca com fundo claro.
- CTA principal no canto direito.
- Avatar/notificacao opcionais conforme produto.

## 6.4 Cards

- Fundo branco (`--card`), borda `--border`, raio 5px.
- Titulo forte, descricao curta e acao secundaria.

## 6.5 Botoes, inputs, badges

- **Primario**: `--primary-gradient`, texto branco.
- **Secundario**: fundo branco, borda primary.
- **Input**: fundo branco, borda clara, focus ring azul.
- **Badge**: pills pequenas com tom por status.

## 6.6 Estados

| Estado | Regra |
|---|---|
| Hover | `translateY(-2px)` + sombra suave |
| Focus | `ring-2 ring-ring` |
| Active | tom mais escuro de `--primary` |
| Disabled | `opacity-50 cursor-not-allowed` |
| Loading | skeleton neutro com pulse |

## 6.7 Animacoes

```css
@keyframes fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

# PARTE B — Landing Page

## 7.1 Hero / fundo imersivo

- Fullscreen com `--hero-gradient`.
- Texto institucional e conversao acima da dobra.

## 7.2 Card central

- Fundo branco/vidro leve conforme secao.
- Borda discreta e CTA dominante.

## 7.3 Cabecalho do card
- Titulo forte + subtitulo direto.

## 7.4 Texto de apoio
- Frases curtas e objetivas.

## 7.5 CTA primario
- Botao gradiente azul-ciano com alto destaque.

## 7.6 Divisor com label
- Separacao de prova social / beneficios.

## 7.7 Lista de features
- Icone + beneficio + prova curta.

## 7.8 Footer minimalista
- Simples, com links essenciais.

## 7.9 Tipografia editorial
- Oxanium em todo fluxo.

## 7.10 Microinteracoes
- Hover sutil em cards e botoes.

## 7.11 Variacoes de composicao
- Hero solo, hero + cards, secao de prova, CTA final.

---

## 8. Diretrizes (do / don't)

✅ **Faca**
- Priorize azul como protagonista.
- Use ciano para acentos e estados de destaque.
- Mantenha bordas no intervalo 0-5px.

❌ **Evite**
- Exagerar brilho neon.
- Usar mais de 2-3 cores dominantes.
- Poluir layout com muitos elementos visuais.

---

## Anexo · Trecho `index.css` essencial

```css
:root {
  --background: 220 33% 98%;
  --foreground: 240 82% 17%;
  --primary: 224 100% 50%;
  --secondary: 187 100% 53%;
  --radius: 5px;
}
.dark {
  --background: 240 82% 17%;
  --foreground: 210 40% 98%;
  --primary: 224 100% 58%;
}
```

---

## 4) Alerta Fiscal

> Estrutura igual ao padrao do Grupo Pomin, preenchida com as especificacoes da marca.
>
> Referencia:
> - [https://lps.alertafiscal.com.br/#contato](https://lps.alertafiscal.com.br/#contato)

# Design System — Alerta Fiscal

> Documento unico, padronizado, dividido em:
> **A · Sistema (SaaS / Painel)** e **B · Landing Page**.

---

## 1. Principios

1. **Fiscal direto**: linguagem objetiva e de confianca.
2. **Contraste alto**: base escura com amarelo de acao.
3. **Tipografia unica**: `Oxanium`.
4. **Hierarquia por destaque**: CTA sempre evidente.
5. **Design limpo**: pouco ornamento, foco em mensagem e conversao.
6. **Semantica de estado clara**: alerta, sucesso, neutro.

---

## 2. Tokens — Light + Dark

### 2.1 Base, brand, estados

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--background` | `0 0% 99%` | `0 0% 9%` | Fundo global |
| `--foreground` | `0 0% 10%` | `0 0% 100%` | Texto principal |
| `--card` | `0 0% 100%` | `0 0% 13%` | Superficie de card |
| `--card-foreground` | `0 0% 10%` | `0 0% 100%` | Texto em card |
| `--primary` | `44 100% 52%` | `44 100% 52%` | Cor de acao (amarelo) |
| `--primary-foreground` | `0 0% 10%` | `0 0% 10%` | Texto sobre primary |
| `--secondary` | `0 0% 92%` | `0 0% 20%` | Superficies secundarias |
| `--muted` | `0 0% 95%` | `0 0% 18%` | Backgrounds suaves |
| `--muted-foreground` | `0 0% 38%` | `0 0% 74%` | Texto auxiliar |
| `--border` | `0 0% 86%` | `0 0% 28%` | Borda |
| `--ring` | `44 100% 52%` | `44 100% 52%` | Focus ring |

### 2.2 Sidebar

| Token | Light | Dark |
|---|---|---|
| `--sidebar-background` | `0 0% 100%` | `0 0% 11%` |
| `--sidebar-foreground` | `0 0% 22%` | `0 0% 84%` |
| `--sidebar-primary` | `44 100% 52%` | `44 100% 52%` |
| `--sidebar-border` | `0 0% 88%` | `0 0% 24%` |

### 2.3 Paleta fiscal de apoio

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--af-yellow` | `44 100% 52%` | `44 100% 52%` | CTA principal |
| `--af-dark` | `0 0% 10%` | `0 0% 10%` | Fundo institucional |
| `--af-gray` | `0 0% 85%` | `0 0% 30%` | Linhas auxiliares |
| `--af-white` | `0 0% 100%` | `0 0% 100%` | Texto e superficies |

---

## 3. Tipografia

- Familia unica: **Oxanium** (300-700).
- Titulos em 600/700.
- Corpo em 400/500.

| Papel | Classe recomendada | Peso |
|---|---|---|
| H1 Hero | `text-4xl sm:text-5xl leading-tight` | 700 |
| H2 Secao | `text-2xl sm:text-3xl` | 600 |
| Body | `text-base sm:text-lg` | 400 |
| Label | `text-sm uppercase tracking-wide` | 500 |

---

## 4. Espacamento, raios e sombras

- **Raio base**: `5px`.
- **Cards**: `5px`.
- **Inputs**: `4px`.
- **Botoes**: `5px`.
- **Borda**: `1px`.

Sombras:

```css
--surface-shadow: 0 10px 30px rgba(255,188,11,.18);
--surface-shadow-strong: 0 16px 36px rgba(255,188,11,.24);
```

---

## 5. Gradientes e backgrounds

```css
--hero-gradient:
  linear-gradient(135deg, #181818 0%, #232323 60%, #FFBC0B 100%);

--cta-gradient:
  linear-gradient(135deg, #FFBC0B 0%, #FFD65C 100%);
```

---

# PARTE A — Sistema (SaaS / Painel)

## 6.1 Layout (shell)

- Sidebar fixa no desktop, drawer no mobile.
- Header simples e funcional.
- Conteudo organizado em secoes objetivas.

## 6.2 Sidebar

- Ativo com destaque amarelo.
- Inativo em tons cinza.
- Hover discreto para manter legibilidade.

## 6.3 Header

- Titulo da area + busca opcional + CTA.

## 6.4 Cards

- Cards dark com borda discreta.
- Cards de destaque com CTA amarelo.

## 6.5 Botoes, inputs, badges

- **Primario:** amarelo com texto escuro.
- **Secundario:** transparente com borda clara.
- **Input:** fundo escuro, borda suave, foco amarelo.

## 6.6 Estados

| Estado | Regra |
|---|---|
| Hover | `translateY(-2px)` + glow leve |
| Focus | `ring-2 ring-ring` |
| Active | amarelo mais denso |
| Disabled | `opacity-50 cursor-not-allowed` |
| Loading | skeleton neutro |

## 6.7 Animacoes

- Fade-in em secoes.
- Lift suave em hover.

---

# PARTE B — Landing Page

## 7.1 Hero / fundo imersivo

- Hero escuro com gradiente para amarelo.

## 7.2 Card central

- Caixa principal escura com CTA amarelo.

## 7.3 Cabecalho do card
- Titulo de urgencia e valor direto.

## 7.4 Texto de apoio
- Mensagem clara sobre risco e oportunidade.

## 7.5 CTA primario
- Sempre destacado em amarelo.

## 7.6 Divisor com label
- Para separar argumentos e prova.

## 7.7 Lista de features
- Beneficios fiscais em bullets curtos.

## 7.8 Footer minimalista
- Simples e confiavel.

## 7.9 Tipografia editorial
- Oxanium com hierarquia de contraste.

## 7.10 Microinteracoes
- Hover leve, sem exagero.

## 7.11 Variacoes de composicao
- Hero + prova + beneficios + CTA final.

---

## 8. Diretrizes (do / don't)

✅ **Faca**
- Priorize legibilidade e contraste.
- Use amarelo apenas para acao e destaque.
- Mantenha visual limpo e objetivo.

❌ **Evite**
- Competicao de cores com o amarelo.
- Efeitos visuais exagerados.
- Texto longo sem escaneabilidade.

---

## Anexo · Trecho `index.css` essencial

```css
:root {
  --background: 0 0% 99%;
  --foreground: 0 0% 10%;
  --primary: 44 100% 52%;
  --radius: 5px;
}
.dark {
  --background: 0 0% 9%;
  --foreground: 0 0% 100%;
  --primary: 44 100% 52%;
}
```

# Unified Design System — Grupo (v2)

Documento unificado para desenvolvimento de produtos web, LPs e apps internos do grupo, padronizado por empresa:

- Grupo Pomin Hub
- Auditto / Fiscal Luminary
- Solutta
- Alerta Fiscal

Este arquivo segue uma estrutura fixa por empresa para facilitar implementação por times de design, front-end e IA.

---

## Estrutura padrão por empresa

Cada bloco de marca segue os mesmos 10 pontos:

1. Identidade visual
2. Tipografia
3. Paleta de cores (tokens)
4. Gradientes
5. Bordas, raio e espessuras
6. Sombras
7. Componentes base (botão, card, input, navbar)
8. Motion e estados
9. Landing page (hero + composição)
10. Diretrizes (fazer / evitar)

---

## 1. Grupo Pomin Hub

### 1.1 Identidade visual

- Estética corporativa, premium e tecnológica.
- Base escura (dark-first), com azul profundo e acentos teal/ciano.
- Superfícies translúcidas com leve sensação de vidro.
- Interface limpa, respirada e orientada a leitura.

### 1.2 Tipografia

| Uso | Família | Pesos recomendados |
|---|---|---|
| Display / Heading | Oxanium | 400, 500, 700 |
| Body / UI | Oxanium | 300, 400, 500 |
| Labels técnicas | Oxanium | 500, 600 |

### 1.3 Paleta de cores (tokens)

| Token | Valor |
|---|---|
| `--primary` | `#4983A0` |
| `--primary-glow` | `#7ECCE4` |
| `--background` | `#050E17` |
| `--surface` | `#0F1720` |
| `--surface-tint` | `rgba(255,255,255,0.03)` |
| `--border` | `rgba(255,255,255,0.08)` |
| `--foreground` | `#E8F0F5` |
| `--muted-foreground` | `#8EA3B0` |

### 1.4 Gradientes

```css
--gradient-primary: linear-gradient(135deg, #0F5FA8 0%, #7ECCE4 100%);
--gradient-hero: linear-gradient(135deg, #050E17 0%, #050E17 50%, #1E3D52 80%, #46758D 100%);
```

### 1.5 Bordas, raio e espessuras

| Uso | Valor |
|---|---|
| Cards | `14px` |
| Itens sidebar | `5px` |
| Inputs / botões padrão | `8px` |
| Pills / badges | `9999px` |
| Espessura de borda | `1px` |

### 1.6 Sombras

```css
--shadow-card: 0 18px 36px -12px rgba(0,0,0,0.45);
--shadow-card-soft: 0 10px 24px -12px rgba(0,0,0,0.35);
```

### 1.7 Componentes base

- **Botão primário:** gradiente azul -> ciano, texto claro, hover com `translateY(-2px)`.
- **Card padrão:** fundo translúcido, borda branca 8%, blur sutil, raio 14px.
- **Input:** fundo escuro suave, borda 1px translúcida, foco com ring `--primary`.
- **Sidebar ativa:** fundo gradiente + borda com mask gradient.

### 1.8 Motion e estados

- Transições entre `200ms` e `300ms`.
- Entrada de blocos com fade + `translateY(8px -> 0)`.
- Hover sutil, sem escalas agressivas.
- Focus sempre visível (`ring-2`).

### 1.9 Landing page

- Hero escura full-bleed usando `--gradient-hero`.
- CTA principal pode usar botão invertido (fundo branco / texto preto) para contraste.
- Composição recomendada: hero + benefícios + prova social + CTA.

### 1.10 Diretrizes

**Fazer**

- Priorizar contraste e respiro visual.
- Usar ciano como acento, não como cor dominante.
- Manter aparência premium e controlada.

**Evitar**

- Neon excessivo.
- Bordas grossas.
- Excesso de sombras pesadas.

---

## 2. Auditto / Fiscal Luminary

### 2.1 Identidade visual

- Fintech premium com linguagem editorial.
- Violeta como protagonista e teal como apoio semântico.
- Light-first para produto, com dark mode opcional.
- Interface sofisticada, focada em leitura de dados.

### 2.2 Tipografia

| Uso | Família | Pesos |
|---|---|---|
| Headings | Plus Jakarta Sans | 600, 700, 800 |
| Body / UI | Manrope | 400, 500, 600 |
| Label microcaps | Manrope | 700 |

### 2.3 Paleta de cores (tokens)

| Token | Valor |
|---|---|
| `--primary` | `#662CEA` |
| `--primary-dim` | `#5A13DE` |
| `--primary-container` | `#A769EE` |
| `--tertiary` | `#00647B` |
| `--background` | `#F5F6F8` |
| `--foreground` | `#100828` |
| `--surface` | `#FFFFFF` |
| `--border` | `#DFE2E8` |

### 2.4 Gradientes

```css
--gradient-primary: linear-gradient(135deg, #662CEA 0%, #A769EE 100%);
--gradient-hero: linear-gradient(135deg, #100828 0%, #2A136A 60%, #662CEA 100%);
```

### 2.5 Bordas, raio e espessuras

| Uso | Valor |
|---|---|
| Radius base | `0.75rem` |
| Inputs | `0.625rem` |
| Cards principais | `2rem` |
| Pills | `9999px` |
| Borda padrão | `1px` |

### 2.6 Sombras

```css
--shadow-card: 0 8px 24px rgba(16,8,40,0.04);
--shadow-ambient: 0 20px 40px rgba(16,8,40,0.06);
--shadow-ambient-lg: 0 30px 60px rgba(16,8,40,0.1);
```

### 2.7 Componentes base

- **Botão CTA:** gradiente violeta com elevação no hover.
- **Card principal:** `rounded-2xl` + borda fantasma (`ghost-border`) + `shadow-card`.
- **Input:** borda sutil, ring violeta no foco.
- **Badges semânticas:** padrão cor sólida no texto + fundo `/10`.

### 2.8 Motion e estados

- Hover lift padrão em cards e CTAs.
- Shimmer para loading e skeletons.
- Focus via `ring-ring`, sem remover acessibilidade.
- Active usa `--primary-dim` quando aplicável.

### 2.9 Landing page

- Hero editorial escura com gradiente violeta.
- Blocos claros para conteúdo financeiro e provas de confiança.
- CTA acima da dobra com mensagem direta.

### 2.10 Diretrizes

**Fazer**

- Manter consistência de tipografia (Plus Jakarta + Manrope).
- Usar violeta para ação e hierarquia.
- Garantir visual premium com sombras suaves.

**Evitar**

- Misturar paletas fora do espectro violeta/teal.
- Cores hardcoded em componentes.
- CTAs sem destaque visual.

---

## 3. Solutta

Base visual considerada:

- [solutta.com](https://solutta.com/)
- [LP Reforma Experience](https://lps.solutta.com/reforma-experience/)
- [LP Solutta Experience Confirmação Final](https://lps.solutta.com/solutta-experience-confirmacao-final/)
- [LP Conheça a Solutta](https://lps.solutta.com/solutta-conheca-a-solutta/)

### 3.1 Identidade visual

- Institucional, tecnológica e orientada a conversão.
- Azul vibrante como protagonista e ciano como reforço.
- Visual limpo, moderno e com ritmo empresarial.
- Pode operar em light e dark, mantendo contraste alto.

### 3.2 Tipografia

| Uso | Família | Pesos |
|---|---|---|
| Headings | Oxanium | 500, 600, 700 |
| Body | Oxanium | 300, 400, 500 |
| UI / Botões | Oxanium | 500, 600 |

### 3.3 Paleta de cores (tokens)

| Token | Valor |
|---|---|
| `--primary` | `#0042FF` |
| `--secondary` | `#0FE0FF` |
| `--background-dark` | `#080850` |
| `--surface` | `#FFFFFF` |
| `--surface-alt` | `#F4F4F8` |
| `--foreground` | `#080850` |
| `--border` | `rgba(8,8,80,0.12)` |
| `--border-strong` | `rgba(8,8,80,0.22)` |

### 3.4 Gradientes

```css
--gradient-primary: linear-gradient(135deg, #0042FF 0%, #0FE0FF 100%);
--gradient-hero: linear-gradient(135deg, #080850 0%, #0027A8 55%, #0FE0FF 100%);
--gradient-cta-soft: linear-gradient(135deg, #0037D4 0%, #0CCDE9 100%);
```

### 3.5 Bordas, raio e espessuras

Regra de borda definida para marca: entre `0px` e `5px`.

| Uso | Valor recomendado |
|---|---|
| Radius base | `5px` |
| Inputs | `4px` |
| Cards | `5px` |
| Botões | `5px` |
| Borda padrão | `1px` |
| Borda forte (blocos premium) | `2px` |

### 3.6 Sombras

```css
--shadow-card: 0 10px 30px rgba(0,66,255,0.18);
--shadow-card-hover: 0 18px 40px rgba(15,224,255,0.25);
--shadow-navbar: 0 8px 24px rgba(8,8,80,0.16);
```

### 3.7 Componentes base

- **Botão primário**

```css
background: linear-gradient(135deg, #0042FF 0%, #0FE0FF 100%);
color: #FFFFFF;
border-radius: 5px;
border: 0;
```

- **Card padrão:** fundo branco, raio 5px, borda 1px leve, sombra azul sutil.
- **Input padrão:** fundo branco, borda cinza clara, foco com ring em `--primary`.
- **Navbar LP:** transparente sobre hero, blur leve, CTA destacado em azul.

### 3.8 Motion e estados

- Transition base: `250ms cubic-bezier(0.4,0,0.2,1)`.
- Hover de CTA: `translateY(-2px)` + `--shadow-card-hover`.
- Entrada de seções: fade-in com atraso por bloco.
- Focus: ring visível para todos os elementos interativos.

### 3.9 Landing page

- Hero full-screen com `--gradient-hero`.
- Headline grande institucional + subtítulo objetivo.
- CTA principal acima da dobra e CTA secundário opcional.
- Blocos de prova social e benefícios em cards claros.

Estrutura sugerida:

```txt
Hero + CTA
Prova social
Benefícios
Serviços / diferenciais
Depoimentos
FAQ
CTA final
Footer
```

### 3.10 Diretrizes

**Fazer**

- Usar azul como cor principal de ação.
- Reservar ciano para acentos de destaque e glow.
- Manter layout com bastante respiro e blocos limpos.
- Padronizar bordas no intervalo 0-5px.

**Evitar**

- Bordas espessas sem necessidade.
- Mistura de múltiplas cores além da paleta base.
- Efeitos neon exagerados.
- Sombras pesadas que prejudiquem leitura.

---

## 4. Alerta Fiscal

Base visual considerada:

- [LP Alerta Fiscal](https://lps.alertafiscal.com.br/#contato)

### 4.1 Identidade visual

- Marca de contexto fiscal/tributário, comunicação direta.
- Contraste forte entre fundo escuro e acento amarelo.
- Linguagem visual objetiva, com foco em credibilidade e conversão.
- Interface “sólida”: sem excesso de ornamento.

### 4.2 Tipografia

| Uso | Família | Pesos |
|---|---|---|
| Headings | Oxanium | 500, 600, 700 |
| Body | Oxanium | 300, 400, 500 |
| UI / Botões | Oxanium | 500, 600 |

### 4.3 Paleta de cores (tokens)

| Token | Valor |
|---|---|
| `--primary` | `#FFBC0B` |
| `--background-dark` | `#181818` |
| `--surface-dark` | `#222222` |
| `--surface` | `#FFFFFF` |
| `--foreground` | `#FFFFFF` |
| `--foreground-dark` | `#181818` |
| `--gray` | `#D9D9D9` |
| `--border` | `rgba(255,255,255,0.08)` |

### 4.4 Gradientes

```css
--gradient-hero: linear-gradient(135deg, #181818 0%, #232323 60%, #FFBC0B 100%);
--gradient-cta: linear-gradient(135deg, #FFBC0B 0%, #FFD65C 100%);
```

### 4.5 Bordas, raio e espessuras

| Uso | Valor |
|---|---|
| Radius base | `5px` |
| Inputs | `4px` |
| Cards | `5px` |
| Botões | `5px` |
| Borda padrão | `1px` |

### 4.6 Sombras

```css
--shadow-card: 0 10px 30px rgba(255,188,11,0.18);
--shadow-card-hover: 0 16px 36px rgba(255,188,11,0.24);
```

### 4.7 Componentes base

- **CTA primário:** fundo amarelo (`--primary`), texto escuro (`--foreground-dark`), alto contraste.
- **Card padrão dark:** fundo `#222`, borda branca 8%, hover com glow amarelo sutil.
- **Input:** fundo escuro, borda suave, foco amarelo.
- **Navbar:** dark e minimalista, com CTA destacado.

### 4.8 Motion e estados

- Hover com elevação suave (`translateY(-2px)`).
- Glow amarelo moderado apenas em elementos de ação.
- Fade-in em seções na rolagem.
- Focus sempre visível com ring claro.

### 4.9 Landing page

- Hero escura com gradiente para amarelo no fechamento.
- Título grande, texto curto e promessa clara.
- CTA principal sempre visível acima da dobra.
- Blocos de dor -> solução -> prova -> CTA final.

### 4.10 Diretrizes

**Fazer**

- Destacar ações com amarelo e preservar legibilidade.
- Manter tom visual direto e confiável.
- Usar contraste alto em todos os estados.

**Evitar**

- Muitas cores competindo com o amarelo.
- Glassmorphism exagerado.
- Excesso de elementos decorativos.
- Perder contraste em botão/texto.

---

## 5. Governança global do grupo

### 5.1 Regras de implementação

- Sempre usar tokens semânticos.
- Evitar hardcode de cor dentro de componente.
- Preferir HSL para tokens de sistema.
- Definir estados `hover`, `focus`, `active` e `disabled` para todo componente interativo.

### 5.2 Motion padrão do grupo

```css
--transition-base: all 250ms cubic-bezier(0.4,0,0.2,1);
```

### 5.3 Hover padrão do grupo

```css
transform: translateY(-2px);
```

### 5.4 Focus padrão do grupo

```css
outline: none;
box-shadow: 0 0 0 2px hsl(var(--ring));
```

### 5.5 Sombras

- Nunca usar sombra pesada sem contexto.
- Elevação deve apoiar hierarquia, não competir com conteúdo.

### 5.6 Estrutura padrão de landing pages do grupo

```txt
Hero
Prova social
Benefícios
Features
Objeções / FAQ
CTA final
Footer
```

### 5.7 Checklist de handoff para desenvolvimento

- Tokens exportados por marca.
- Escala tipográfica definida.
- Componentes base com estados.
- Grid e breakpoints da LP definidos.
- Validação responsiva mobile-first.
- Critérios de contraste e acessibilidade verificados.

