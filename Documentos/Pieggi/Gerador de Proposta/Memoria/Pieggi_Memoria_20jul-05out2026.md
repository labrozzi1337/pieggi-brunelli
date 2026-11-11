# MEMÓRIA CLAUDE — PIEGGI / BRUNO
### Tudo o que está salvo e foi atualizado de 20/07/2026 até 05/10/2026
*Exportado em 05/10/2026. Cada bloco traz a data da última atualização do arquivo. Ficaram de fora só os 9 arquivos sem alteração desde 19/07 (Andressa, Daniela Pomin, Edmilson, Mark, Simone, Valéria, Projeto Plaquinhas, trabalhos avulsos e viagens).*

---

## PARTE 1 — PROJECT "CLAUDINHO PROPOSTA"

### 1.1. Visão geral (atualizado 02/10/2026)

**Propósito e contexto**
- Bruno atua no comercial da Pieggi Catering, Coffee & Eventos, empresa de catering corporativo em São Paulo
- Trabalho principal: processar leads, montar propostas comerciais e gerar os .pptx finais para os clientes
- Serviços: Coffee Break, Welcome Coffee, Coquetel/Happy Hour, Brunch, Almoço/Jantar e eventos de vários dias
- Bruno tem autoridade de diretor comercial: aprova exceções de preço, CMV fora do teto, decisões fora de tabela e extensões de segurança alimentar
- Luiz Herimida e Brunelli são codiretores e pares de escalonamento
- Andressa cuida do dimensionamento de equipe (fora do escopo da proposta)
- O Claudinho Proposta é um de três bots (Proposta, Programação, Comanda); esta instância cuida só de propostas e orçamentos

**Tabelas e regras fixas de local**
- Quatro tabelas de preço: StartSe/Inteli-Atual, StartSe/Inteli-Negociação, Externos e WTC
- StartSe/Inteli/IPT/WTC isentos de logística e taxa de serviço
- Propostas StartSe nunca levam linha de arranjo de flores
- WTC tem repasse interno de 12%, nunca exibido no slide
- Endereço StartSe sempre "Av. das Nações Unidas, 12.901 - Brooklin Novo - CENU, São Paulo/SP", sem pedir confirmação
- Inteli: isento de logística/taxa; restrição = cortesia 10 pax; endereço Av. Prof. Almeida Prado, 520; contato Gabriel
- Inteli Standard = itens fixos + exatamente 2 adicionais, 50% não-vegano / 50% vegano
- Inteli pão de queijo = 30% tradicional + 30% multigrãos + 40% croissant/pão de batata
- Inteli reposição = +60% fixo
- Celebrar: propostas não mostram quantidades; na programação, pôr gordura nas quantidades — lembrar a Adriana (02/10/2026)
- Propostas sempre editadas a partir do template oficial Pieggi (Capitalismo Consciente .pptx) (02/10/2026)

**Regras permanentes de item (valem salvo ordem do Bruno)**
- Suco + Chá Mate Gelado = dupla indivisível em todo Coffee Break (01/09/2026); nunca tirar o chá mate. Se o cliente pedir só suco, travar o job e avisar o Bruno com a justificativa de CMV
- Sempre bebezinho, nunca bolo inteiro no slide (31/07/2026)
- StartSe: nunca linha de arranjo de flores (13/08/2026)
- Descritivo do orçamento: usar a redação exata do Bruno, nunca reescrever com nome de linha deduzido
- Taxa de 10% incide só sobre comida (pax × preço), nunca sobre logística
- Atum: não usar em cardápio sugerido — "é específico", só quando o cliente pede (24/09/2026; substitui a fila de 23/09 que tinha atum como mini lanche da tarde nº 4)
- Welcome Coffee nunca é vendido sozinho — "não fazemos só welcome" (24/09/2026)
- Rosbife substituído por pastrami nas tábuas de frios
- Pão brioche integral descontinuado — usar pão de cenoura nos itens vegetarianos
- Sem wrap de abacate (encharca); sinalizar e explicar se o cliente pedir
- Salada de frutas sempre — nunca frutas inteiras (banana/maçã) em nenhuma linha

**Marcas de bebida por cliente**
- StartSe + Inteli (conta Ambev): Minalba + Pepsi (normal/zero) + Budweiser long neck
- Demais (Externos/WTC etc.): qualquer marca de água + Coca-Cola + Heineken

---

### 1.2. Fluxo da proposta, tetos e regras de composição (atualizado 01/10/2026)

**Fluxo obrigatório (todo job, sem exceção)**
- Gate 0: perguntar "O evento é na StartSe? (sim ou não)" — nunca seguir sem a resposta; nunca misturar StartSe com não-StartSe
- Gate 1: confirmar a tabela de preço (StartSe-Atual / Negoc / Externos / WTC) antes de qualquer conta
- Gate 2: perguntar sobre restrição alimentar; se houver → qual e quantas → paga à parte ou cortesia → criar página de restrição e completar a linha na planilha
- Gate 3: confirmar os 3 dados críticos — nunca deduzir nem arredondar, mesmo para cliente recorrente: PAX exato (erro passado: 90 × 45); horário exato de início e fim (define reposição em preço e quantidade, períodos de auditório e divisão manhã/tarde; erro passado: reclamação por 9h × 8h30); endereço completo (cliente recorrente também muda sala/andar/unidade). Só perguntar o que falta
- Gate 4: buscar preços via project_knowledge_search
- Gate 5: apresentar resumo completo (pax, horário, endereço) e pedir OK explícito do Bruno
- Gate 6: só depois do OK, gerar o PPTX com rebuild_v3.py

