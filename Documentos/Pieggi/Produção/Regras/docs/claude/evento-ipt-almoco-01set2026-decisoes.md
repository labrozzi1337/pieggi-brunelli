# Evento IPT — Almoço — 01/09/2026 — 15 pax (decisões do Bruno, 28/08)

**Cliente:** IPT · **Evento:** Almoço · **Data:** 01/09 · **PAX:** 15
**Horário:** 12h às 15h → 🚚 **saída 09h00** (servir − 3h)
**Endereço e contato:** deixados **EM BRANCO** na comanda (preencher à mão) — não confirmados até a geração.

## Decisões tomadas pelo Bruno
- **Lombo suíno assado:** comprar **4 unidades (peças)** — sem fator de conversão cru×pronto (não está na tabela §10.2).
- **Sorrentine de muçarela de búfala & manjericão:** **estoque interno — já temos no congelador**. NÃO é Rotisseria, NÃO entra na página da Adriana.
- **Cuscuz paulista, cuscuz marroquino e farofa de couve:** **produção interna**, no peso pronto da programação.
- **Molho rústico de tomates (molho da massa):** **2 kg** — a programação trazia 600 g. Alteração do Bruno (sinalizada na comanda).
- **Café final:** com **leite 2 litros** (a programação não trazia leite) → 2 garrafas térmicas escaldadas.
- **Petit four:** **12 Beijo de dama + 12 Cristal de cereja** (a programação trazia 15 de cada).
- **Pimenta / Tabasco:** **enviar** (Estrutura).
- **Mesa posta = LOCAÇÃO, na página da Adriana** (verde), 18 de cada (1,2 × 15 pax): jogo americano, sousplat, prato de almoço, prato de sobremesa, garfo e faca de almoço, garfo e colher de sobremesa, taça de água, copo de suco/refri, guardanapo de pano. Sai da Estrutura.
- **Colherinha de verrine:** **44 descartáveis** (são 40 verrines em copo bolha) — a regra de 1,2/pax daria 18, insuficiente.
- **Verba:** orçamento R$ 5.000 → **R$ 400,00** (só o valor final na página verde).
- **Fornecedores de busca:** **nenhum**.

## Estrutura do arquivo
7 comandas, 9 páginas, `Comanda_IPT_Almoco_aconfirmar_01-09-2026.docx`:
Cozinha Quente (#800020) · Cozinha Fria (#B45309) · Confeitaria (#1F4E79) · Expedição–Alimentação (#6B21A8) · Expedição–Bebidas (cinza) · Expedição–Estrutura (cinza) · Adriana (#2E7D32).
Suco Natural One Laranja (2 receitas) na **Confeitaria + Expedição–Alimentação**; Bebidas com a linha de observação "suco não está nesta comanda". Placas elétricas (3) + cerâmica colorida; transformador e extensão vão (não é StartSe). Sem restrição alimentar — nenhum amarelo.

## Aprendizado de layout
- `PROD_W = [0.42, 1.15, 4.15, 1.55]` e `EXP_W = [0.42, 0.42, 0.80, 4.10, 1.53]` (A4, margens 0,5"): com ITEM em 1,35" a palavra "Acompanhamento" quebra em duas linhas; 1,53–1,55" resolve. Cabeçalhos "EXP ✓ / COP ✓" em 9 pt para não quebrar em colunas de 0,42".
