# 📇 BIBLIOTECA CAN — ÍNDICE COMPLETO
### Levantado em 16/09/2026, a partir dos arquivos de imagem do próprio Project

---

## 0. 🔓 A DESCOBERTA — A BIBLIOTECA SEMPRE ESTEVE NO PROJECT

Vários STATUS registraram a mesma pendência: *"biblioteca CAN/TR/BF não está no Project"*, *"os cardápios PDF são imagem e não abrem em texto"*, *"não inventei nome nem código"* (Rivio 5 eventos · Sekron 22/09 v1 e v2 · Master sem 4º canapé).

**A pendência era falsa.** As fichas estão no Project desde 25/08/2026, como arquivos de imagem numerados:

> ### `N.png` = **CAN-0NN**
> `4.png` = CAN-004 · `12.png` = CAN-012 · `22.png` = CAN-022 — e assim por diante, de 1 a 34.

Não são fotos de cardápio: são **fichas operacionais completas** do Manual Operacional Pieggi (versão 1.0, 05/2025), cada uma com código, nome real, categoria, base, pasta base, recheio, complemento, finalização (produto + gramatura + fornecedor), checklist de produção e expedição, passo a passo de montagem no evento, tempo máximo de montagem, equipamentos, pontos de atenção, erros mais comuns e QR code do vídeo.

**Como usar:** `project_read("5.png")` devolve o arquivo local → abrir com o Read. Cada ficha é uma imagem grande (~1,9 MB); ler só as que o job precisa.

---

## 1. 📋 O ÍNDICE

🟢 = ficha **aberta e lida** (dados conferidos) · ⚪ = **título por OCR**, ficha ainda não aberta — confirmar antes de escrever em proposta ou programação.

| # | Nome | Base | Categoria |
|---|---|---|---|
| 🟢 **004** | **Carpaccio** | filão de pão italiano tostado | canapé |
| 🟢 **005** | **Tartelete Shimeji** | tartelete | canapé |
| 🟢 **011** | **Tartelete de Creme de Palmito** | tartelete | canapé |
| 🟢 **012** | **Bruschetta de Rosbife** | filão de pão italiano tostado | canapé |
| 🟢 **018** | **Mini Tortinha Folhada de Guacamole** | tortinha folhada | canapé |
| 🟢 **022** | **Tartelete Queijo & Abacaxi** | tartelete | canapé (Coffee Master +) |
| ⚪ 001 | Vol-au-vent Brie & Damasco | vol-au-vent | canapé |
| ⚪ 002 | Torradinha Banana-da-terra & Cream Cheese | torradinha | canapé |
| ⚪ 003 | Vol-au-vent Camarão | vol-au-vent | canapé |
| ⚪ 006 | Salmão Defumado | *(a confirmar)* | canapé |
| ⚪ 007 | Ricota com Espinafre e Mel Trufado | tartelete | canapé |
| ⚪ 008 | Tartelete de Gorgonzola & Pera Caramelizada | tartelete | canapé |
| ⚪ 009 | Ricota com Ervas | tartelete | canapé |
| ⚪ 010 | Frango Cremoso | tartelete | canapé |
| ⚪ 013 | Cubo de Tapioca com Queijo Coalho | — | canapé |
| ⚪ 014 | Espetinho Caprese | espeto | canapé |
| ⚪ 015 | Tartelete Creme de Queijo com Cebola Caramelizada | tartelete | canapé |
| ⚪ 016 | Tartelete Gorgonzola & Geleia de Uva | tartelete | canapé |
| ⚪ 017 | Tartelete Doce Queijo & Goiabada | tartelete | canapé doce |
| ⚪ 019 | Tartelete Ganache & Maracujá | tartelete | canapé doce |
| ⚪ 020 | Tartelete Ganache Branca & Geleia de Morango | tartelete | canapé doce |
| ⚪ 021 | Tartelete Doce de Leite & Banana | tartelete | canapé doce |
| ⚪ 023 | Tartelete Manga & Pimenta-rosa | tartelete | canapé doce |
| ⚪ 024 | Tartelete Ganache & Amêndoas | tartelete | canapé doce |
| ⚪ 025 | Tartelete Cottage & Maçã | tartelete | canapé doce |
| ⚪ 026 | Brie Folhado com Nuts de Caramelo Salgado | — | **prato quente · ilha/estações** |
| ⚪ 027 | Terrine de Tomates Secos Confitados & Pesto | terrine | — |
| ⚪ 028 | Terrine de Pera Caramelizada & Gorgonzola | terrine | — |
| ⚪ 029 | **Mini Quiches Sortidas — Lorraine · alho-poró · queijos** | mini quiche | — |
| ⚪ 030 | Homus com Pão Sírio | — | estação |
| ⚪ 031 | Guacamole Pieggi | — | estação |
| ⚪ 032 | Coalhada com Quibe e Crudité de Vegetais | — | estação |
| ⚪ 033 | Pasta na Tábua Catupiry | — | board |
| ⚪ 034 | **Pieggi Board — linha Executive, aprox. 30 pessoas** | — | board |

---

## 2. 🔴 CORREÇÕES QUE A BIBLIOTECA IMPÕE À CONFIG