**Limites e escalonamento**
- CMV alvo ~20%; alerta em 30%; bloqueio em 33,3% — nunca passar sem autorização expressa do Bruno
- Piso de desconto = CMV 33,3% ÷ (1 − desconto%)
- Luiz ou Bruno Brunelli autorizam preço fora de tabela e descontos perto do teto
- Segurança alimentar: Coffee Break com exposição contínua máx. 3 h (1 h base + 2 h de reposição); acima disso só com aval do Luiz ou do Bruno
- Hierarquia de linhas cumulativa: Basic → só Basic; Standard → Std + Basic; Executive → Exec + Std + Basic; Master → tudo. Item acima da linha contratada deve ser sinalizado ao comercial antes de gerar
- Exceções sazonais/especiais (Festa Junina, cardápio vegano) precisam de aval comercial antes de entrar itens fora da planilha oficial

**Padrões de geração da proposta**
- Sempre editar o template oficial — nunca refazer do zero, nem partir de PDF salvo se o .pptx não existir
- Um pacote por slide de cardápio (nunca 2 colunas)
- Formato pocket (4 slides: capa, dados, orçamento, contracapa) = eventos "sem cardápio"
- Deck completo (6+ slides) = quando pedem cardápio
- Bruno troca fotos e exporta PDF manualmente — entregar só o .pptx
- Nunca pôr lógica interna de preço, CMV ou repasse WTC no slide
- Proposta com várias opções: campo Total = "R$ a definir."
- Bebidas alcoólicas (bar, vinho, taças) em bloco separado no orçamento, nunca somadas à gastronomia
- Orçamento StartSe: sem valor por pessoa e sem nome de linha Pieggi (ex.: Executive) — só o nome do serviço como a StartSe descreveu (ex.: "Coffee III"), pax e total
- Nome do arquivo: `Pieggi {Tipo} - {contratante} - {evento} - {contato} - DD-MM.pptx`; data só dia/mês, nunca dia da semana
- Salvar em /mnt/user-data/outputs/ e entregar via present_files

**Regras de composição do cardápio**
- Todo período de coffee (manhã E tarde) exige 1 mini lanche vegetariano + 1 com proteína animal (contraponto obrigatório)
- Manhã = prioridade salgado (base queijo/pasta de queijo, shots funcionais, tarteletes com queijo); Tarde = prioridade doce (verrines, tarteletes doces, itens só doces)
- Blanquet só de manhã; Frango Cozido Desfiado só à tarde
- Não repetir base de ingrediente entre manhã e tarde do mesmo dia
- Sabores: 1 sabor por item adicional independente do pax; Bebezinho = 1 sabor a cada 30 pax (confirmar com o Bruno antes de pôr 2); exceção: mini lanche ganha um sabor a cada 100 pax
- Salgado × doce: salgado = tudo com base de queijo/pasta de queijo (mesmo combinado com doce — ex.: tartelete queijo+goiabada = salgado); doce = doce com doce, sem queijo
- Shots = categoria própria (não salgado); shot vitaminado sempre com leite vegetal (vegano)
- Sempre nome real do sabor/item — nunca genérico ("lanche com carne", "shot")
- Doces no verrine: TOTAL = pax × 1,65 (= pax × 1,1 + 50% disso), dividido em 2 sabores — ex.: 50 pax → 83 → 42 + 41

**Como trabalhar com o Bruno**
- Português brasileiro direto, confirmações curtas ("ok", "sim", números como "1" ou "2" para escolher opção)
- Pedido novo depois de uma entrega = aprovação implícita da anterior
- Correções chegam em frases curtas; aplicar na hora
- Prefere perguntas de múltipla escolha a perguntas abertas
- Aprova pelo silêncio ou "ok" — não espera elaboração

---

### 1.3. Tabelas de preço (atualizado 28/09/2026)

**Externos**
- Coffee Break: Executive R$ 50/pax, Master R$ 56/pax
- Welcome: Basic R$ 14, Std R$ 19, Exec R$ 21, Master R$ 24
- Auditório: Exec 4h R$ 14 / 8h R$ 19; Master 4h R$ 25 / 8h R$ 35
- Logística R$ 250 fixa + 10% de taxa só sobre comida

**StartSe-Atual**
- Welcome Exec R$ 18 (correção comercial 22/05/2026)
- Coffee Break Exec R$ 44 / Master R$ 50
- Auditório Exec 4h R$ 12 / 8h R$ 17 — pode ser ajustado, sempre confirmar
- Sem logística, sem taxa, sem linha de flores

**Coquetel Externos (sem cerveja / lata / long neck)**
- Basic 80 / 95 / 100
- Std 95 / 109 / 114
- Exec 115 / 130 / 135
- Master 130 / 145 / 150
- Premium 180 / 195 / 200

**Multiplicadores de reposição**
- +30% = janela de 1h30; +80% = +1 h; +150% = +2 h (teto do coffee)
- Inteli +60% fixo
- Coquetel base 2 h; +30% para 3 h; +80% para 4 h (teto)
- Acima do teto exige autorização do Bruno Brunelli

**Louças**
- Orçamento padrão já contempla louças padrão; louça/pratos e talheres linha premium é opcional (R$ 45,00/pax), aparece como opcional e não entra no total
- Louça premium só para almoço/jantar — não oferecer em coquetel

**Imposto**
- Pieggi paga 20% de imposto sobre a venda — em revenda de serviço terceirizado, o preço tem que cobrir custo + 20% + margem

---

