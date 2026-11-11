# Situação do sistema frente à especificação de 05/11/2026

Referências: briefing inicial do Bruno e *Pieggi — Especificação do Sistema de Operação de Eventos* (texto em `docs/especificacao-2026-11-05.txt`). Situação em 09/11/2026.

Legenda: ✅ pronto e testado · 🟡 pronto com valor provisório ou limitação · ❌ falta

## 1. Arquitetura

- ✅ **Regra só no backend.** As 38 funções e os triggers PL/pgSQL foram reescritos em TypeScript (`apps/backend/src/dominios`). A migration `20261109100000` remove a lógica do banco; o teste de integração falha se alguma função voltar ao schema `pieggi`.
- ✅ **Valores como dado.** 217 regras versionadas (preços, multiplicadores, gramaturas, roteamento, selos, traduções, textos fixos, lista negra, vocabulário travado), editáveis na tela *Regras e cardápio*, aplicadas pela data do evento (Caso 7 testado de ponta a ponta).
- ✅ **Migrations sem SQL Editor:** `npm run db:migrar`. Todas idempotentes (testadas aplicando 2× num Postgres descartável).
- ✅ Testes: 115 de unidade (inclui os 8 casos de aceite da §15 com os números exatos) e 33 de integração com banco real.

## 2. Módulos

| Módulo | Situação |
|---|---|
| 1 · Catálogo e precificação | ✅ 137 itens com EN/ES, selo, estação e fornecedor preenchidos; tabelas Externos/StartSe-Atual; taxa, logística, isenções, mínimo 20 pax, reposição, CMV 30%/33,3%, desconto 5%, avulsos, Lunch Box |
| 2 · Proposta | ✅ fluxo em 4 passos com cardápio sugerido, gates da §5, confirmação explícita, versão aprovada = descritivo travado, .pptx (StartSe sem valor por pessoa, alcoólicos em bloco separado, "R$ a definir") · 🟡 layout próprio preto e branco até chegar o template oficial |
| 3 · Programação | ✅ gerada pelo motor a partir da proposta aprovada, todas as linhas (coffee, welcome, auditório, coquetel/HH, almoço/jantar, brunch, lunch box), regras de sabor, rodízio de suco, .docx no layout da spec com checklist das copeiras · sobrescrita manual auditada |
| 4 · Comanda | ✅ fidelidade à programação, 6 páginas/dia com cores, página única da Adriana, roteamento por estação e fornecedor, materiais por item, expedição em litros, comprados prontos, APOIO E IDENTIFICAÇÃO, StartSe × demais, almoço/jantar (peso pronto, molho, pudim, amostra), verba 8% |
| 5 · Plaquinha | ✅ PDF A4 2×3 com dobra 50/50, hierarquia título/subtítulo, selos, dedup por dia, agrupamentos, par "Visite nosso site" com QR · bloqueia geração se faltar tradução |
| 6 · Compras e estoque | ✅ insumos por setor, fornecedores com prazo e pedido mínimo, ficha técnica, explosão corrigida pelo rendimento, pedido semanal consolidado (PDF/XLSX), cotação comparativa, entrada de notas em lote com sugestão por apelido, custo médio → CMV do cardápio, baixa na expedição, devolução, inventário, alertas |
| 7 · Freelancers | ✅ cadastro com CNPJ/PIX cifrados, diária por função congelada no lançamento, escala por evento, verba × custo com alerta, relatório (XLSX/PDF), CSV de PIX em lote, fechamento travado e auditado, custo no evento |
| Briefing inicial | ✅ CRM/funil, contrato, checklist com evidência, três conferências, acesso de campo temporário, balanço/remanescentes, contas a receber, NPS, NF-e de produto |

## 3. Valores provisórios que dependem da Pieggi

O sistema funciona com eles e avisa em cada cálculo. Responder = salvar nova versão na tela **Regras e cardápio**.

| Regra | Pergunta | Provisório |
|---|---|---|
| `qtd.bebidas.aplica_reposicao` | Bebida recebe ×1,6 com reposição? | Não |
| `almoco.folga_arredondamento` | 35 pax: folga arredonda para cima ou baixo? | Cima (37) |
| `almoco.pudim_base_pax` | Formas de pudim pelo pax real ou de cálculo? | Cálculo |
| `almoco.amostra_vigilancia_horas` | Amostra da Vigilância: 72 h ou 96 h? | 72 h |
| `qtd.cupcake.split_master` | Master 60% + 30% = 90%: o que são os 10%? | 60/30 |
| `qtd.tabua.STANDARD` / `MASTER` | g/pax e proporções das tábuas | 6 g/pax |
| `qtd.frutas_laminadas` | g/pax das laminadas | 50 g |
| `pacote [WELCOME]`, `pacote [BRUNCH]`, `bebidas.padrao [BRUNCH/ALMOCO/JANTAR]` | Composição por tier | ver tela |
| `preco.avulso.CAFE_GARRAFA` | Preço da garrafa de café 1,5 L | R$ 78 |
| `tabela_preco.padrao [INTELI]` | Inteli usa a tabela StartSe-Atual? | Sim |
| `programacao.padroes` | Saída da sede quantos minutos antes; roteiro padrão de campo | 120 min |
| `freelancer.diaria` (por função) | Diária padrão de cada função | Copeira 200 · Garçom 220 · Cozinheiro 300 · Auxiliar 180 · Motorista 250 |
| `compras.*`, `estoque.validade_alerta_dias` | Alertas de variação de preço, validade, CMV, custo financeiro | 10% · 3 dias · 32% · 2%/mês |

Decisões tomadas onde a spec estava ilegível ou ambígua (revise): auditório contratado = 150 ml café × pax × períodos + 1,5 água sem gás + 1 com gás; cortesia = café + água na refresqueira; períodos = horas ÷ 4; cup cake com 1 sabor com chocolate + 1 sem por período; forno, gelo, kit e uniforme sempre para quem não é StartSe; página da Adriana lista Letícia, Leal e POP VEGAN.

## 4. Dados que ainda faltam (bloqueiam só o que dependem deles)

- Preços das tabelas **StartSe-Negociação** e **WTC** e do **Coffee Standard/Basic** (PDFs em imagem).
- Cardápios de **Coquetel/HH, Almoço/Jantar e Brunch** por tier (PDFs em imagem): hoje o motor calcula as quantidades dos itens escolhidos, mas não sugere o pacote dessas linhas.
- **Fichas técnicas** e cotações: sem elas o CMV usa o custo da planilha e o estoque não sabe o que baixar.
- **Template oficial .pptx**: as constantes de layout estão isoladas em `proposta-pptx.ts` para a troca.
- Selos vegano/vegetariano em imagem (hoje vetoriais) e uma programação/comanda real em .docx para conferência fina.

## 5. Limitações conhecidas

- Locações extras não têm cadastro: a página da Adriana sai "Não solicitado".
- Restrições alimentares entram no cabeçalho e no orçamento, não como item calculado por serviço.
- Catálogo não é versionado (regras são): desativar um item pode mudar a programação de um evento passado se ela for regerada.
- Assinatura eletrônica, boleto, NFS-e e envio automático: dependem de provedores ainda não escolhidos.
- Modo offline no celular, homologação separada e backup com restauração testada: infraestrutura, fora do código.
- A validação automática de render confere estrutura (tamanho, margens, tabelas que não quebram, fontes mínimas, textos proibidos); não rasteriza páginas, porque o servidor não tem LibreOffice.
