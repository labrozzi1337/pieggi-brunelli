# Celebrar — Caixas Presente Quinto Andar — ENTREGA — 22/09/2026 — decisões da comanda

**Programação-fonte:** `Pieggi Programacao - Celebrar - Caixas Presente Quinto Andar - Bia - 22-09-2026.docx` — carimbo 18/09/2026
**Cliente/Contato:** Celebrar — Quinto Andar · Bia · endereço em branco (preencher à mão)
**Entrega:** 11h00 · **HORA DE SAIR: 11h00** (definida pelo Bruno — adendo 15/09, entrega não usa −3h)
**Escopo:** 4 caixas presente IDÊNTICAS · 23 itens por caixa · 1 unidade de cada item por caixa · 92 unidades
**Arquivo gerado:** `Comanda_Celebrar_Caixas-Presente-Quinto-Andar_Bia_22-09-2026.docx` — 5 páginas, zero página em branco.

## Decisões do Bruno (18/09)
1. **HORA DE SAIR = 11h00** — igual ao horário da entrega (não aplicou −3h). Segundo precedente de entrega, depois do Luiz 18/09.
2. **Carolinas:** mini carolina tradicional = recheio de **DOCE DE LEITE** · carolina de limão = recheio de **DOCE DE LIMÃO**. Não é creme de confeiteiro — o padrão 16/09 §3 não se aplica a estes dois itens.
3. **Caixa presente:** já existe em estoque — entra na Expedição como "4 un · separar e conferir estado". Sem fita, laço ou cartão (nada foi pedido).
4. **Sem Expedição–Estrutura e sem página da Adriana** (pedido do Bruno). Sem Expedição–Bebidas (a programação não tem bebida).

## Estrutura entregue — 1 .docx, 3 comandas
1. **CONFEITARIA** (azul #1F4E79) — 21 itens × 4 un = 84 un: petit four salgado · 2 mini quiches MQ-01 (tomilho) · 2 croissants · 3 petit four doce · 2 carolinas · queijadinha · bombocado · 6 doces no cup · 3 mini cup cakes.
2. **COZINHA FRIA / GARDE MANGER** (terracota #B45309) — 2 mini lanches × 4 un = 8 un, item completo e montado (regra 26/08: item servido frio = 1 setor, completo).
3. **EXPEDIÇÃO — ALIMENTAÇÃO** (roxo #6B21A8) — colunas **EXP ✔ / CAIXA ✔** (entrega, sem copeira), 3 seções: itens da Confeitaria · itens da Cozinha Fria · embalagem, identificação e transporte.

**Omitidas:** Cozinha Quente (nenhum item quente) · Expedição–Bebidas · Expedição–Estrutura · Adriana.

## Regras aplicadas dentro dos itens
- **Caixa fechada, sem copeira:** todos os cups e verrines saem **100% prontos e finalizados** — inclusive o granulado/acabamento da Banoffee, que normalmente iria à parte. Nada é finalizado no cliente.
- **Chantilly padrão Pieggi** (CeSiBon bem gelado + 50 a 70 g de leite em pó integral por litro, batido junto — nunca CeSiBon puro) escrito dentro do Bolo Morango Nevado e da Banoffee (adendo 16/09).
- **Croissants:** produção interna, **RECHEAR BEM** (adendo 08/09).
- **Mini quiches MQ-01:** finalização com **tomilho fresco** (não salsa).
- **Mini cup cakes:** vão **recheados prontos** (adendo 06/08) — 1 linha só.
- **Etiqueta** CLIENTE + EVENTO + ITEM + DATA DE FABRICAÇÃO em todas as embalagens; tira verde no cabeçalho de cada comanda.
- **Banner vermelho de entrega** nas 3 folhas + regras de fechamento da caixa no lugar da regra da copeira (conferir item por item · 4 caixas idênticas · caixinha vazia = não fechar · fotografar e mandar pro Luiz (11) 97603-8194 · confirmar recebimento com a Bia).

## Conferência programação × comanda
**23 itens na programação → 23 roteados** (21 Confeitaria + 2 Cozinha Fria), todos repetidos na Expedição–Alimentação.
Nenhum item sem lugar · nenhum item sem origem · nenhuma quantidade recalculada (4 un em todas as linhas).
**Acréscimos por regra fixa (embalagem, não alimento):** caixas presente · forminhas (pétala kraft, pétala de acrílico, próprias, cups acrílicos, forminhas de cup cake) · 8 palitos dos mini lanches · etiquetas · comanda impressa · transporte refrigerado e nivelado. Sem comanda de Estrutura, esses itens entram junto do item na Alimentação (precedente ASAAS 17/09).

## Layout — o que funcionou
- Corpo **Arial 12 pt** nas tabelas (mesmo padrão da programação-fonte), auxiliares 10–11 pt; margens 0,5" (720 dxa); A4.
- **Quebra de página:** `pageBreakBefore` num parágrafo de 4 pt **fora da tabela**, antes de cada comanda — o `pageBreakBefore` dentro de célula de tabela **é ignorado** pelo Word/LibreOffice e as comandas saíam empilhadas na mesma folha.
- **keepNext só na linha de cabeçalho e na 1ª linha** da tabela. Encadear keepNext em todas as linhas torna a tabela monolítica e joga a tabela inteira para a página seguinte, deixando uma folha só com o cabeçalho.
- `tblHeader` na linha de cabeçalho → a linha de colunas se repete quando o setor passa de uma folha.
- `tblGrid` reescrito: produção 0,42 / 1,05 / 4,45 / 1,35 pol · expedição 0,46 / 0,56 / 0,85 / 4,00 / 1,40 pol.
- Selo lido direto dos arquivos do projeto (`PIEGGISELO01.png`), 0,58 pol, na linha do título.