### 1.4. Venda de item avulso (atualizado 24/09/2026)
- Em pedido de itens avulsos, café se vende por GARRAFA CHEIA (1,5 L), nunca fracionado por litro
- Se o volume não fecha em garrafas inteiras, arredondar o cenário PARA CIMA (ex.: 2 L → 2 garrafas = 3 L)
- Preços unitários fora das tabelas: Heineken lata R$ 9,50 · Coca-Cola lata R$ 7,50 · tábua de frios e tábua de queijos R$ 350,00 cada
- Pasta na tábua (catupiry, alho, mel e azeite) = R$ 210,00 por travessa
- Croissant de catupiry = R$ 5,00/un. (avulso)
- Suco na suqueira = R$ 100,00 fechado (não por litro)

---

### 1.5. Pipeline do PPTX (atualizado 09/09/2026)

**Arquivos e fontes**
- Template Pieggi_-_Proposta_-_Capitalismo_Consciente.pptx precisa ser reenviado a cada sessão — não persiste
- rebuild_v3.py fica em /home/claude/, tem os helpers reutilizáveis e nunca deve ser reescrito do zero
- Fonte principal de preço: Cardápio_Coffee_Break__Planilha_de_Custos.xlsx, aba "Produtos Pieggi" — única fonte de nomes, categorias e preços (markup 3×); nunca inventar item ou sabor; usar sempre a versão mais recente
- PDFs de preço Externos, StartSe e WTC coquetel são ZIPs com JPEGs e .txt de OCR — descompactar, não usar pdftotext; o Cardápio Coquetel PDF segue o mesmo formato

**Sequência validada**
1. cp template → /home/claude/
2. scripts/office/unpack.py
3. Editar sldIdLst em presentation.xml
4. add_slide.py para duplicar slides
5. Editar XMLs via Python + regex (helpers do rebuild_v3.py)
6. scripts/clean.py
7. scripts/office/pack.py --original template.pptx — obrigatório para preservar fontes (Constantia + Ethic New Extrabold)
8. scripts/office/soffice.py --headless --convert-to pdf → pdftoppm -jpeg -r 110–130 para conferência
9. Entregar via present_files

**Padrões de XML por slide**
- Slide 2 (dados): 6 linhas nativas na v3, sem Endereço. Para incluir, duplicar o `<a:tr>` da linha Horário; ajustar graphicFrame ext cy = nº de linhas × 324650 EMU
- Slide 3 (orçamento): altura padrão h="240000" (reduzir do default 295875). Valor total fragmentado em vários `<a:t>` — pôr o valor cheio no primeiro e apagar os demais. Cabem 8 linhas. Tabela não pode invadir o selo do rodapé
- Slide 5 (cardápio): caixa em off=(425177, 1320000), ext=(5500000, 3500000) comporta Master (7 seções), sz=950 títulos / sz=800 descrição. Executive (6 seções): off=(425000, 1480000), ext=(5200000, 3100000), sz=1000/850. Rodapé em ~y=4765000 EMU
- IDs no slide 4: id=2 (cabeçalho), id=10 (título do pacote), id=11 (lista), id=18/19/9/98/26 (remover), id=28 (foto → reposicionar x=6100000 y=2600000 cx=2700000 cy=1900000)

**Helpers do rebuild_v3.py**
- adjust_sp_geometry, adjust_pic_geometry, remove_sp_by_id, remove_pic_by_id, replace_title_block, replace_txbody_paragraphs, build_section, header_para, desc_para, sep_para, xml_escape, transform_card_slide()

**Bugs conhecidos**
- Ao editar o total ou qualquer sequência fragmentada de `<a:t>`, trocar fragmento por fragmento
- Ao clonar `<a:tr>`, remover os blocos `<a:extLst>` de rowId para não duplicar ID
- "&" no texto deve ser escrito como `&amp;` no XML

---

## PARTE 2 — PERFIL E CONVENÇÕES

### 2.1. Perfil (atualizado 28/07/2026)
- Fundador e dono da Pieggi Catering & Eventos, catering corporativo em São Paulo
- A Pieggi atende coffee break, happy hour, almoço/jantar e coquetel
- Hoje toca pessoalmente o financeiro e o comercial; a operação é tocada pela mãe dele e pelo Luiz
- A Pieggi também opera a Padeco, entidade de mão de obra contratada
- Pieggi fundada em 28/01/2020
- O nome Pieggi junta os nomes dos irmãos Pietra e Luiggi
- Comunica em português brasileiro informal

### 2.2. Convenções de documentos (atualizado 07/08/2026)
- Comandas e programação do evento em Word (.docx)
- Plaquinhas em PDF
- Nada de Excel para comandas ou plaquinhas
- Gerou uma comanda (Word) para evento OBRA MAX/StartSe
- Propostas comerciais em PowerPoint no modelo padrão Pieggi: capa, slide de dados (Cliente, Evento, Contato, Pax, Data, Horário), descritivo comercial em tabela (Descritivo / PAX / Valor + Total), um slide por serviço com o cardápio e contracapa
- Nos slides de cardápio os itens aparecem como "Item — N unidades" com a descrição abaixo; bebidas como último bloco
- Ficha de degustação = PDF impresso no padrão Pieggi: cabeçalho "PIEGGI | Ficha de Degustação · data", campos Nome e Empresa/Área, itens por seção em barra preta (Entrada, Canapés, Mini Pratos, Sobremesas/Café), nota 0–10 em bolinhas e linha de comentário por item, quadro "Impressão Geral" no fim (o que levaria / o que tiraria ou mudaria / comentários / assinatura); só itens degustados, sem bebidas nem decoração

---

## PARTE 3 — ÁREAS DA PIEGGI

