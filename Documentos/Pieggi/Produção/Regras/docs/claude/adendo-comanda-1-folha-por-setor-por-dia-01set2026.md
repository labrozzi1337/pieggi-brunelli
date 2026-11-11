# 📅 ADENDO 01/09/2026 — 1 FOLHA POR SETOR POR DIA (TODO EVENTO DE MAIS DE 1 DIA)
### Colar na configuração do **Claudinho COMANDA**

> ⚠️ **PREVALECE** sobre qualquer regra anterior de multi-dia e de quebra de página — inclusive §4 ("Multi-dia: PageBreak entre dias"), §20.9 e o adendo 06/08 §7. Nasce de erro real: a Confeitaria recebeu **UMA comanda com os 3 dias juntos** e a equipe se atrapalhou.

---

## 0. 🔴 A QUEM SE APLICA — **TODO EVENTO COM MAIS DE 1 DIA**
Vale para **2 dias, 3 dias, 5 dias, 10 dias — qualquer evento com mais de 1 dia**. Não existe "poucos dias, dá pra juntar". **Passou de 1 dia → separa por dia, sempre.**

---

## 1. 🔴 O ERRO QUE NÃO PODE REPETIR
Uma comanda de Confeitaria com DIA 1 + DIA 2 + DIA 3 na mesma folha faz a produção:
- produzir item do dia errado,
- somar quantidades de dias diferentes,
- perder a linha de onde parou.

**A equipe de produção trabalha um dia de cada vez. A folha tem que ser de um dia só.**

---

## 2. 🥇 A REGRA

> **1 SETOR × 1 DIA = 1 FOLHA (comanda própria, com cabeçalho e HORA DE SAIR próprios).**
> **TUDO no MESMO arquivo .docx** — um único documento por evento, nunca vários arquivos.

- ❌ NUNCA: "COMANDA CONFEITARIA — DIAS 1, 2 e 3" numa folha só.
- ❌ NUNCA: sub-bloco "DIA 2" dentro da comanda do DIA 1.
- ❌ NUNCA: 1 arquivo por dia.
- ✅ SEMPRE: `COMANDA CONFEITARIA — DIA 1 — 01/09` · `COMANDA CONFEITARIA — DIA 2 — 02/09` · `COMANDA CONFEITARIA — DIA 3 — 03/09` … até o último dia do evento, cada uma começando em página nova (`pageBreakBefore`), todas dentro do mesmo .docx.

Evento de **10 dias** = as folhas de produção e Alimentação vão de DIA 1 a DIA 10. Documento maior não é problema — folha misturada é.

**Setor sem item naquele dia → aquela folha é OMITIDA** (não gerar folha vazia). Ex.: se no DIA 2 não tem item quente, não existe folha "Cozinha Quente — DIA 2"; as dos outros dias continuam.

---

## 3. 📄 QUEBRA DE PÁGINA — **SÓ ENTRE SETOR/DIA. NUNCA DENTRO.**

> **QUEBRA a página quando muda o SETOR ou muda o DIA.**
> **NÃO QUEBRA a página dentro do mesmo setor e mesmo dia — aproveita a folha até o fim.**

- ✅ Quebra: fim de `Confeitaria — DIA 1` → começo de `Expedição–Alimentação — DIA 1`.
- ✅ Quebra: fim de `Expedição–Alimentação — DIA 1` → começo de `Cozinha Quente — DIA 2`.
- ❌ **NÃO quebra** entre serviços/períodos do mesmo setor no mesmo dia (Welcome → Coffee manhã → Coffee tarde da Confeitaria DIA 1 seguem **na mesma página**, um embaixo do outro).
- ❌ **NÃO quebra** entre sub-blocos, sub-banners ou seções do mesmo setor/dia.
- ❌ **NÃO deixar página pela metade** só pra "organizar": se cabe, continua na mesma folha.

**Como fazer no .docx:** usar **`pageBreakBefore` apenas no título de cada comanda (setor × dia)** — nunca `PageBreak` solto (gera página em branco). Dentro da comanda, nada de quebra manual: só `cantSplit: true` nas linhas e `keepNext` encadeando título → cabeçalho da tabela → primeiras linhas, pra tabela não rachar no meio.

**Única exceção:** se uma tabela longa **não couber** no que sobrou da página, ela transborda naturalmente para a página seguinte — isso é continuação do mesmo setor/dia, não uma nova comanda, e o cabeçalho da tabela se repete no topo. Não inserir quebra manual pra "empurrar".

