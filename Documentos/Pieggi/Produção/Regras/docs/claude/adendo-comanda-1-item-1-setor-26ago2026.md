# 🔴 ADENDO 26/08/2026 — 1 ITEM = 1 SETOR = QUANTIDADE UMA ÚNICA VEZ
### Colar na configuração do **Claudinho COMANDA**
*(Definido pelo Bruno em 26/08/2026, a partir de erro real de produção. **PREVALECE sobre qualquer regra anterior de roteamento por componente** — inclusive o §5 (roteamento das estações), o §22, os adendos da biblioteca CAN e o adendo TR/BF, na parte em que mandavam dividir os componentes de um mesmo item entre Cozinha Quente e Cozinha Fria.)*

---

## 1. 🔴 O PROBLEMA REAL QUE ISTO RESOLVE (não repetir)
A comanda vinha **quebrando o mesmo item entre dois setores**: pão/montagem na Cozinha Fria com a quantidade total, e a carne na Cozinha Quente com a mesma quantidade total.

**Exemplo real:** 250 hambúrgueres → 250 na Fria (pão + montagem) + 250 na Quente (carne). A produção lê as duas comandas e entende **500 hambúrgueres**. Cada setor acha que o outro também tem que produzir, e sai **quantidade errada**.

Isso gerou retrabalho, desperdício e ruído nos eventos. **Não pode se repetir.**

---

## 2. 🥇 A REGRA (simples, sem exceção)

> **1 ITEM = 1 SETOR = QUANTIDADE TOTAL UMA ÚNICA VEZ.**

O setor é definido pelo **ITEM FINAL e pela forma como ele será SERVIDO** — **nunca** por onde cada ingrediente é produzido.

- 🔥 **Item SERVIDO QUENTE → item COMPLETO na COZINHA QUENTE.**
  Ex.: mini hambúrguer quente = **pão + carne + queijo + molho + montagem, tudo na Quente.**
- 🧊 **Item SERVIDO FRIO → item COMPLETO na COZINHA FRIA.**
  Ex.: mini lanche de frango desfiado servido frio = **pão + frango + pasta + folhas + montagem, tudo na Fria** — mesmo que o frango tenha sido cozido na Cozinha Quente durante a produção.
- 🍰 **Item da Confeitaria → item COMPLETO na CONFEITARIA** (mesma lógica).

❌ Nunca mais: pão de um lado, recheio do outro, carne em outra comanda.
❌ Nunca repetir a quantidade do item em dois setores de produção.
✅ Cada item tem **um único setor responsável** e aparece **completo** ali.

---

## 3. 🔧 COMO ESCREVER O ITEM QUE PASSA POR OUTRO SETOR NA PRODUÇÃO
Quando um componente é preparado por outro setor no meio do caminho (ex.: frango cozido na Quente para um lanche frio), isso **não vira linha em outra comanda**. Vira **instrução dentro do próprio item**, na comanda do setor dono:

> `33 un | Mini lanche Peito de Frango Defumado — mini brioche tradicional (compra CPL); pasta mix de queijos Pieggi; cenoura ralada; alface americana. Item COMPLETO desta comanda — montar e enviar pronto. | Mini lanche`

E, quando houver etapa em outro setor:

> `250 un | Mini hambúrguer — pão brioche + disco grelhado + queijo + maionese verde + montagem. Item COMPLETO desta comanda (a grelha do disco é interna, NÃO gera linha na outra comanda). | Mini hambúrguer`

**Componentes e conferências de compra** (ex.: "Mini brioche — COMPRA fornecedor CPL") continuam podendo ter linha própria **dentro do mesmo setor**, mas sempre marcados **"COMPONENTE — NÃO SOMAR / não é item adicional"**, pra ninguém contar duas vezes na mesma folha.

---

## 4. ⚠️ O QUE ESTA REGRA **NÃO** MUDA
- **Expedição–Alimentação continua repetindo todos os itens.** A Expedição **separa e transporta**, não produz — a repetição ali é a regra de autossuficiência (§19.2/§19.4) e não gera duplicidade de produção. O que não pode é o **mesmo item aparecer em DOIS SETORES DE PRODUÇÃO**.
- **Canapés, tarteletes, terrines e finger foods** continuam com **todos os componentes e finalizações detalhados linha a linha** (§19.5, §22, bibliotecas CAN/TR/BF) — mas **todos dentro da comanda de UM setor só**, o setor do item final. Os componentes ticáveis são **partes do mesmo item**, não itens novos, e não levam a quantidade do item repetida como se fossem produção separada.
- **Pão de queijo congelado** continua indo direto pra Expedição–Alimentação ("assar no local") — 1 lugar só.
- **Fornecedor/compra** (Letícia, Arosa, CPL, mercado, Rotisseria) continua onde já estava; não é setor de produção.

---

## 5. ✅ CHECKLIST (encaixar no §15)
- Algum item aparece com a **mesma quantidade em dois setores de produção**? → ERRADO, consolidar.
- Cada item foi roteado pela **forma de servir** (quente × frio), e não pelo ingrediente?
- Item quente está **completo** (pão + proteína + molho + montagem) na Cozinha Quente?
- Item frio está **completo** na Cozinha Fria, mesmo com componente cozido antes?
- Linhas de componente/compra dentro do setor estão marcadas **"COMPONENTE — NÃO SOMAR"**?
- A repetição na Expedição–Alimentação continua (separação), sem virar produção duplicada?

---
*Adendo fechado em 26/08/2026. Prevalece sobre o roteamento por componente do §5, §22 e adendos CAN/TR/BF. Regra única: 1 item = 1 setor = quantidade total uma única vez, definido pela forma como o item é SERVIDO (quente → Cozinha Quente completo; frio → Cozinha Fria completo), nunca por onde o ingrediente foi preparado.*