### 3.1. Cardápios e pacotes (atualizado 09/09/2026)
- Almoços & Jantares em 2 formatos: Réchaud (clássico, louças individuais) e Volante 100% / Finger Food
- Executive Réchaud: 2 proteínas, 2 acompanhamentos/carboidratos, 1 massa, 1 vegetariano, 2 sobremesas; réchaud, equipe operacional, louças de serviço; NÃO inclui ilha de entrada
- Master Réchaud: 2 proteínas, 2 acompanhamentos, 1 massa, 1 vegetariano, saladas variadas, pães e patês, 2 sobremesas + ilha fria (tábua de frios e queijos, 4 canapés, terrine); inclui mesa posta e ilha de entrada; bebidas NÃO inclusas
- Executive Finger Food: 2 saladas em mini bowls, 2 principais em finger, 1 mini massa, 1 vegetariano, 2 sobremesas; serviço volante, louças finger food, equipe, reposição; NÃO inclui ilha fria, canapés premium nem mesa posta
- Master Finger Food: base do Executive + ilha fria (tábua de frios e queijos, terrines, pães e antepastos, 4 canapés premium), louças e equipe premium; NÃO inclui mesa posta nem réchaud
- Sobremesas exclusivas do Master: cheesecake de goiabada e de frutas vermelhas (o Master herda tudo do Executive)
- Bebidas do almoço/jantar: refrigerante em lata, água Minalba 500 ml, água na refresqueira, suco de laranja, suco de uva
- Avulsos "Boost your experience": tortas de palmito e frango (1,5 kg) R$ 240; quiches de alho-poró e espinafre (1,5 kg) R$ 225; caldos/cremes em panela 5 L (caldo verde, creme de mandioquinha com alho-poró, caldo de mandioca com calabresa) R$ 345
- Contato comercial no material: +55 11 94683-5321 / atendimento@pieggi.com.br
- Coffee Break em 4 categorias cumulativas: Basic, Standard, Executive, Master (Master = M+E+S+B)
- Blocos do cardápio de Coffee Break: mini lanches (brioche artesanal), tramezzinos, wraps, envelopes, salgados caseiros, barquetes de tapioca (sem glúten), shots funcionais e vitaminados, tarteletes doces, mini cups salgados, verrines, Pieggi Boards (8–10 pax), bolos inteiros (15–20 fatias), bebezinhos/cupcakes, mini doces extras (só Master) e complementos
- Rendimentos: café garrafa térmica 1,5 L ≈ 10 pax; suco e chá gelado na refresqueira 1 L ≈ 20 pax; porção de salada de frutas ≈ 40 pax; kit de chá e kit açúcar ≈ 10 pax; leite 2 L ≈ 10 pax
- Coquetel em 5 categorias cumulativas: Basic, Standard, Executive, Master e Premium
- Blocos do Coquetel: mini salgadinhos, mini pizzas, mini hambúrgueres, canapés Executive e Master, estações frias, pastas gourmet, terrines & burratas, tábuas frias (Standard e Master), brie Premium, mini saladas e massas Premium, doces no verrine e mini doces extras (só Master)
- Exclusivos Premium do coquetel: mini saladas e massas premium por porção/pax e brie folhado com caramelo salgado e nuts
- Rendimentos do coquetel: travessas de pasta gourmet, terrines e burratas ≈ 20 pax cada; estações frias com 400 g de pasta por porção; brie premium ≈ 20 pax
- Cardápio de Coquetel não traz bebidas — cerveja, refri, água e suco entram em linha à parte
- Brunch Standard (material 2025), 30 min a 1 h, formato fixo: 2 sabores de torta, 1 mini lanche artesanal, 1 quiche, mix de folhas, 1 refresqueira (laranja ou uva integral), guacamole com Doritos, homus com pão sírio, coalhada com quibe e crudité, salada de frutas, 1 tapioca doce e 2 doces no verrine
- Sabores do brunch devem chegar até 7 dias antes (ou a Pieggi escolhe)
- Tabela Alimentação (externa): Brunch Basic R$ 95/pax, Brunch Standard R$ 120/pax, Almoço & Jantar Executive R$ 150/pax, Master R$ 215/pax; +R$ 30/pax para finger food
- Brunch Basic: torta e quiche (1 sabor cada), barquete de tapioca, 1 lanche, guacamole, homus, coalhada, mix de folhas, salada de fruta, 2 doces no verrine e bebidas (refri 350 ml, água e suco na refresqueira); o Standard acrescenta tábua de queijos e frios com pães e patês, favo de mel e bolo
- Condições gerais: serviços de até 2 h, valores incluem insumos de montagem e descartáveis, visita técnica obrigatória; serviço estático (volante e empratado à inglesa são à parte)
- Sanduíche de pão de forma = tramezzino — nunca "mini sanduíche de pão de forma"
- Salgado caseiro frito (coxinha, risole, esfiha, bolinha de queijo) abaixo do padrão Pieggi, não entra em proposta — piso: tramezzino, pão de queijo, pão de batata, croissant, mini pizza, quiche e verrine

