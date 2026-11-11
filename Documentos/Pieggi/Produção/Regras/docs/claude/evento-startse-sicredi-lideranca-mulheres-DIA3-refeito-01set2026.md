# 📌 SICREDI Liderança para Mulheres (StartSe) — DIA 3 (03/09) REFEITO — decisões 01/09/2026

Comanda gerada só do **dia 3**: Cozinha Fria · Confeitaria · Expedição–Alimentação · Expedição–Bebidas · Adriana. **11 páginas, zero em branco.**
Arquivo: `Comanda_StartSe_SICREDI-Lideranca-para-Mulheres_Stefany_03-09-2026_DIA3.docx`

## O que mudou no dia 3 (programação corrigida pelo Bruno no Claudinho Programação)
- **Welcome Coffee do 03/09 CANCELADO.**
- **Coffee da manhã passou para 08h00** (MANHÃ 1) — recebeu o cardápio que era da manhã (Presunto Comum, Vegetariano I, Envelope Azeitonas & Agrião, Barquete de tapioca Mel & Alecrim, Verrine Brigadeiro de Colher, Shot Verde Vital, bebezinhos Fazendeiro de coco / Laranja c/ chocolate, suco Natural One Laranja).
- **Coffee da tarde passou para 10h00** (MANHÃ 2) — Frango Cozido Desfiado, Vegetariano II, Carolina, Verrine Merengue de Morango, bebezinhos Red Velvet / Nhá Benta, suco Pêssego Blend.
- **Serviço de Auditório = MEIO PERÍODO, até 14h00, MAS com quantidade de 2 PERÍODOS** (café 10,8 L · Minalba 65 s/gás + 43 c/gás). Regra do Bruno — não reduzir por causa do horário.
- **Dias 1 e 2 NÃO foram tocados** ("não mudar dia 1 e 2 pelo amor").

## Decisões do Bruno (valem como precedente)
1. **Só as comandas pedidas.** Ele pediu cozinha, confeitaria, alimentação, bebidas e Adriana — **Expedição–ESTRUTURA não foi refeita** ("já fizemos"). Nas comandas refeitas entra a linha: *"ESTRUTURA E MATERIAIS — NÃO SE REPETEM NESTE DIA: térmicas, suqueiras, copos, cups, palitos, pregadores, bandejas, rádios e caixas já foram na carga anterior."*
2. **Refazer um dia isolado é normal** — quando o cardápio de um dia muda, gerar só aquele dia, com todas as comandas daquele dia.
3. **Avisar a Adriana da mudança:** banner vermelho próprio na página verde explicando o que mudou no dia 3. Além dele, o aviso da mudança entra no cabeçalho de TODAS as comandas do dia.
4. **Orçamento R$ 15.664,00 → Verba do evento: R$ 1.253,12** (só o valor final na página verde, sem % e sem orçamento).
5. **Página verde não leva faixa de saída nem faixa "ler a ficha no encadernado"** — essas são das comandas de produção/expedição.
6. **Saída única 05h00** no dia 3 (coffee das 08h00 − 3h), cobrindo os 3 serviços — mantém o precedente de saída consolidada quando tudo é no mesmo local/dia.
7. **Cozinha Quente omitida** (nenhum item quente) — com uma linha vermelha na Cozinha Fria avisando que não existe página quente nesse dia.
8. **Barquete de tapioca com queijo = SALGADA → Cozinha Fria**; enviar a barquete separada do creme (a base umedece) + mel e alecrim à parte, copeira monta no local.
9. **Frango cozido desfiado** segue inteiro na Cozinha Fria (cozimento é etapa interna, não gera linha na Quente).
10. **Compras do dia na Alimentação:** mini brioche CPL 54 tradicional + 14 cenoura · pão folha 17 · barquete de tapioca 17 · alecrim.
11. **Gelo NÃO vai** (StartSe ponto fixo, sem HH no dia 3). **Nenhum suco na Bebidas** — linha de observação explicando.

## Totais do dia 3
Café 17 L · leite 1,86 L · sachê de chá 62 · açúcar 170 + adoçante 170 (auditório 108 + 31 + 31) · achocolatado 186 g · pão de queijo 94 tradicional + 32 multigrãos (congelados) · chá mate 6 garrafas · água Minalba 65 s/gás + 43 c/gás.

## Layout (o que funcionou)
Cabeçalho espelho da etiqueta (6 caixas) + tira verde da etiqueta com o alerta de vários eventos StartSe **fundido na mesma caixa** (economiza folha) · faixa amarela 🚚 HORA DE SAIR · cores: Fria #B45309 · Confeitaria #1F4E79 · Alimentação #6B21A8 (roxo) · Bebidas cinza · Adriana #2E7D32 · selo do projeto embutido (~0,62") · `tblGrid` reescrito (DESCRIÇÃO 4,30" produção / 4,00" expedição) · `pageBreakBefore` por comanda · `cantSplit` nas linhas · `keep_with_next` só em tabelas de até 3 linhas (limite maior jogava meia página fora) · limpeza de parágrafos vazios no fim do corpo ignorando o `w:sectPr`.
