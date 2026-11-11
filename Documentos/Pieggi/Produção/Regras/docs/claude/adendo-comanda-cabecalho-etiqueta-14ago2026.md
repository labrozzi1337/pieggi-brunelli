# 🏷️ ADENDO 14/08/2026 — CABEÇALHO ESPELHO DA ETIQUETA (COMANDA FÁCIL DE LER)
### Colar na configuração do **Claudinho COMANDA**
*(Complementa §4 cabeçalho, §13 formato, §20.9 layout e os adendos de etiqueta 06/08. Nasce de um problema real: parte da equipe de produção é analfabeta funcional — precisa copiar da comanda para a etiqueta sem “ler e interpretar”. Validado refazendo a comanda da Alcon 11–14/08. Prevalece sobre regra anterior conflitante de cabeçalho.)*

---

## 1. O PROBLEMA QUE ISTO RESOLVE
Cada setor, ao terminar **TODOS** os itens, **cola a etiqueta física e preenche à mão**. A etiqueta tem 6 caixas fixas, nesta ordem:
**📍 ONDE VAI? · 👥 NOME DO EVENTO · 🍽️ O QUE É? · 📦 QUANTIDADE · 📅 FEITO EM · 🕐 USAR ATÉ.**
Como parte da equipe tem leitura difícil, o cabeçalho da comanda tem que ser a **cópia da etiqueta**: mesmos **ícones**, mesmas **palavras**, mesma **ordem**. Assim a pessoa **copia caixa por caixa**, sem interpretar.

## 2. REGRA DE OURO
O cabeçalho de CADA setor traz as **6 caixas iguais à etiqueta**, na mesma ordem e com os mesmos ícones. O que já se sabe vem **impresso**; só o **📅 FEITO EM** é escrito à mão (dia/hora que terminou). **🕐 USAR ATÉ** vem impresso = dia do serviço/evento.

## 3. CABEÇALHO DO EVENTO (novo padrão)
Bloco compacto espelhando a etiqueta (2 colunas pra economizar folha):
- **📍 ONDE VAI?** → Cliente + endereço/local (linha cheia). Ex.: “Alcon — Av. das Nações Unidas, 14.401, Torre Sucupira, 13º”.
- **👥 NOME DO EVENTO** → nome do evento  |  **☎ CONTATO** → contato.
- **📦 QUANTIDADE (PAX)** → PAX/quantidade  |  **🗓 DIAS** → data(s).
- **🕐 USAR ATÉ** → no dia de cada serviço  |  **📅 FEITO EM** → ___/___  ___:___ (à mão).
- **🍽️ O QUE É?** NÃO vai no cabeçalho do evento — vai por item (§5): cada linha da comanda é um produto = uma etiqueta.

## 4. CABEÇALHO DO SETOR — NOME MANTIDO + COR + DESENHO GRANDE
**NÃO renomear os setores** (os nomes já estão alinhados com a equipe). Só reforçar com **1 cor** + **1 ícone grande** pra reconhecer de longe:
- 🔥 **COZINHA QUENTE** — bordô #800020
- 🧊 **COZINHA FRIA / GARDE MANGER** — terracota #B45309
- 🍰 **CONFEITARIA** — azul #1F4E79
- 📦 **EXPEDIÇÃO** (Alimentação e Bebidas/Estrutura) — cinza #D9D9D9 / texto #595959
- 🛒 **ADRIANA** — verde #2E7D32
Cabeçalho com **fundo branco + borda grossa colorida + selo** (Expedição segue cinza + banner amarelo dos motoristas). O selo (PIEGGISELO01.png) fica no canto sup. esquerdo, na linha do título.

## 5. COLUNAS DA TABELA = CAIXAS DA ETIQUETA
Renomear os cabeçalhos das colunas pra bater com a etiqueta:
- **Produção:** ☐ | **📦 QTD** | **🍽️ O QUE É — DESCRIÇÃO** | ITEM.
- **Expedição:** EXP ✓ | COP ✓ | **📦 QTD** | **🍽️ O QUE É / COMPONENTES** | ITEM.
Assim a pessoa entende: **📦 QTD = QUANTIDADE da etiqueta** e **🍽️ O QUE É = descrição do item**. **Cada linha da comanda = uma etiqueta.**

## 6. TIRA VERDE “TERMINOU? ETIQUETE” (topo de cada setor)
Faixa fundo verde claro (#E2EFDA), texto verde (#2E7D32):
> *“🏷️ TERMINOU TUDO? COLE A ETIQUETA e copie as 6 caixas: 📍 ONDE VAI · 👥 NOME DO EVENTO · 🍽️ O QUE É (o item) · 📦 QUANTIDADE (a QTD) · 📅 FEITO EM (hoje) · 🕐 USAR ATÉ. Caixa vazia = faltou.”*

## 7. SAÍDA = FAIXA AMARELA “🚚 HORA DE SAIR”
Trocar “DIA E HORÁRIO DA SAÍDA” pela faixa amarela grande **🚚 HORA DE SAIR: [HH:MM]** + **✔ VALIDADO POR LOGÍSTICA: ____**. Mantém a regra: saída = servir − 3h; “a confirmar” → em branco pra preencher à mão. Um por serviço/período.

## 8. OTIMIZAÇÃO (mantida/reforçada)
Margens ~680–720 DXA; corpo compacto (11 pt), títulos 12–15 pt, selo ~60 px; espaçamento simples e mínimo antes/depois; `tblGrid` reescrito com a coluna **🍽️ O QUE É — DESCRIÇÃO** como a mais larga (≥ 4,0"); `cantSplit: true`; `pageBreakBefore` por comanda; sempre renderizar em PDF e conferir (sem página em branco, cores, saída, etiqueta).

## 9. AO REFAZER UMA COMANDA EXISTENTE
Ler os itens do **próprio arquivo** e **regerar** com o cabeçalho novo — **nunca redigitar/alterar quantidades, receitas ou itens**. Só muda a apresentação do cabeçalho, das colunas e da faixa de saída.

## 10. ⚠️ DETALHE A EVITAR
Não colocar o ícone 🍽️ (que é “O QUE É / comida”) em **divisores que não são item** — ex.: sub-banners de “DIA X”, “BLOCOS FIXOS DO EVENTO”, “MESA POSTA”, “BEBIDAS”. Nesses, usar o ícone do bloco (📦/🗓) ou nenhum. O 🍽️ é só para linhas de item/serviço de comida.

## 11. CHECKLIST (encaixar no §15)
Cabeçalho com as **6 caixas iguais à etiqueta**, mesma ordem/ícones? Nome do setor **mantido** + cor + ícone grande? Colunas **📦 QTD** e **🍽️ O QUE É**? Tira verde de etiquetar no topo? Saída em **🚚 HORA DE SAIR**? Só **FEITO EM** à mão? Nada de 🍽️ em divisor que não é comida? Conferido em PDF?

---
*Complementa §4, §13, §20.9 e os adendos de etiqueta 06/08. O cabeçalho da comanda vira a cópia da etiqueta física (mesmos ícones/palavras/ordem) para equipe com leitura difícil copiar caixa por caixa. Nomes de setor mantidos, só com cor + ícone grande. Cada linha de item = uma etiqueta. Ao refazer comandas antigas, reler o arquivo e regerar sem alterar itens.*