### 3.2. Vendas e clientes (atualizado 09/09/2026)
- Esforço contínuo de vendas e desenvolvimento de negócios
- Prefere mensagens de prospecção assertivas e estratégicas, sem tom carente ou emocional; costuma pedir várias versões com a lógica de cada uma
- Reativando leads frios: Multilaser e LINK
- LINK é empresa de eventos recorrente; busca parceria de longo prazo no modelo da StartSe
- Negociando contrato de catering do evento MAWWAL com a Simone
- StartSe é cliente recorrente, isenta de taxa de serviço e logística; também isentos: Inteli, IPT e WTC
- Alvos de prospecção: Meio & Mensagem (Prêmio Caboré), ESPM (parceiro de eventos recorrentes), RME/Rede Mulher Empreendedora, Gouvêa Experience (LATAM Retail Show)
- ZUP — negócio perdido; foco em manter relacionamento
- Redigidos contratos de catering avulso e recorrente
- Redigido follow-up financeiro à Alcon sobre pagamentos sem conciliação (NFs 1210, 1236, 1252, 1271, 1272)
- Duas landing pages: uma para contratos recorrentes, outra para eventos pontuais
- Celebrar (Juliana) — 27/08, 40 pax, Vila Olímpia/SP: coffee manhã Master, almoço finger food Executive, coffee tarde Master, coquetel Master com cerveja; tabela WTC; sem restrições. Bebidas inclusas no fechado por pax (inclusive cerveja). Tabela WTC só como referência, sem repasse dos 12%
- A Pieggi atende de evento pontual a parceiro full service de A&B; já operou full service na StartSe, no Inteli e no WTC (prova social)
- Board Program Turma 15 / Encontro 1 (StartSe, Gabi Pontes) — 3 dias em agosto a partir de 03/08, Auditório A, sem restrições: dia 1 (14h30) coquetel Grazing Table em 2 partes 40 pax + auditório executive 55 pax + taças R$ 450; dias 2 e 3 welcome 30 pax, coffee manhã e tarde executive 40 pax e auditório 55 pax (no último, sem balas e sem cápsulas). Proposta em PPT, tabela StartSe atual, sem slides de cardápio
- C&D Technologies (Adriana Antoneli) — 06/08, 9h–19h, Av. das Nações Unidas 12551: coffee Basic 20 pax, almoço Executive 25 pax, coquetel Basic com long neck 20 pax + 6 garrafas Casal Garcia e taças
- StartSe 29/07 às 15h, Sala da Diretoria (Mateus Schaumloffel / Stefany): pão de queijo, café e suco a R$ 15,00/pax
- Inauguração 07/08, 10h–13h, 50 pax, Rua Verbo Divino 680 (Debora): coffee Master + brunch Standard, tabela externa; Brunch Standard completo, Coffee Master a R$ 56/pax, reposição de 2 h
- Faz degustações presenciais com clientes para definir o cardápio
- Alura Signals Experience (Julieti Borba) — 60 pax, 8h–18h, CENU: 2 coffees Executive manhã + 2 tarde (R$ 5.280 cada bloco, R$ 44/pax); data mudou de 13–14/08 para 10–11/09 e entrou auditório nos dois dias
- Tabela StartSe: auditório Executive R$ 14/pax (usado também na Alura)
- CPAJ/Mackenzie (Andressa Lopes) — brunch 40 pax, 11/09 15h30–17h, Consolação: bebidas, salgados, doces + locação de mesas, xícaras e talheres; origem Google Ads (PMAX); 3 opções: Coffee Executive, Coffee Master e Brunch Basic
- Nórdica (Fernanda) — 50 pax, 10/09 8h–12h, Av. das Nações Unidas 12.551, 6º andar, Sala Brooklyn: café da manhã Standard 8h–9h R$ 2.575, serviço de sala Executive 8h–12h R$ 800, mesa montada após o atendimento; Mini Coffee Basic às 10h (pão de queijo, café, leite, chá, água saborizada, kit açúcar/achocolatado)
- Tabela WTC: Mini Coffee Basic R$ 18/pax
- TOTVS (Ariane) — 21/08, 130 pax, 10h30–11h, na StartSe: coffee Executive e Master como duas opções, tabela StartSe, com slides de cardápio
- Asaas "Noite de Pastéis" (Julia, Compras) — 20/08, budget R$ 2.600, pax a confirmar: mini pastéis 6 sabores salgados (2 veg/vegano) + 2–3 doces e caldo de cana (negociável)
- Universal Assistance (Davi Vidal) — Expo Center Norte, 300 pax/dia em 30/09, 01/10 e 02/10, avulso sem reposição: A Tradicional (água garrafinha + saborizada + café térmica) ~R$ 31.786 e B Expresso (água + máquina + cápsulas) ~R$ 75.190; 10% de taxa sobre café e água; PPT
- GO Bravo — degustação na sede em 07/08, 4 pax, 13h30: burrata, canapés (bruschetta de carpaccio, tartelete ricota/espinafre/mel trufado, bruschetta de salmão), mini pratos (salada baby, cuscuz marroquino, ravioli de queijo), sobremesas (tortinha de limão, brigadeiro), café e petit four
- Ago/2026: StartSe (Tom) propôs redução de 10% no preço
- Reajuste com a StartSe sempre pelo IPCA; em 2026 a Pieggi ofertou 5%, compras não aceitou e a Pieggi manteve o valor
- Desde o reajuste de 2024 o IPCA acumulado é de quase 10%
- A StartSe passou pelo processo do Grupo Alun, que mudou a relação
- Prazo StartSe: primeiro NF do dia 20 a 30 emitida no dia 1º com 30 dias; depois fechamento do mês com 45 dias — a Pieggi banca ~50 dias
- Nas águas, a Pieggi investiu o período todo e repassou só o custo, sem logística
- StartSe 2026 até julho: R$ 1.165.675,00 em 159 eventos
- Contraproposta pretendida à StartSe: preço congelado por mais 12 meses e emissão de NF de produto + NF de serviço, gerando crédito dos dois lados
- Tabela StartSe: Coffee I R$ 37, II R$ 40, III R$ 44, IV R$ 50 (com favo de mel); auditório 4h R$ 10 e 8h R$ 14; welcome R$ 18/pax por 30 min (não pode ser contratado sozinho); Coquetel I R$ 82 sem cerveja / R$ 95 com, II R$ 110 / R$ 120, III premium R$ 127 / R$ 138, Pizza R$ 126 / R$ 138; taças R$ 350 (40 pax), R$ 450 (70 pax), R$ 600 (100 pax); vinhos e espumantes R$ 85/garrafa
- Preço base dos demais clientes é 16% acima da tabela StartSe; a Pieggi cobra 10% de taxa de serviço para dividir a NF em 90% produto / 10% serviço; a StartSe é isenta dos dois
- A StartSe é um grupo grande, com várias empresas
- Celcoin happy hour interno (Melissa) — 10/09, perto do Shopping Eldorado, ~120 pax, 17h/17h30–20h: budget R$ 5.000, sem garçom, opção sem glúten; chopp e não alcoólicos por conta do cliente
- Cubo Itaú — 28/11 (estimado), 300 pax: coffee manhã + tarde + happy hour sem álcool; orçamento all-in (impostos, taxas, NF); budget R$ 85–90/pax para os 3 serviços, ~30 min por período; pax da tarde deve cair. Formato híbrido: pacote fechado nos coffees e HH por unidade/pax. Cardápio ancorado pra baixo (salgado caseiro forte): R$ 28 manhã + R$ 26 tarde + R$ 36 HH = R$ 90/pax
- Princípio comercial: em budget apertado para cliente que já consome, rebaixar o cardápio junto com o preço — cardápio normal a preço reduzido vira a nova régua do cliente; a saída é pacote popular nomeado como formato reduzido, com condição amarrada a volume e data

