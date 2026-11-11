# CLAUDINHO COMANDA — SPEC ATUAL (rev. jul/2026)

> Fonte: doc "PROMPT gerados pelo claudinho 17 julho" enviado pelo Bruno em 17/07/2026.
> Esta é a versão que MANDA. Onde o prompt antigo do projeto conflitar, vale esta.
> (O prompt antigo falava em 3 comandas, saída −3h fixa, US Letter, fonte 9pt — TUDO isso mudou.)

## ⛔ CORREÇÃO 21/jul (Bruno) — FINALIZAÇÃO NO LOCAL x SAI PRONTO
**A ÚNICA coisa que as copeiras finalizam/assam no local é o PÃO DE QUEIJO CONGELADO.**
- **Quiches, croissants (qualquer sabor/recheio) e pão de batata SAEM PRONTOS da cozinha** — NÃO levam linha "copeira assa/aquece no local". Escrever "(sai pronto)" pra não deixar a copeira improvisar.
- Isto **revoga** a regra antiga do doc `expedicao-alimentacao-roteamento` que mandava pôr no croissant "copeira assa na hora de servir no local". Croissant = pronto.
- Finalização de copeira no local continua valendo só para: (a) **pão de queijo / batata frita congelados** (assar/fritar no local), e (b) montagem/enfeite à parte já previsto (frutas laminadas, parmesão do penne, salada de frutas, verrine "FINALIZAR CONFORME IMAGEM").
- Erro cometido no 1º draft do GPTW (21/jul): pus "copeira aquece/assa o croissant no local" — corrigido.

## ⚠️ LIÇÃO DE PROCESSO (21/jul)
Quando o Bruno mandar um anexo de prompt, **ler o anexo INTEIRO** antes de gerar — não parar na 1ª parte nem se apoiar só na memória do projeto. O doc "PROMPT gerados pelo claudinho" tem o Proposal Bot v8 primeiro e o **prompt da Comanda depois** (mesmo arquivo).

## Escopo
Transforma programação aprovada em comandas por estação. Só LÊ e ORGANIZA — não muda insumo, recheio, sabor, quantidade; não deduz endereço/horário; não mistura estações. Dúvida → PERGUNTAR. Sempre mostrar preview em markdown e esperar "ok/gerar/aprovado" antes do .docx.

## Estrutura do documento — 6 COMANDAS, 1 por folha
1 único .docx por evento (independe de nº de dias). PageBreak antes de cada comanda (nunca 2 na mesma folha). Estação sem item → omite a página. Multi-dia: PageBreak entre dias, topo de cada dia "DIA [N] — DD/MM/AAAA". **Produção E Expedição-Alimentação separadas por dia; Bebidas/Estrutura e página da Adriana consolidadas no fim.**

PRODUÇÃO (sem banner de motorista):
1. PRODUÇÃO — COZINHA QUENTE — bordô `#800020`
2. PRODUÇÃO — COZINHA FRIA / GARDE MANGER — terracota `#B45309`
3. PRODUÇÃO — CONFEITARIA — azul `#1F4E79`

EXPEDIÇÃO (banner amarelo no topo: "MOTORISTAS: ANTES DE LEVAR, CHAMAR AS RESPONSÁVEIS PARA VALIDAR"):
4. EXPEDIÇÃO — ALIMENTAÇÃO — Resp.: BEATRIZ (cozinha fria+quente+confeitaria consolidada) · Coord.: Adriana
5. EXPEDIÇÃO — BEBIDAS, ESTRUTURA E MATERIAIS — Resp.: ASSISTENTE DE EXPEDIÇÃO · Coord.: ADRIANA (nunca escrever "Aprovação")

PÁGINA DA ADRIANA (sem banner) — verde `#2E7D32`:
6. LOCAÇÕES EXTRAS — FORNECEDORES LEAL/LETÍCIA E FREELANCER (+ VERBA)

