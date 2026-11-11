# EVENTO — StartSe / Onboarding — Manuela — 18/09/2026
Comanda gerada em 15/09/2026 (v1).

## Dados
- Cliente/Local: StartSe — CENU Torre Norte, 9º andar (Av. das Nações Unidas, 12901, Cidade Monções)
- Evento: Onboarding · Contato: Manuela
- 15 pax · Coffee Break manhã, servir 09h00 às 10h00 · 1 dia
- HORA DE SAIR: 06h00 (servir − 3h)
- Programação-fonte: `Pieggi Programacao - StartSe - Onboarding - Manuela - 18-09-2026.docx` (v1, 15/09/2026)

## Folhas geradas (§0)
5 comandas em 1 .docx, 6 folhas no PDF:
Confeitaria · Expedição–Alimentação · Expedição–Bebidas · Expedição–Estrutura (2 folhas, transbordo natural) · Adriana.
Cozinha Quente e Cozinha Fria OMITIDAS — sem item.

## Roteamento aplicado
- Confeitaria: croissant de presunto e queijo (23), carolina de doce de leite (17), bebezinho cenoura c/ chocolate já recheado (17), salada de frutas 1.500 g, suco Natural One Laranja 2 receitas (pronto na garrafa).
- Expedição–Alimentação: todos os itens acima + pão de queijo tradicional 25 e integral 12 (CONGELADOS, assar no local) + adicionais da salada (iogurte 300 ml, granola 150 g, aveia 150 g, sucrilhos 75 g, mel 75 g) + café insumo + leite 450 ml + açúcar 15 + adoçante 15 + sachê de chá 8 + achocolatado 45 g.
- Expedição–Bebidas: só chá mate gelado 1,2 L (2 garrafas de 1 L). Sem refri/cerveja → sem champanheira.
- Expedição–Estrutura: 3 térmicas escaldadas (café, leite, água quente), suqueira + jarra, copos, pratos, suportes, pegadores, bowls, bandeja preta 2, arranjo de flores, rádios 2 + fones 2, 5 caixas, bloco NÃO ENVIAR NA STARTSE.
- Adriana: sem fornecedor, sem locação. **Verba do evento: R$ 48,00** (orçamento R$ 600).

## Decisões do Bruno nesta sessão (15/09)
1. Orçamento R$ 600 confirmado → verba R$ 48,00.
2. **Croissant de presunto e queijo, 23 un — MANTIDO como veio da programação**, mesmo estando acima de 1,1/pax (17) e fora dos 4 sabores oficiais de croissant. Cardápio adaptado já vendido; conflito sinalizado, Comanda só organiza (§17.12).
3. **Copo de vidro: 17 de cada bebida fria** (17 suco + 17 chá mate = 34), e não 17 no total. Régua 1,1/pax POR BEBIDA FRIA.
4. Gelo: NÃO enviar — StartSe, coffee (gelo do local).

## Aprendizado técnico de layout (python-docx)
- `pageBreakBefore` dentro de célula de tabela NÃO quebra página no LibreOffice/Word. Usar um **parágrafo vazio (fonte 1 pt) com page_break_before antes do cabeçalho** de cada comanda.
- `keepNext` em TODAS as linhas da tabela empurra a tabela inteira para a página seguinte e deixa o cabeçalho sozinho. Aplicar keepNext **só nas 2 primeiras linhas** (título do serviço + cabeçalho das colunas) e deixar as linhas de item fluírem.
- Cabeçalho do evento compacto em 2 pares (4 linhas) economiza ~1 folha por comanda.
- Larguras Expedição ajustadas: EXP 0,48" · COP 0,48" · QTD 0,80" · DESCRIÇÃO 4,10" · ITEM 1,41" (a 0,36" o rótulo "EXP" quebra em duas linhas).