### 3.3. Expansão e sociedade (atualizado 25/08/2026)

**Contexto**
- Avaliando duas possíveis parcerias/sociedades para expandir; acha as duas boas, mas teme perder foco
- Receio de choque cultural: a Pieggi é empresa familiar e os potenciais sócios também têm receio

**Frente B2C — quiosques e cantinas**
- Proposta de uma Pieggi B2C com quiosques e cantinas, com um amigo investidor
- Conversa inicial com a FIAP para uma cantina a médio prazo
- O investidor está fechando um fundo numa marca de proteína e exige não concorrer com ela — possivelmente determinante para inviabilizar
- Ainda não há produto nem cardápio formatado para franquias e lojas físicas

**Frente B2B — comercial**
- Possível parceria com o André em vendas/comercial; ele quer criar uma frente educacional para eventos; preocupação de fugir da alimentação

**Alternativa considerada**
- Dividir: sociedade B2B com o André e B2C com o outro amigo

**Tese de posicionamento**
- Tornar a Pieggi a marca de referência do B2B em alimentação (benchmark de marca: Welucci/Bisutti)
- Cogita usar parte do lucro do negócio do André para financiar a construção de marca
- Acredita em founder-led growth — "as pessoas compram de pessoas"; ele mesmo estrutura os eventos e toca o Projeto CFO
- Vê a frente educacional como posicionamento para as duas partes
- Sócio da StartSe (Caio) quer sair; a ideia é os dois criarem uma agência de produção de eventos, com o Caio no operacional dela (não na Pieggi)

**Modelo do André (educacional/comunidade)**
- Hoje cobra MRR de produtores de evento e vende as cotas de patrocínio deles; o dinheiro está nas marcas
- Quer criar uma comunidade de produtores com entregável no topo do funil
- Com base grande de eventos, chega às marcas com algo tipo JBP alinhado às dores delas
- A marca paga MRR e ganha desconto nas cotas; o André fica com uma parte
- Pode cobrar MRR do organizador — Bruno ensinando a produzir e André a vender
- Bruno seria o conteúdo/autoridade do topo de funil, por produzir o CFO

**Histórico**
- Bruno, Caio e André já trabalharam juntos

**Finanças e concentração**
- A StartSe concentra muita receita — concentração de receita e de crédito ao mesmo tempo
- A Pieggi tem caixa e recebíveis para bancar frente nova sem capital externo
- O CFO Insights é do Eric; Bruno leva a competência de produzir e a relação, não a marca
- Caixa livre, sem adiantamento de evento não entregue (zero float)

**Societário e governança**
- Cap table dividido entre Bruno, Luiz e a mãe dele
- Bruno não tocava o operacional — era o Luiz, hoje um ponto morto que não entrega
- A Pieggi perdeu a Inteli por atendimento abaixo do esperado, sob a operação do Luiz
- Precisa ajustar processos internos e de rua
- Adriana é a coordenadora de rua; entrega e faz o que ninguém faz, mas há um problema de cultura
- Cogita redesenhar as quotas; acha injusto o Luiz manter fatia grande sendo ponto morto
- Não há restrição real de manter o cap table fechado — entrada de terceiro está sobre a mesa

### 3.4. Financeiro — planilha COMPETENCIA.xlsx (atualizado 25/08/2026)
- 4 abas: DRE, Resumo dos eventos, Controle de Despesas e Forecast - Mão de Obra
- "Resumo dos eventos" = base de receita: uma linha por evento, com Mês de Competência, Valor da Venda, Imposto Retido na Fonte (6,15%), Custo Estimado e status de recebimento/NF
- "Controle de Despesas" = base de gastos: Data, Fornecedor, Categoria, Valor, Forma de Pagamento, Competência, Banco e Empresa (Pieggi / Padeco / Bruno)
- DRE mensal por competência (jan–dez), com Meta, Realizado e Ano
- Pediu análise "como CFO", buscando furos, gastos no detalhe, competências erradas e fórmulas quebradas
- Pediu a versão corrigida: resumos por SUMIFS (Categoria + Competência), receita/retenção por SUMIF no mês de competência, coluna Ano padronizada (acum. jan–jul) e categorias padronizadas
- Foi montado um dashboard financeiro em HTML; risco de concentração de receita na StartSe sinalizado