**Otimizar papel:** margens ~680–720 DXA, corpo compacto, espaçamento simples e mínimo antes/depois. Mínimo de folhas possível — sem misturar setor nem dia.

---

## 4. 📐 ORDEM DAS FOLHAS DENTRO DO .DOCX — AGRUPADO POR DIA
*(definido pelo Bruno em 01/09/2026)*

```
DIA 1 — DD/MM
  🔥 Cozinha Quente — DIA 1
  🧊 Cozinha Fria — DIA 1
  🍰 Confeitaria — DIA 1
  📦 Expedição–Alimentação — DIA 1

DIA 2 — DD/MM
  🔥 Cozinha Quente — DIA 2
  🧊 Cozinha Fria — DIA 2
  🍰 Confeitaria — DIA 2
  📦 Expedição–Alimentação — DIA 2

… repetir o mesmo bloco para CADA dia do evento (DIA 3, DIA 4 … DIA N) …

CONSOLIDADAS NO FIM (evento inteiro, com sub-blocos por dia):
  🥤 Expedição — BEBIDAS
  🧰 Expedição — ESTRUTURA E MATERIAIS
  🛒 Adriana / Locações
```

**Separam por dia (1 folha por dia):** Cozinha Quente · Cozinha Fria · Confeitaria · Expedição–Alimentação.
**Consolidam no fim (1 folha para o evento todo):** Bebidas · Estrutura · Adriana — mantendo **sub-blocos por dia** (BEBIDAS — DIA 1 / DIA 2 / … / DIA N), cada linha com o serviço de origem, **sem quebrar página entre os sub-blocos**.

---

## 5. 🏷️ CABEÇALHO DE CADA FOLHA
Cada folha traz, no próprio cabeçalho, sem depender de outra página:
- Título: `COMANDA [SETOR] — DIA X — DD/MM` (cor e ícone do setor, §20.2 e adendo 20/08).
- Bloco espelho da etiqueta (📍 ONDE VAI · 👥 NOME DO EVENTO · 📦 QUANTIDADE/PAX · 🗓 DIA · 🕐 USAR ATÉ · 📅 FEITO EM), adendo 14/08.
- 🚚 **HORA DE SAIR** daquele dia/serviço (servir − 3h; "a confirmar" → em branco). Vários serviços no mesmo dia → uma faixa por serviço, **na mesma folha**.
- Tira verde "TERMINOU? ETIQUETE".
- Campo **DATA mostra só o dia daquela folha** (ex.: `02/09`), nunca "01 a 03/09" nem um intervalo.

**Repetir a folha mesmo quando o cardápio do dia é idêntico ao do dia anterior.** Folha idêntica não é desperdício — é o que a equipe tica no dia certo.

---

## 6. ✅ CHECKLIST (encaixar no §15)
- O evento tem **mais de 1 dia**? → separou **todos** os dias, do DIA 1 ao DIA N?
- Cada setor tem **uma folha por dia**, com cabeçalho e HORA DE SAIR próprios?
- Alguma folha tem **mais de um dia** ou **mais de um setor** dentro? → ERRADO, quebrar.
- Quebrou página **só** na troca de setor/dia? Ficou alguma **quebra dentro do mesmo setor/dia**? → ERRADO, tirar.
- Sobrou **página pela metade** sem necessidade? → ERRADO, aproveitar a folha.
- Ordem **agrupada por DIA** (todos os setores do DIA 1, depois DIA 2, e assim por diante)?
- Bebidas, Estrutura e Adriana **consolidadas no fim**, com sub-blocos por dia e sem quebra entre eles?
- Setor sem item no dia → folha **omitida** (e não uma folha vazia)?
- `pageBreakBefore` no título de cada comanda (nunca break solto) e **conferido em PDF** — sem página em branco?
- Campo DATA de cada folha mostra **só o dia daquela folha**?

---
*Adendo fechado em 01/09/2026. Vale para TODO evento de mais de 1 dia (2, 3, 5, 10 dias). Regra única: 1 SETOR × 1 DIA = 1 FOLHA, tudo no mesmo .docx, agrupado por dia. Quebra de página SÓ na troca de setor ou de dia — nunca dentro do mesmo setor/dia, aproveitando a folha até o fim. Bebidas/Estrutura/Adriana consolidadas no fim.*
