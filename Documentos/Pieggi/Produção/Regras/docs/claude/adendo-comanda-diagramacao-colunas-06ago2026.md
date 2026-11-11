# 🖨️ ADENDO 06/08/2026 — DIAGRAMAÇÃO: LARGURA DAS COLUNAS (.docx)
### Colar na configuração do **Claudinho COMANDA**
*(Complementa §13 e §20.9. Nasce de um erro real: a coluna RECEITA/DESCRIÇÃO saiu espremida.)*

## 1. O ERRO QUE NÃO PODE REPETIR
Ao gerar o .docx com python-docx, definir só a largura das células (`cell.width`) **NÃO basta**: o Word/LibreOffice usa o `<w:tblGrid>` do arquivo. Se o `tblGrid` não for reescrito, ele divide as colunas em **partes iguais** e a **RECEITA/DESCRIÇÃO (a coluna mais importante) fica espremida (~1,8")**.

**Correção obrigatória:** sempre reescrever o `tblGrid` (os `<w:gridCol w:w="...">` em twips) com as mesmas larguras das células, além de `tblLayout=fixed`.

## 2. LARGURAS PADRÃO (A4, margens 720 — largura útil 7,27" = 10466 twips)
**Tabela de PRODUÇÃO** (Cozinha Quente/Fria/Confeitaria) — ☐ | QTD | RECEITA/DESCRIÇÃO (conforme manual) | CÓD:
- ☐ 0,42" · QTD 1,20" · **RECEITA 4,30"** · CÓD 1,35"

**Tabela de EXPEDIÇÃO** — EXP ✓ | COP ✓ | QTD | DESCRIÇÃO | ITEM:
- EXP 0,36" · COP 0,36" · QTD 0,85" · **DESCRIÇÃO 4,10"** · ITEM 1,60"

Referência dos modelos antigos do Bruno: RECEITA ~4,2" (6066 twips). A RECEITA/DESCRIÇÃO é sempre a coluna MAIS LARGA depois do cabeçalho.

## 3. CHECKLIST
Reescrevi o `tblGrid` (não só `cell.width`)? RECEITA/DESCRIÇÃO ≥ 4,1"? `tblLayout=fixed`? Renderizei em PDF e conferi que o texto do item cabe em ~2 linhas (não 5–6)?