### 3.5. Base de notas fiscais (atualizado 20/08/2026)
- Faturamento por evento no arquivo "RELATÓRIO NFS - BASE EVENTOS.xlsx", abas Pieggi e Padeco
- O ano de 2025 começa na NF 656
- A partir da NF 656, todo evento da StartSe aparece como StartSe no campo CLIENTE

### 3.6. Fiscal (atualizado 21/08/2026)
- Planilha de classificação fiscal com ~376 itens (Coffee Break, Happy Hour, Almoço/Jantar), com colunas de custo e preço de venda sem interferir nos campos fiscais
- Adriana e Valéria devem fornecer custo de ~36 itens faltantes
- Pieggi no Lucro Presumido, PIS/COFINS 0,65% / 3,00%
- Adotada a Opção A (Regime Especial Dec. 51.597/2007) para ICMS; parametrização do ERP pendente de validação do contador
- Contador confirmou alíquota de 4% (não 3,2%), CFOP 5101 (não 5102), cBenef obrigatório desde abr/2026 e obrigações de IBS/CBS a partir de ago/2026
- Ago/2026: pretende separar o faturamento em NF-e de produto (alimentos e bebidas, ICMS) + NFS-e de serviço (mão de obra e organização, ISS), começando pela StartSe
- Campos por item: NCM, CFOP, CST, ICMS, PIS/COFINS
- Contador devolveu a planilha com IBS/CBS e correções de NCM; o fornecedor do ERP precisa habilitar os campos novos

### 3.7. Identidade visual (atualizado 20/08/2026)
- Materiais no KV da marca, referência PIEGGI-INSTITUCIONAL.pdf
- Paleta: preto #000000 dominante, off-white #F2F3F4 de fundo, cinza-azulado #7D8590 de apoio e verde #006553 como acento
- Tipografia: palavra pequena em serifada regular + palavra principal em serifada itálica bold caixa alta; rótulos em sans caixa alta espaçada; corpo em serifada
- Ativos: wordmark PIEGGI com selo PG, lockup "CATERING, COFFEE & EVENTOS" e selo circular P como marca d'água
- Contato institucional: Bruno Brunelli, (11) 99204-6070, @pieggieventos, assinatura "Seu evento com sabor e excelência"
- Clientes no institucional: Oracle, Neon, Alcon, Bayer, Gupy, F1, WTC São Paulo, StarkBank, StartSe, ZUP, NVA Capital, Inteli e Patria

### 3.8. Gerador da sede (atualizado 29/07/2026)
- Precisa de gerador por risco de falta de energia (El Niño), com 1 a 2 dias de autonomia
- Avaliando Toyama TDG8500SLE3DXP (7,5 kVA trifásico 220 V, cabinado, diesel) — Loja do Mecânico
- E Toyama TDWG12000SGE3D-N (12,5 kVA trifásico 220 V, cabinado, refrigerado a água)
- Na queda de energia só precisam rodar refrigeração (câmara fria/freezers) + iluminação + tomadas — sem forno combinado elétrico nem ar-condicionado

---