## Roteamento das estações
- 🔥 COZINHA QUENTE = cozido/assado: pratos quentes, proteínas/acompanhamentos de ilha quente, quiches/tortas salgadas grandes, **tartelete/canapé/vol-au-vent SALGADO assado** (doce vai pra Confeitaria).
- 🧊 COZINHA FRIA / GARDE MANGER = montagem a frio: pasta/Mix de Queijos Pieggi, homus, guacamole, coalhada, mini lanches, wraps, saladas e folhas.
- 🍰 CONFEITARIA = doces, verrines doces, tartelete/canapé DOCE, sobremesas, salada de frutas (pedaços grandes, copeira finaliza no local), frutas laminadas, shots vitaminados/funcionais, bolos/bebezinhos, petit four (doce E salgado), **pão de batata, quiche de queijo, croissant recheado, tapioca banana-canela**. (Todos SAEM PRONTOS — ver correção no topo.)
- 🟠 FORNECEDOR (não é cozinha → vai na PÁGINA DA ADRIANA, âmbar): salgadinho de festa (bolinha de queijo, **esfiha, mini pizza**), empada, **quibe frito**, frios do HH, pães do HH. Fornecedor padrão = **LETÍCIA** (Leal só quando Letícia não puder — Bruno avisa). Tábua de queijos do HH → mercado. Pizza "PIZZA LUIGI" → fornecedor **Luigi**.
- **Pão de queijo = CONGELADO**, sai direto na Expedição-Alimentação (❄️ CONGELADO), NUNCA em Confeitaria/Cozinha. É o único item que a copeira assa no local.
- "FINALIZAR CONFORME IMAGEM" (vermelho) sempre em tarteletes e verrines.
- Item ambíguo → PERGUNTAR.

## Expedição — estrutura por item (sublinhas ticáveis)
- A estrutura de CADA item vai como **sublinhas logo abaixo do item**, com QTD calculada + as duas caixinhas de tique. Nunca bloco solto no rodapé.
- **Duas colunas de tique** em toda tabela: **EXPEDIÇÃO ✓** (tica ao SAIR da base) · **COPEIRAS ✓** (tica ao CHEGAR). Recado vermelho no topo: "COPEIRAS: antes do início do evento — TICAR TUDO, FOTOGRAFAR e cobrar o Luiz no zap se faltou algo."
- Sublinhas por item: suporte/estrutura 1 por item de balcão (lanche não leva travessa); pegador+descanso 1 por sabor servido solto (salada, salada de frutas, arroz, lanche, tapioca, tartelete, canapé/salgadinho; NÃO em verrine/shot); pratos louça + garfo de bolo 1,2/pax; copo descartável quentes (café+chá) 1,5/pax + mexedores; copo de vidro suco/refri 1,1/pax; cup shot vidro p/ shots 1,1/pax; colherinha verrine 1,2/pax; palito (lanche 1/un, wrap 1/un); réchaud 1 a cada 2 travessas/panelas quentes; bandeja garçom preta 2/evento; acrílica + champanheira só HH/almoço/jantar.
- Salada de frutas: 1 célula com bullets (travessa + frutas de enfeite); peso = pax × **100 g**. Acompanhamentos comprados (âmbar, à parte, 1 bowl + 1 colher cada): iogurte 20 ml/pax · granola 10 g/pax · aveia 10 g/pax · mel 5 g/pax · sucrilhos ~10 g/pax.
- Sachês: açúcar+adoçante = **2/pax por serviço de café** (Auditório também conta); chá em sachê = **0,5/pax** só em coffee break. Achocolatado pote inox 1 a cada 30 pax/período.
- **5 caixas etiquetadas no fim**: Louças · Pegadores e Utensílios · Descartáveis · Bebidas · Identificação e Apoio. Proibido material solto/misturado.
- Blocos fixos ticáveis (nunca esquecer): uniforme · luvas · toucas (dimensionar por nº de freelancers da comanda da Adriana, NÃO por pax) · kit de limpeza · gelo · infra (toalhas, arranjo, extensão) · etiquetas + programação impressa no topo.

## Regra de local — STARTSE (ponto fixo)
Na StartSe NÃO enviar: kit de limpeza, luvas/toucas/uniforme (têm ponto fixo lá). Gelo: mandar só quando tiver HH (1 pacote 3 kg a cada 25 pax, pra cima) — não em coffee. StartSe = não enviar transformador 100→220V. Manter os blocos na comanda marcados "NÃO ENVIAR NA STARTSE", ainda ticáveis. **Unidades StartSe: CENU (Av. das Nações Unidas 12.901, Torre Norte) e WTC (12.551, 6º andar). Se só disser "StartSe", perguntar unidade.**

## Cálculos
- L → garrafas (arredonda pra cima): café 1 garrafa=1,7 L · suco 1=1 L · chá gelado 1=1 L. **MAS nas bebidas da Expedição a coluna QTD fica em LITROS (ex.: "13,5 L"), sem contar garrafas.** Toda garrafa térmica leva no ITEM "enviar limpa / escaldada".
- Café: pó pra coar no local = INSUMO na Alimentação (pó + coador + açúcar/adoçante); vasilhame = garrafa térmica escaldada na Bebidas/Estrutura (Bruno costuma pedir "os dois").
- Mini hambúrguer sempre acompanha: batata frita 20 g/pax · maionese verde caseira 5 g/pax · alface 3 g/pax · potes Heinz (maionese+catchup+mostarda) 1 de cada a cada 30 pax.
- Pasta na tábua/Pieggi board: 20 g/pax + mini pão sueco 1 pacote/20 pax. Guacamole 20 g/pax · coalhada no repolho roxo 7 g/pax · homus c/ pão sírio 20 g/pax.
- Placa elétrica + extensão: sempre que tiver batata frita e/ou mini hambúrguer (HH/Brunch), almoço/jantar, salgadinhos HH, pizza HH. Não-StartSe = + transformador 100→220V.
- Bebidas térmicas (leite, água quente p/ chá) entram **só na Expedição/Bebidas**, nunca na cozinha.
- Itens comprados prontos (âmbar) somados por dia (total), não por serviço.

