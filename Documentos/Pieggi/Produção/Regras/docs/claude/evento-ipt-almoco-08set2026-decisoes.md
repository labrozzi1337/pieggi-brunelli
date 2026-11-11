# Evento IPT — Almoço Executive — 08/09/2026 — 6 pax (decisões do Bruno, 04/09)

**Cliente:** IPT · **Evento:** Almoço (Executive) · **Data:** 08/09 · **PAX:** 6
**Local:** IPT — Prédio 11 — Av. Prof. Almeida Prado, 532 — Cidade Universitária, SP — **sala em BRANCO** (preencher à mão)
**Contato:** em BRANCO (a confirmar)
**Horário:** 12h (término a confirmar) → 🚚 **HORA DE SAIR 09h00** (servir − 3h)
**Programação de origem:** `Pieggi Programacao - IPT - Almoco - 08092026.pdf` — carimbo **04/09/2026**
**Arquivo gerado:** `Comanda_IPT_Almoco_08-09-2026.docx` — 7 comandas, 9 páginas, conferido em PDF.

## Decisões do Bruno (respondidas em 04/09)
1. **Picadinho de carne com cenoura e batatas 1,1 kg** — escrever **só o peso PRONTO**, sem conversão cru (prato misto, sem proporção fechada).
2. **Farofa de couve** — programação trazia 560 g → **arredondada para 1 kg** (lote mínimo dos quentes, regra 10/08).
3. **Molho de limão e ervas (0,25 L à parte)** — roteado na **COZINHA QUENTE**, junto do salmão (mesma receita).
4. **Mesa posta = LOCAÇÃO na página da Adriana**, 8 de cada (6 × 1,2), incluindo **xícara de café + pires** (café final na louça — por isso NÃO foram enviados copos descartáveis para quentes; só 8 mexedores na Estrutura).
5. **Pimenta / Tabasco: ENVIAR** (não constava na programação) — roteado na Expedição–Alimentação.
6. **Sala e contato: em BRANCO** no cabeçalho e na etiqueta.
7. **Orçamento R$ 2.500 → Verba do evento: R$ 200,00.**

## Roteamento aplicado
- **🔥 Cozinha Quente (#800020):** Picadinho 1,1 kg (só pronto) · Salmão 1,1 kg (cru 1,38 · ×1,25) · Molho de limão e ervas 0,25 L · Arroz 1,2 kg (cru 400 g · ×0,33) · Feijão carioca 1,8 kg (cru 780 g · ×0,43) · Farofa de couve 1 kg. As duas proteínas em **linha azul (cuidado de serviço)** com "enviar parte do molho À PARTE para reposição no réchaud".
- **🧊 Cozinha Fria (#B45309):** Salada 1 Mix de folhas padrão Pieggi 480 g (folhas + flores + brotos, comprar 600 g) · Molho artesanal Pieggi (mostarda e mel) 0,25 L · Salada 2 maionese com legumes 360 g · Salada 3 tomate-cereja e cenoura ralada 300 g (travessa exclusiva).
- **🍰 Confeitaria (#1F4E79):** Mini cup cake de bombocado 8 (já recheado) · Verrine de Mousse de Maracujá em copo bolha 8 (vai 100% pronta, sem amarelo) · Frutas laminadas 300 g sem favo (comprar 360 g) · Petit four Palito de Chocolate 6 · Cherém 6 · **Suco Natural One Laranja 1 receita** (Confeitaria produz e entrega pronto — regra 27/08).
- **🟣 Expedição–Alimentação (#6B21A8):** todos os itens acima + croutons 1 pacote + galheteiro (insumos: azeite, vinagre, sal grosso, sal rosa) + pimenta/Tabasco + café insumo 0,6 L + leite 0,2 L + 6 açúcar + 6 adoçante. Alertas cruzados do café e do suco escritos dentro dos próprios itens.
- **🥤 Expedição–Bebidas (cinza):** gelo 1 pacote de 3 kg (IPT não é ponto fixo) · Coca 6 normal + 6 zero · Guaraná 3 + 3 · Minalba 6 s/gás + 6 c/gás. Sem suco e **sem bloco "o que não entra"** (adendo 02/09).
- **🧰 Expedição–Estrutura (cinza):** 2 placas elétricas (4 quentes ÷ 2) · 2 réchauds · 6 cerâmicas coloridas · transformador + extensões (VÃO, não é StartSe) · 6 travessas de cristal · travessa da farofa · 2 potes + mini concha (molhos) · pote + pegador (croutons) · vinagreiro, azeiteiro e 2 moedores · 1 térmica de café + 1 de leite (escaldadas) · 8 mexedores · suqueira · 13 pegadores + 13 descansos · 9 colherinhas de verrine · 18 guardanapos · **2 bandejas PRETAS** (almoço = só pretas) · **KIT FINALIZAÇÃO PIEGGI EXTERNO** · arranjo de flores · kit de limpeza · uniforme sem quantidade · 2 rádios + 2 fones · encadernado + etiquetas + 5 caixas.
- **🛒 Adriana (#2E7D32):** fornecedores de busca **nenhum** · **locação da mesa posta (12 linhas, 8 de cada)** · **Verba do evento: R$ 200,00** (sem % e sem orçamento).

## Conferência comanda × programação
**28 itens na programação → 28 roteados.** Nada sem lugar, nada sem origem, nenhuma quantidade recalculada (as duas alterações — farofa 560 g → 1 kg e picadinho sem conversão — foram autorizadas pelo Bruno e estão sinalizadas em vermelho na comanda).

## Aprendizado de layout (IMPORTANTE — reaproveitar)
- **`pageBreakBefore` dentro de célula de tabela NÃO quebra página** no python-docx/LibreOffice. Solução que funcionou: **um parágrafo vazio de 1 pt com `page_break_before = True` ANTES da tabela do título** de cada comanda. Não gera página em branco.
- Larguras: `PROD_W = [0.42, 1.15, 4.15, 1.55]` · `EXP_W = [0.42, 0.42, 0.80, 4.10, 1.53]`, com `tblGrid` reescrito e `tblLayout=fixed`.
- **Fundo cinza no cabeçalho só em Bebidas e Estrutura.** Alimentação é **roxo #6B21A8 com fundo BRANCO** (adendo 20/08) — o erro de pintar a Alimentação de cinza apareceu na primeira geração.
- **Faixa amarela "HORA DE SAIR" em todas as comandas MENOS a verde da Adriana** (§11).
- Emojis foram removidos dos rótulos do cabeçalho-etiqueta (CLIENTE/EVENTO/ITEM/FABRICAÇÃO em texto puro) — renderizam mal na impressão.