## PARTE 4 — PROJETO CFO / CFO INSIGHTS (atualizado 21/08/2026)
- Coordena o "Projeto CFO" com várias frentes: venda de patrocínio, venda de ingressos e curadoria
- Colaboradores: Daniela Pomin (marketing) e Berger (tráfego pago)
- CFO Insights: conferência no Vibra São Paulo, ~5.000 lugares
- Estratégia integrada: calendário orgânico, direção criativa Meta Ads, sequências de e-mail, roteiros de vídeo e briefings de design
- Carrosséis de LinkedIn para CFOs (reforma tributária, IA para CFOs)
- Materiais de preparação para convidados de podcast (Netsoft Brasil, ECX Pay)
- Produz conteúdo sob a marca CFO Insights: podcasts, carrosséis e newsletter para executivos financeiros
- Prefere conteúdo de alto sinal, orientado a dados e frameworks práticos
- Eric é o CEO/cliente que decide sobre o evento — aprova verba e define o responsável por convites/cortesias
- Tráfego pago ~R$ 2.000/dia; reporte semanal de investido × vendido ao Eric
- Usa a Apollo.io para acionar cortesias e encher a casa
- Neofin patrocina; Laura palestra 25 min na tarde do 2º dia (gestão de cobrança / inadimplência e crédito)
- Marketing Neofin: Karoline Saraiva e Milena Canteli (time do Gabriel); Andressa é o contato Pieggi para patrocinadores
- Padrão: apresentações 10 dias antes, palestrante 1 h antes, vídeo institucional de até 1 min, mesa reservada com prisma e arte aprovada
- Público do ano passado: ~70% coordenadores, gerentes e diretores financeiros de médias empresas (R$ 50 mi a 1 bi)
- Comunidade de CFOs com ~500 participantes
- Bruno é prestador de serviço — marca, evento e comunidade são do Eric
- Quer criar evento próprio e tem liberdade para produzir no mesmo nicho
- Reunião comercial 10/08: patrocínio ~R$ 950 mil; grandes contas (EQ, Conta Simples) declinaram; pipe de ~5 contatos de R$ 20 mil
- Break-even: faltam ~10 cotas de R$ 20 mil — com ~20% de conversão, ~50 leads, fechamento até a semana do dia 4 (ciclo <2 semanas)
- Projeção 10/08: ~R$ 200 mil negativo com custo de pessoas (positivo sem); expectativa de ~R$ 100 mil negativo
- Frentes: André Lara vende patrocínio (5 toques/10 dias); Bruno faz cadência Apollo de ingressos e carrinho abandonado com cupom em nome de patrocinador; Ian trabalha DM; Léo executa e-mails e site/LP
- Cortesias: 7 por palestrante (2 VIP + 5 time), 20 palestrantes; patrocinadores ~400; ~115 inscritos até 10/08
- Criativos campeões: estáticos (carrossel fundo branco com palestrantes e rosto do Eric); vídeos saturaram; patrocínio com R$ 100/dia para o formulário
- Terceira cadência "alumni": participantes de 2025 que não compraram 2026, 30% off
- Weekly 11/08: custo ~R$ 656 mil, meta R$ 650 mil para 500 pessoas; evento dias 22 e 23 no Vibra
- Time: Tatiana Libois (contratos/fornecedores), Andressa (patrocinadores/atendimento), Danielly Cordeiro (artes/produção); Bruno diretor de palco
- Desconto de R$ 15 mil no audiovisual em troca de câmeras da Soluta; kit do participante a R$ 5/un.
- 118 inscritos em 11/08 (19 VIPs); cenário VIP factível 80–100
- Buffet Pieggi em linha econômica: coffee com Belvita/bolacha/fruta no fim de cada dia, almoço VIP em bowls ~100 pessoas, coquetel para ~400–500 sem canapés; referência ~R$ 40 mil (ano passado, só coffee)
- Reunião de contenção após o credenciamento; prazos: água (500 pax) e jantares até 14/08, iluminação/Hider até 17–18/08
- Bruno recebe o pagamento em 10/10 e não fará a próxima edição
- Reunião 17/08: plano de cortesia SUSPENSO, foco em venda direta e tráfego; categorização de convidados congelada (dependia do Eric e do CS: Brian, Amanda, Juliana, Sandra, Guto)
- Elvis Labrozzi assumiu o texto do plano de cortesia
- Gargalo: conversão no checkout (~1%) e falta de rastreamento no botão, sem remarketing; CPC estável
- Semana 10–16/08 marginalmente positiva (~R$ 29 mil investido × ~R$ 34 mil receita)
- Berger com autonomia para escalar verba, responde pela meta com o Eric
- Volta ao Kiwify (~R$ 300/dia) com webhooks e Kanban para carrinho abandonado, boleto e cartão recusado; checkout pré-populado só em teste com orçamento baixo
- Weekly 17/08: credenciamento R$ 30 mil para 650 pessoas (de R$ 34.190); crachás 1.000 un. com IBC/Solutta (10 dias); estandes de R$ 42 mil para R$ 36 mil; ar-condicionado R$ 18 mil; ambulância R$ 1.200; 3 micro-ônibus a R$ 2.200; recepcionistas R$ 350/diária
- Reunião 21/08: mídia migra do LinkedIn pago para Google Ads (LinkedIn só orgânico no perfil do Eric); ~R$ 17 mil/dia em tráfego, menos nos fins de semana
- Alessandra Ramos entrou (tráfego/marketing/base); Lucas Albert faz criativos; Elvis Labrozzi apresenta o plano na segunda 10h30
- Base de 40 mil contatos via WhatsApp (templates "utility", até 10 mil/dia) + e-mail, em dois tiers (VIP e geral com cupom)
- Rastreamento na nova plataforma (QFI) com UTMs, tracking instalado pelo Berger
- Foco em pessoa física, não B2B (StartSe RH B2B ~1% × curso PF 15% e R$ 5 mi a R$ 9–10 mil)
- Em aberto: grupo de networking com assinatura anual de R$ 70 mil (Berger) e pitch de vendas no palco
- Operação: sacolas do kit pela Beluno; água em copinhos no lugar de galões; credenciamento com balcões; guia do patrocinador adiado de 20 para 31/10; RSVP do workshop por conta do cliente/entrevistador
- Edição: CFO Insights | AI Edition 2026, 22–23/09 no Vibra São Paulo
- Ian Ruiz trabalha leads de DM; Vanessa Pomin é stakeholder interno
- Patrocinadores/logística: Neofin (talk da Laura) e Make Value/Tesouraria Produtiva

---

## PARTE 5 — PESSOAS

- **Luiz Antonio Portas Hermida** (atualizado 01/09) — operação externa da Pieggi; representante legal da Pieggi Eventos LTDA, quem assina os contratos
- **Débora Stela Colette** (atualizado 01/09) — sendo contratada como PJ (empresa individual) para o financeiro da Pieggi, via contrato de apoio administrativo-financeiro
- **Adriana** (atualizado 21/08) — cardápios/produção; coordenadora de rua; deve fornecer custos faltantes da classificação fiscal
- **André** (atualizado 21/08) — amigo, vende patrocínio para feiras, negócio próprio rentável; fala com a persona do Bruno e com diretores/CEOs; ajudaria a Pieggi no comercial; quer frente educacional para eventos
- **André Lara** (atualizado 21/08) — vende patrocínio no Projeto CFO (5 toques/10 dias)
- **Eric** (atualizado 21/08) — CEO/dono da marca, evento e comunidade CFO Insights; aprova verba e cortesias; recebe reporte semanal de tráfego
- **Alessandra Ramos** (atualizado 21/08) — entrou no Projeto CFO; tráfego/marketing, migração para Google Ads, posta no LinkedIn do Eric, organiza criativos e trabalha a base
- **Jhonatan Berger** (atualizado 17/08) — tráfego pago do Projeto CFO
- **Caio** (atualizado 28/07) — sócio da StartSe saindo; ideia de agência de produção de eventos com ele no operacional

---
*Fim do arquivo.*
