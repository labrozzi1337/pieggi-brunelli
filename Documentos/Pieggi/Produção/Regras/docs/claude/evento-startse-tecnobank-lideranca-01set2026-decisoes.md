# 📌 EVENTO StartSe — TECNOBANK · PROGRAMA DE LIDERANÇA I (01/09/2026)
**Decisões do Bruno em 26/08/2026. Comanda gerada: 6 comandas / 9 páginas.**

## Dados
Cliente **StartSe** · Evento **Tecnobank — Programa de Liderança I** · Contato **Giuliane Muniz**
Local: CENU Torre Norte, 9º andar — **Auditório C** · Welcome 35 pax (montado 08h15) · Coffee III 40 pax (11h00–11h20)
Orçamento R$ 2.390,00 → **Verba do evento: R$ 191,20**

## Decisões do Bruno (valem como precedente)
1. **SAÍDA ÚNICA às 06h00** cobrindo Welcome + Coffee do mesmo dia/local — em vez de duas faixas (05h15 e 08h00). Mesmo padrão do Alest: quando os serviços são no mesmo local e no mesmo turno, ele consolida a saída.
2. **ZERO água mineral** — Welcome sem água (definido antes), Coffee III sem garrafinha e sem serviço de auditório contratado. Linha explícita "ÁGUA MINERAL — NÃO ENVIAR" na comanda de Bebidas, para ninguém achar que foi esquecimento.
3. **Gelo = do local** (StartSe). Não enviar, mesmo com suco e chá gelado.
4. **Açúcar e adoçante do WELCOME entram** mesmo sem constar na programação: 1 sachê por dose de 100 ml de café → café 1,75 L ≈ **18 açúcar + 18 adoçante**.
5. **Shot Pink Fresh → CUP MINI DE VIDRO** (confirma a regra padrão; o copo acrílico 65 ml do Alest foi exceção daquele evento). Quantidade usada: **27** (24 shots + reposição), não 1,1 × pax.
6. **Envelope Gourmet = MONTAGEM NO LOCAL.** A Cozinha Fria manda os componentes separados e embalados (pão folha, pasta mix de queijos, uvas, cenoura ralada, rúcula, azeite, pimenta-rosa, mel, mini pregador, alecrim) — copeiras montam e fecham com o pregador na hora. Uvas e rúcula murcham se montar cedo.
7. **Pão folha → COMPRA MERCADO** (não é produção interna, não é Letícia, não vai na página da Adriana).

## 🍮 FICHA — VERRINE DE BISCOFF DESCONSTRUÍDO (by Luiggi)
Fechada pelo Bruno em 26/08. Recipiente: **copo bolha**, não encher até a boca.
Ordem das camadas, de baixo pra cima:
1. **Creme leve de iogurte**
2. **Doce de leite**
3. **Crumble de Biscoff** por cima
❌ **NÃO vai biscoito Lotus inteiro** (encarece) — a arte promocional mostra o biscoito, mas na produção ele não entra.
Gramaturas ainda a confirmar — enquanto isso, "conforme ficha do encadernado".

## Roteamento aplicado
- **Cozinha Quente OMITIDA** (nenhum item quente).
- **Cozinha Fria:** 2 mini lanches (montados) + Envelope Gourmet (componentes separados).
- **Confeitaria:** petit four salgado e 2 doces (Welcome) · pão de batata de calabresa · verrine Biscoff · shot Pink Fresh (vegano, amarelo) · 2 bebezinhos já recheados · salada de frutas.
- **Pão de queijo (tradicional + multigrãos)** → Expedição–Alimentação, congelado, assar no local, nos DOIS serviços.
- **Suco Natural One Laranja (4 receitas) e chá mate gelado (3,2 L → 4 garrafas)** → Expedição–BEBIDAS.
- **Leite, café insumo, sachê de chá, iogurte, granola, aveia, mel, sucrilhos, achocolatado** → Expedição–ALIMENTAÇÃO.
- **Térmicas** (5 café · 3 leite · 3 água quente, escaldadas) → ESTRUTURA.
- **Adriana:** nenhum fornecedor de busca, nenhuma locação — só a verba. Mini brioche = compra CPL · pão folha = compra mercado.
- **Amarelo de restrição:** só o Shot Pink Fresh (vegano). Envelope Gourmet é vegetariano → sem amarelo.
- **KIT FINALIZAÇÃO PIEGGI EXTERNO** enviado por causa do envelope gourmet (finger food montado no local). A verrine em copo bolha, sozinha, não dispararia o kit.

## Layout técnico (.docx) — o que funcionou
- Quebra de página com **parágrafo âncora + `<w:br w:type="page"/>` em fonte 1 pt ANTES da tabela de cabeçalho** (o `page_break_before` não funciona quando o primeiro elemento é tabela). Resultado: 9 páginas, zero em branco.
- Colunas de Expedição alargadas para **EXP 0,45" · COP 0,45" · QTD 0,77" · DESCRIÇÃO 4,00" · ITEM 1,60"** — com 0,36" os títulos "EXP ✓/COP ✓" quebravam feio.
- Produção: ☐ 0,42" · QTD 1,20" · DESCRIÇÃO 4,30" · CÓD/ITEM 1,35". `tblGrid` reescrito + `tblLayout=fixed`.
- **Alerta cruzado do café colocado no TOPO da Expedição–Alimentação** (logo depois do banner dos motoristas) — no rodapé ele órfãou uma página inteira só com o alerta.
- Cores conferidas: Cozinha Fria #B45309 · Confeitaria #1F4E79 · Alimentação #6B21A8 (roxo) · Bebidas e Estrutura cinza · Adriana #2E7D32.
