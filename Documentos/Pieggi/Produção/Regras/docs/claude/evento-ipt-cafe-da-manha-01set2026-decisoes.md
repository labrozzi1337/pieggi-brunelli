# Evento IPT — Café da Manhã (Coffee Break Master) — 01/09/2026 — 40 pax (decisões do Bruno, 30/08)

**Cliente:** IPT · **Evento:** Café da Manhã · **Data:** 01/09 · **PAX:** 40
**Serviço:** Coffee Break (Master) — manhã — 10h às 11h → 🚚 **saída 07h00** (servir − 3h)
**Endereço e contato:** deixados **EM BRANCO** na comanda (preencher à mão) — não confirmados.
**Arquivo:** `Comanda_IPT_Cafe-da-Manha_aconfirmar_01-09-2026.docx` — 6 comandas, 10 páginas.

## Decisões tomadas pelo Bruno
- **O ALMOÇO SAIU DESTA COMANDA.** A programação vinha com "Café da Manhã e Almoço" (40 + 15 pax), mas o almoço já foi gerado em outro agendamento (ver `claude/evento-ipt-almoco-01set2026-decisoes.md`). Esta comanda é **só do coffee**.
- **Verba:** orçamento R$ 2.240,00 → **R$ 179,20** (só o valor final na página verde).
- **Barquete de tapioca — roteamento por recheio:** "creme de queijo, mel e alecrim" (tem queijo → salgada) = **Cozinha Fria**; "maçã, mel e canela" (100% doce) = **Confeitaria**. Nos dois casos: base + creme/maçã na produção, **mel e a erva/canela à parte**, copeira finaliza no local.
- **Mini lanche Vegetariano II:** a programação trazia brioche integral/multigrãos → **ajustado para mini brioche de CENOURA** (regra Pieggi), marcado "(ajustado da regra Pieggi)" na comanda.
- **Cup mini de vidro do shot:** **29 un** (26 shots + reposição), e não 44 (1,1 × pax) — a regra por pax sobrava demais.
- **KIT FINALIZAÇÃO PIEGGI EXTERNO:** enviar (pedido do Bruno + gatilho da tartelete CAN-021).
- **Fornecedores de busca:** **nenhum**. Mini brioche (CPL), casca de tartelete (Arosa), iogurte, granola e favo de mel são compra → resolvem na Expedição–Alimentação, fora da página verde.

## Roteamento aplicado
- **Cozinha Quente: página OMITIDA** (nenhum item quente).
- **Cozinha Fria:** 35 mini lanche Blanquet · 9 mini lanche Vegetariano II · 22 barquete salgada.
- **Confeitaria:** 2 bebezinhos (já recheados) · 22 barquete doce · 22+22 croissants (produção interna, saem prontos) · 26 tartelete CAN-021 · 26 shot funcional · salada de frutas 4 kg · frutas laminadas 2 kg · favo de mel · **4 receitas Suco Natural One Laranja** (adendo 27/08 — todo suco é Confeitaria).
- **Expedição–Alimentação (roxo):** tudo acima + componentes CAN-021 (casca Arosa, doce de leite 520 g, 26 rodelas de banana, flor de sal) + mel/alecrim/canela das barquetes + **pão de queijo congelado 60 + 20 (assar no local)** + café insumo, sachês, achocolatado, leite 1,2 L, iogurte 800 ml, granola 400 g + suco pronto.
- **Bebidas:** 2 pacotes de gelo · 20 Minalba sem gás · 4 garrafas de chá mate (3,2 L) · linha de observação "suco não está nesta comanda".
- **Estrutura:** 5 térmicas escaldadas (3 café + 1 leite + 1 água quente) · 2 refresqueiras · 44 palitos · descartáveis/louça/vidro · 13 pegadores + descansos · 14 suportes · kit finalização externo · 2 rádios + 2 fones · extensão + transformador (não é StartSe) · kit de limpeza · 5 caixas etiquetadas.

## Aprendizado de layout (.docx)
- **Quebra de página:** aplicar `page_break_before` **no parágrafo espaçador que já existe no fim da comanda anterior** (reaproveitar o último parágrafo vazio). Criar um parágrafo novo só pro break gera **página em branco** quando o espaçador anterior cai sozinho na página seguinte.
- **Alertas cruzados (café/suco):** subir para o topo da Expedição–Alimentação, junto da faixa vermelha da copeira. Deixados no rodapé, órfãos, criam uma página só pra eles.
- **Página da Adriana:** sem faixa amarela de saída e sem tira verde de etiqueta (§11) — só cabeçalho + fornecedores/locação + verba.
- Larguras: `PROD_W = [0.42, 1.15, 4.15, 1.55]` · `EXP_W = [0.42, 0.42, 0.80, 4.10, 1.53]`, com `tblGrid` reescrito.
