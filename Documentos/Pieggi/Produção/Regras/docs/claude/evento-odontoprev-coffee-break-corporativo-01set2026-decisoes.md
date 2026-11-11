# 📌 EVENTO — ODONTOPREV · Coffee Break Corporativo · 01/09/2026 (comanda gerada em 27/08/2026)

## Dados
- **Cliente:** Odontoprev · **Evento:** Coffee Break Corporativo · **Contato:** Jéssica
- **Local:** Alameda Araguaia, 2.104 — Edf. CEA Corporate, 21º andar — Alphaville, Barueri/SP (NÃO é StartSe)
- **PAX:** 50 — Coffee Break Executive · **Data:** 01/09
- **Horário:** evento 08h30 às 11h30 · coffee de 1h — **A CONFIRMAR** → faixa 🚚 HORA DE SAIR em branco (§17.14)
- **Orçamento:** R$ 3.350,00 → **Verba do evento: R$ 268,00** (só o valor final na página da Adriana)

## Comandas geradas (1 .docx, 8 páginas)
1. 🧊 Cozinha Fria · 2. 🍰 Confeitaria · 3. 📦 Expedição–Alimentação (roxo) · 4. 🥤 Expedição–Bebidas ·
5. 🧰 Expedição–Estrutura · 6. 🛒 Adriana (só verba)
- 🔥 **Cozinha Quente OMITIDA** — coffee sem item quente.

## Decisões de roteamento
- Mini lanches (50 Peito de Frango Cozido Desfiado + 12 Vegetariano III) → **Cozinha Fria, item COMPLETO** (regra 1 item = 1 setor, 26/08). Brioche = compra CPL, citado dentro da descrição (sem linha de componente).
- Croissant artesanal de queijo 60 un → **Confeitaria**, produção interna, sai pronto (§17.3).
- Tartelete **CAN-020** (Ganache branco + geleia de morango) 55 un → **Confeitaria**. Ficha: tartelete quadrada Arosa + ganache branco 20 g + geleia de morango 5 g no centro; **finalização = nenhuma** (a geleia É a finalização). Casca separada, montar até 30 min antes.
- Bebezinho Maracujá 55 un → **Confeitaria, já recheado, 1 linha só** (adendo 06/08).
- Salada de frutas 5 kg (100 g/pax) → Confeitaria, pedaços grandes, copeira pica no local.
- **Suco Natural One Laranja 4 receitas → CONFEITARIA + Expedição–Alimentação** (adendo 27/08 — nenhum suco na Bebidas; linha de observação na Bebidas explicando).
- Pão de queijo tradicional 75 + **multigrãos** 25 → **congelado, direto na Expedição–Alimentação** ("assar no local"). Bruno confirmou manter a nomenclatura "multigrãos" da programação.
- Leite 1,5 L, sachê de chá 50, açúcar/adoçante 50+50, achocolatado 150 g, café insumo, adicionais da salada → **Alimentação** (adendo 18/08 v2).
- Chá mate gelado 4 L (4 garrafas) + gelo 2 pacotes 3 kg + galão Minalba 7,5 L → **Bebidas**.
- Água saborizada dividida com **alerta cruzado nas 3 comandas**: galão Minalba (Bebidas) + limão-siciliano inteiro e hortelã (Confeitaria → Alimentação) + refresqueira (Estrutura).
- **Não há água em garrafinha individual** (não contratada) — escrito na Bebidas.

## Conversões
- Café 5 L → **3 térmicas** (1,7 L) · Leite 1,5 L → **2 térmicas** · Água quente 1,5 L → **2 térmicas escaldadas (Estrutura, não é item)**.
- Chá mate 4 L → 4 garrafas · Suco 130 ml × 50 = 6,5 L ÷ 1,7 = **4 receitas**.
- Sachês açúcar/adoçante = 1 por dose de 100 ml (5 L → 50).

## Estrutura (não-StartSe → envia tudo)
Copo descartável quente 75 + mexedores 75 · copo de vidro 55 · prato de louça 60 + garfo de bolo 60 (**padrão Pieggi, sem locação** — confirmado pelo Bruno) · **palitos 62** (1 por mini lanche, sem wrap) · 3 refresqueiras · 6 travessas + 2 suportes de lanche · 7 pegadores + descansos · 5 bowls + 5 colheres dos adicionais · 2 rádios carregados + 2 fones · kit de limpeza · uniforme/luvas/toucas (sem número — Adriana fecha a equipe) · extensão + transformador · 1 arranjo de flores · etiquetas · 5 caixas · **KIT FINALIZAÇÃO PIEGGI EXTERNO** (dispara pelo tartelete) + pinça.

## Aprendizado técnico de layout (importante para as próximas comandas)
- **Parágrafo vazio de espaçamento tem que ter o TAMANHO DA MARCA DE PARÁGRAFO reduzido** (`w:pPr/w:rPr/w:sz`), não só o run. Só reduzir o run deixa cada espaçador com ~0,15" e o documento estoura 2–3 páginas a mais (aqui: 11 → 8 páginas).
- **Não colocar `page_break_before` no parágrafo dentro da célula do cabeçalho** — o LibreOffice empurra a última linha da tabela anterior para a página seguinte. Usar um **parágrafo vazio de 1 pt com `page_break_before` ANTES da tabela de cabeçalho** (não gera página em branco).
- `tblGrid` reescrito; coluna descrição 4,30" (produção) / 4,10" (expedição).