| Onde | A config diz | A ficha diz | Vale |
|---|---|---|---|
| ADENDO 02/09 §3 · §5.4 | **"Torradinha de Rosbife"** CAN-012 | **"Bruschetta de Rosbife"** — base é filão de pão italiano fatiado na diagonal e tostado, não torradinha | **a ficha** |
| ADENDO 02/09 §3 | Mini Quiches Sortidas = **MQ-01** | a ficha da biblioteca é **CAN-029** | ⚠️ confirmar com o Bruno se MQ-01 e CAN-029 são o mesmo item com dois códigos, ou se MQ-01 é código morto |
| ADENDO 02/09 §3 | *"Torradinha de Queijo e Mel Trufado — ⚠️ sem código ainda, nunca inventar número"* | **CAN-002 é Torradinha Banana-da-terra & Cream Cheese** — não é essa. Nenhum título OCR bate com "queijo e mel trufado" em base torradinha; **CAN-007 é Ricota com Espinafre e Mel Trufado**, que a config já avisa ser outra coisa | 🟡 pendência **mantida** — a ficha realmente não existe |

---

## 3. ⚠️ O QUE A BIBLIOTECA **NÃO** RESOLVE

**As fichas não trazem a coluna "ONDE PODE SER OFERECIDO".** Nenhuma das seis lidas diz a que linha pertence. Ou seja: a biblioteca dá **nome real, base, composição e montagem** — mas **não** diz se o item é Executive, Master ou Premium.

Para a linha, a única fonte continua sendo a config (ADENDO 02/09 §3):

> **Bases liberadas no HH Executive +**
> tartelete: CAN-005 · 008 · 009 · 010 · 011 · 015 · 016
> torradinha: CAN-012 · queijo e mel trufado (s/ código)
> tortinha folhada: CAN-018
> mini quiche: MQ-01
> *Não-vegetarianos: CAN-012 (rosbife) e CAN-010 (frango).*
> *Máx. 2 canapés da mesma base. Não repetir queijo em dois itens do mesmo serviço.*

🔴 **Consequência prática:** todo CAN fora dessa lista — **CAN-004 Carpaccio incluído** — deve ser tratado como **Master + até o Bruno dizer o contrário**. A TRAVA 03/09 §5 proíbe vender item de linha superior num Executive.

🟡 **Pendência para o Bruno:** fechar a tabela `código → linha` dos 34 CAN. É a última peça que falta para o cardápio de coquetel sair sozinho, sem pergunta.

---

## 4. 📐 COMO ESCREVER NA PROPOSTA E NA PROGRAMAÇÃO

**PROPOSTA** — nome comercial + descritivo de venda. **Sem código, sem gramatura.** Nota interna no fim: `[INTERNO] Canapés selecionados: CAN-0XX, CAN-0YY…`
**PROGRAMAÇÃO** — nome + código CAN + finalização + "montar até X min antes", em **linha amarela** (montagem no local). O tempo de montagem vem da própria ficha.
**COMANDA** — gramatura, embalagem, manga/bico e o que vai separado. Tudo está na ficha.

### Fichas já lidas — dados para copiar

**CAN-004 · CARPACCIO** — montar até **15 min** antes
Base: filão de pão italiano (fino e comprido), fatiado na diagonal e tostado com azeite — 1 fatia/canapé · Pasta base: carpaccio bovino **10 g** · Complemento: mostarda Dijon **5 g** + parmesão em lascas **5 g** · Finalização: fio de azeite extravirgem (~1 g) · 1 mini folha de rúcula · pimenta-do-reino moída na hora.
Erros comuns: torrada mole, carpaccio em excesso, parmesão ralado fino (não usar), pimenta já moída.

**CAN-005 · TARTELETE SHIMEJI** — montar até **20 min** antes
Base: tartelete pronta (Arosa) · Pasta base: cream cheese **15 g** (bico fino) · Recheio: shimeji refogado na manteiga e shoyu **15 g**, al dente · Finalização: azeite trufado **3 gotas** nas posições **12h, 4h e 8h** + **3 hastes de cebolete** espetadas no centro.
Obs.: recheio e finalizações viajam separados, nunca misturar.

**CAN-011 · TARTELETE DE CREME DE PALMITO** — montar até **10 min** antes
Tartelete · creme de palmito **20 g** · tomate seco em cubos **3–4 g**, bem escorrido · 1 folha de salsinha crespa ou microbroto.

**CAN-012 · BRUSCHETTA DE ROSBIFE** — montar até **10 min** antes
Filão de pão italiano tostado · maionese de picles e mostarda Dijon **10 g** · rosbife fatiado **15 g** · 1 alcaparra no centro · 1 microbroto de agrião ou rúcula · fio de azeite extravirgem (~0,2 g).

**CAN-018 · MINI TORTINHA FOLHADA DE GUACAMOLE** — montar até **30 min** antes
Mini tortinha folhada redonda lisa (Arosa) · guacamole Pieggi **20 g** (manga, bico liso) · pitada de raspas de limão siciliano · 1 microbroto de coentro.

**CAN-022 · TARTELETE QUEIJO & ABACAXI** — montar até **15 min** antes · **Coffee Master +**
Tartelete pronta (Arosa) · creme de queijo **20 g** em roseta · calda de abacaxi com cubinhos **10 g** · raspas de limão · 1 folhinha + 1 microbroto de hortelã.

---

*Índice levantado em 16/09/2026 durante o job Sekron Digital 22/09. Método: `project_read` de cada `N.png` + OCR do cabeçalho; as seis marcadas 🟢 foram abertas e lidas por inteiro. Encerra a pendência recorrente "biblioteca CAN não está no Project" e abre a pendência nova: **falta a tabela código → linha**.*
