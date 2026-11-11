# Evento FIPT — Coffee Break Standard — 10/09/2026 (decisões da comanda)

**Cliente:** FIPT · **Evento:** Coffee Break · **Contato:** Larissa
**Data:** 10/09/2026 · **PAX:** 45 · **Serviço:** Coffee Break Standard — manhã — 08h às 09h
**Endereço:** Av. Prof. Almeida Prado, 532 — Butantã, São Paulo/SP (sala/andar em branco — não informado)
**Programação de origem:** `Pieggi Programacao - FIPT - Coffee Break - Larissa - 10-09-2026.pdf` — **v1 · 08/09/2026**
**Arquivo gerado:** `Comanda_FIPT_CoffeeBreakStandard_Larissa_10-09-2026.docx` — 6 comandas, 8 páginas, conferido em PDF. **O Bruno corrigiu o recado do croissant à mão no arquivo entregue.**

## Decisões do Bruno (08/09)
1. **Cup de shot: 50** (não 55) — 1 por shot, sem reposição extra.
2. **Croissant recheado em Coffee Standard: LIBERADO para este cliente** (a regra de linha é Executive+; conflito sinalizado e liberado pelo Bruno).
3. **Sala/andar do FIPT:** deixar **em branco** no cabeçalho e na etiqueta.
4. **Croissant — aviso CURTO dentro do item:** a versão que saiu na comanda (faixa vermelha + "sem miséria / não sai / refazer") **o Bruno achou pesada e corrigiu**. Daqui pra frente vale só `⚠️ RECHEAR BEM,: recheio generoso`, dentro do próprio item, sem faixa vermelha → `claude/adendo-comanda-croissant-rechear-bem-08set2026.md`.
5. **Orçamento R$ 2.025,00 → Verba do evento: R$ 162,00** (página da Adriana só com verba; fornecedor de busca e locação: nenhum).

## Roteamento aplicado
- **Cozinha Quente:** OMITIDA (sem item quente).
- **Cozinha Fria:** 35 mini lanche Peito de Peru · 15 Vegetariano III (mini brioche de cenoura). Itens COMPLETOS.
- **Confeitaria:** 25 croissant queijo · 25 croissant doce de leite · 50 shot Verde Vital (cortesia) · 25 bebezinho fubá c/ goiabada · 25 bebezinho cenoura c/ chocolate · 4,5 kg salada de frutas · 4 receitas Suco Natural One Laranja (pronto na garrafa).
- **Expedição–Alimentação (roxo):** todos os itens acima + pão de queijo congelado 68 tradicional + 23 integral (assar no local, reposição fracionada) + adicionais da salada (iogurte 900 ml, granola 450 g, aveia 450 g, mel 225 g, sucrilhos 225 g) + kit do café (pó p/ 4,5 L, coador + filtro, 45 açúcar, 45 adoçante, 23 sachês de chá, leite 1,35 L, achocolatado 135 g).
- **Expedição–Bebidas:** 2 pacotes de gelo de 3 kg (FIPT não é ponto fixo) + 4 garrafas de chá mate gelado (3,6 L). Sem suco (regra 27/08); sem água mineral (não vendida — regra 01/09).
- **Expedição–Estrutura:** 3 térmicas de café + 2 de leite + 2 de água quente · 2 suqueiras · 100 copos de vidro (50 suco + 50 chá) · 50 cup shot de vidro · 68 copos descartáveis + mexedores · 54 pratos + 54 garfos + 54 mini colheres · 5 bowls + 5 colheres dos adicionais · 50 palitos · 9 pegadores + 9 descansos · 11 suportes · 2 bandejas PRETAS (coffee = só pretas) · arranjo de flores · extensão + transformador · kit de limpeza · uniforme/luvas/toucas (nº pela Adriana) · 2 rádios + 2 fones · 5 caixas etiquetadas.
- **Adriana:** só a verba (R$ 162,00).

## Cálculos
- **HORA DE SAIR: 05h00** (servir 08h00 − 3h).
- Café 4,5 L ÷ 1,7 = **3 térmicas** · Leite 1,35 L → 2 térmicas · Água quente 1,35 L → 2 térmicas · Chá mate 3,6 L → **4 garrafas** de 1 L · Suco já em receitas (4).
- Gelo: 45 pax ÷ 25 → **2 pacotes** de 3 kg.
- **KIT FINALIZAÇÃO PIEGGI EXTERNO: não enviado** — nenhum gatilho (sem canapé, tartelete, verrine de vidro, Pieggi Board, HH, almoço ou brunch). Shot funcional não é gatilho.

## Conferência comanda × programação
24 itens na programação → **24 roteados**. Nenhum item sem lugar, nenhum item sem origem, nenhuma quantidade divergente.

## Aprendizado de layout (.docx)
- **Sub-banner de seção como PRIMEIRA LINHA MESCLADA da própria tabela** (com `keepNext` no parágrafo do título) — resolve o sub-banner órfão no pé da página, que acontecia quando ele era uma tabela separada (keepNext entre tabelas não segura no LibreOffice).
- Larguras confirmadas: `PROD_W = [0.42, 1.15, 4.15, 1.55]` · `EXP_W = [0.42, 0.42, 0.80, 4.10, 1.53]`, com `tblGrid` reescrito.
- `pageBreakBefore` no parágrafo espaçador que abre cada comanda — 8 páginas, nenhuma em branco.