## Verba (página da Adriana)
Bruno informa o valor do orçamento. Calcular **8%** e mostrar só "Verba do evento (8%): R$ X". NUNCA exibir o valor do orçamento no documento. Fornecedor sempre explícito: "FORNECEDOR: LETÍCIA — [item] (Adriana buscar)".

## Campo de saída
Campo amarelo em todas as comandas menos a verde da Adriana: "DIA E HORÁRIO DA SAÍDA".
- **Preferência do Bruno (17/jul): preencher = horário de servir − 3h** (não deixar em branco).

## Layout
- Página **A4** (11906 × 16838 DXA). Margens 720 DXA (até 567 se precisar).
- Fonte **Arial, mínimo 12pt** no corpo (size 24 no docx) — copeiras não enxergam menor.
- Cabeçalho/rótulo de tabela: fundo cinza claro `#D9D9D9`, texto preto. Cabeçalho da comanda: **fundo BRANCO, cor só na borda/texto**.
- Selo **PIEGGI-SELO-01.png** (~70×70) no canto sup. esquerdo, sempre. Caminho `/mnt/project/PIEGGI-SELO-01.png` (fallback uploads).
- Datas DD/MM/AAAA, sem dia da semana. Espaçamento simples, sem folha em branco. `cantSplit: true` nas tabelas.

## PENDÊNCIA DE ARQUIVO
O **selo PIEGGI-SELO-01.png NÃO está no projeto**. Nas sessões o logo vem sendo extraído do PDF da programação (wordmark PIEGGI). Bruno precisa subir o selo oficial `PIEGGI-SELO-01.png` no projeto.

---

## Evento GPTW (Rafael · 27–29/07/2026 · WTC 12.551 · 80 pax) — gerado 21/jul
- WTC = unidade StartSe (ponto fixo): sem kit limpeza/luvas/toucas/uniforme/transformador; sem gelo (não tem HH, só coffee + 1 almoço).
- 4 serviços: Coffee Break Executive 08h (DIA1/2/3) + Almoço Executive 12h (DIA1). Saída = servir −3h: coffee 05h00, almoço 09h00.
- Café: pó insumo na Alimentação + garrafa térmica na Estrutura (os dois). Salada Caesar → Garde Manger.
- Orçamento **R$ 29.180,00 → Verba (8%): R$ 2.334,40**.
- Cozinha Quente só no DIA1 (almoço); DIAs 2 e 3 omitem a página. Estrutura final: 12 comandas (14 folhas com transbordos).
- **ERRO corrigido:** croissant de queijo/presunto tinha "copeira assa no local" — croissant SAI PRONTO. Só pão de queijo congelado é finalizado no local.

## Decisões específicas do evento StartSe / Tomorow (22–24/07/2026, CENU, 56 pax)
- Orçamento informado: R$ 18.088,00 → **Verba (8%): R$ 1.447,04** (só a verba aparece).
- Roteamento: esfiha 16 + kibe 16 (DIA1 HH) → Fornecedor **Letícia**. Pizzas (DIA3) → **Luigi**. Quiche de queijo → Confeitaria. Misto/queijo quente/pão de queijo/hambúrguer/batata → Cozinha Quente. Café/leite/chá → Expedição Bebidas.
- Compras do Kit Sobrevivência (Bruno, 17/jul): barra de cereal → **mercado**; sacola do kit → **mercado**; saquinho para nuts → **já temos em estoque**.
- Kit Sobrevivência: produzir/entregar 22/07 à tarde na StartSe; consumo 23/07 11h45 no ônibus.
- StartSe = ponto fixo: NÃO enviar kit limpeza/luvas/toucas/uniforme/transformador. Gelo só nos HH (DIA1 tarde, DIA2, DIA3): 56/25 → 3 pacotes de 3 kg por HH.
- 7 pax de restrição / contaminação cruzada (3 camarão CRÍTICO, 1 abacaxi, 1 lactose, 1 presunto, 1 corante); embutido só peito de peru; plaquinhas + cortesias sem lactose/sem corante.
