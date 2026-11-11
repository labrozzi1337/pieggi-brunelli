# ASAAS — 16 Anos — ENTREGA (delivery) — 17/09/2026 — decisões da comanda

**Programação:** `Pieggi Programacao - ASAAS - 16 Anos - Entrega - 17092026.pdf` — v1, 11/09/2026.
**PAX:** 100 · **Entrega:** tarde, horário a confirmar (HORA DE SAIR em branco, preencher à mão).
**Endereço e contato:** em branco na programação — campos a preencher à mão.

## Decisão-mãe do Bruno (11/09)
> **"tudo na planilha, arruma todo enunciado"** — em divergência entre a TABELA DE ITENS e o CHECKLIST
> da programação, **vale a tabela**. Os enunciados do checklist foram reescritos para bater com ela.

## Divergências resolvidas por essa regra
| Item | Checklist (descartado) | **Vale (tabela)** |
|---|---|---|
| Salgados da Letícia | 240 (60 de cada tipo) | **140** — 70 coxinha + 70 bolinha de queijo |
| Mini pão de cachorro-quente | 45 un | **não entra** (sem linha na tabela) |
| Brigadeiro | 50 un | **60 un** (total 110 docinhos) |
| Batata palha | citada em amarelo | **não entra** (sem linha na tabela) |
| Condimentos | catchup, maionese e mostarda | **catchup Heinz + pimenta Tabasco**, 1 de cada |
| Mini quiches | texto dizia "Letícia" | **Confeitaria Pieggi** — vale a coluna ITEM da planilha |

## Escopo pedido pelo Bruno
- **Sem página da Adriana** · **sem Expedição–Bebidas** · **sem Expedição–Estrutura**.
- **"por imagens"** — imagens do bolo e dos docinhos dentro da comanda, na **Confeitaria**.
- Cozinha Quente e Cozinha Fria **omitidas** (nenhum item).

## Estrutura entregue — 3 folhas, 1 .docx
1. **CONFEITARIA** (azul #1F4E79) — bolo, 110 docinhos, 2 mini quiches, mini enroladinho.
2. **CONFEITARIA — REFERÊNCIA VISUAL** (anexo) — foto do bolo com a folha de arroz ASAAS 16 anos
   e foto da montagem dos 110 docinhos, em tamanho grande.
3. **EXPEDIÇÃO — ALIMENTAÇÃO** (roxo #6B21A8) — 5 seções: Confeitaria Pieggi · recebimento Letícia ·
   mercado/condimentos · descartáveis · nota de refrigeração e transporte.

## Aprendizados de layout (reutilizar)
- **Imagem grande não cabe dentro da linha do item** sem estourar a folha do setor. Solução validada:
  manter a folha de produção completa e criar uma **página anexa "REFERÊNCIA VISUAL"** do mesmo setor,
  com as imagens em 4,9" (bolo) e 6,5" (docinhos). Cumpre o §0 (nada de dia misturado) e preserva a foto legível.
- Imagens da programação extraídas com `pdfimages -png` (PyMuPDF não está disponível no ambiente de nuvem);
  o **selo Pieggi** também sai do próprio PDF da programação (primeira imagem da página 1).
- Para caber 1 folha por setor: descrição do item em **parágrafo único** (nome em negrito + descrição no mesmo
  parágrafo) economiza ~1 linha por item; `cell_margins` 22 dxa; banner final como última linha mesclada da
  própria tabela em vez de tabela separada.

## Adaptações de comanda de ENTREGA (delivery, sem copeiras)
- Colunas da Expedição: **EXP ✔ / CAIXA ✔** (não há copeira para ticar).
- Banner vermelho no topo das duas comandas: "tudo sai PRONTO e conferido, em caixa fechada, refrigerado;
  nada é finalizado no cliente".
- Regras de fechamento no lugar da regra da copeira: conferir item por item antes de fechar a caixa ·
  caixinha vazia = faltou, NÃO fechar · fotografar as caixas fechadas e enviar ao Luiz (11) 97603-8194 ·
  confirmar o recebimento com o responsável no local antes de sair.
- Cake board 30x40 cm e forminhas azul royal 4 pétalas entram junto do item na Alimentação
  (não há comanda de Estrutura).
