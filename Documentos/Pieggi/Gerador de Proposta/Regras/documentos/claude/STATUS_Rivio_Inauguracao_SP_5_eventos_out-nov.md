# STATUS — RIVIO · Inauguração escritório SP · 5 eventos (16/10 a 05/11)

**Aberto e arquivos gerados em 14/09/2026.**
**Contato:** Rafael (Rafa) Braga — rafael.braga@rivio.com.br — (31) 98468-0240
**Origem:** lead site Pieggi (Google/PMAX) · CEP 01419-000 · **Tabela: EXTERNOS**

⚠️ O cliente escreveu "4 cafés da manhã" mas listou 4 cafés **+ 1 coquetel = 5 serviços**. Pediu preço separado por evento.

---

## 📄 ARQUIVOS ENTREGUES — 5, com 3 opções cada

| Arquivo | Serviço · PAX | Opção I | Opção II | Opção III |
|---|---|---|---|---|
| `..._Cafe_Colaboradores_Rafael_16-10` | Café 16/10 · 100 | Std **5.280** | Exec **5.500** | Master **6.160** |
| `..._Coquetel_Colaboradores_Rafael_16-10` | Coquetel 16/10 · 100 | Std lata **11.990** | Exec LN **14.850** | Master LN **16.500** |
| `..._Cafe_Clientes_Rafael_22-10` | Café 22/10 · 30 | **1.584** | **1.650** | **1.848** |
| `..._Cafe_Jornalistas_Rafael_29-10` | Café 29/10 · 30 | **1.584** | **1.650** | **1.848** |
| `..._Cafe_Board_Rafael_05-11` | Café 05/11 · 20 | **1.056** | **1.100** | **1.232** |

**Fórmula validada no modelo Go Bravo:** `tabela × pax × (1 + reposição) × 1,10` = valor exibido · **+ R$ 250 logística** · flores inclusas · equipe a definir · **Total do slide = "R$ a definir"** (multi-opção).
Tabela Externos: Coffee Std 48 · Exec 50 · Master 56 · Coquetel Std lata 109 · Exec LN 135 · Master LN 150.
Estrutura: 5 slides institucionais + dados + orçamento + 1 cardápio por opção + capa final. 11 páginas nos cafés, 9 no coquetel.

---

## 🍽️ CARDÁPIOS — todos `[P]` SUGESTÃO PIEGGI

**CAFÉ (manhã) — os 4 arquivos usam o mesmo cardápio por linha** (aproveitamento de cozinha, regra 02/09).

- **Standard:** Mini lanche *Blanquet* + *Vegetariano III* · Bebezinho *Fubá com goiabada* + *Limão recheado* · Pão de queijo tradicional e integral · Salada de frutas · **1 item a mais:** Barquete de tapioca *Maçã, mel e canela* · Suco de laranja + chá mate gelado
- **Executive:** idem + **2º item:** *Shot Energia Rosa* (melancia, beterraba e gengibre)
- **Master:** Mini lanche *Presunto Royale* + *Vegetariano III* · **3 itens:** Barquete *Ricota com geleia de damasco e nozes* · *Shot Energia Rosa* · Pieggi Board *Tzatziki Pieggi* · **+ frutas laminadas com favo de mel em linha própria** (fora da conta dos 3)

**COQUETEL STANDARD 16/10** (formato fixo 09/09): frios *salame italiano · copa · lombo canadense* · queijos *gorgonzola · gruyère · provolone* · mini hambúrguer com batata frita · coalhada no repolho roxo com quibe frito e crudités · guacamole com salgadinho de milho · homus com pão sírio · pães com patê de azeitonas pretas e de tomate seco · verrines *Brigadeiro de colher* + *Cocada de colher* · Heineken lata · Coca lata · suco de abacaxi com hortelã · água saborizada Pieggi.

**Sucos:** café manhã = laranja · coquetel do mesmo dia = **Suco Pieggi abacaxi com hortelã** (laranja com frutas vermelhas repetiria a laranja do café).

**Quantidades por pax:** mini lanche 1,1 (70/30) · bebezinho 1,1 (2 sabores) · pão de queijo 2 un (75/25, mínimo 25+12) · salada 100 g · cada item a mais 1,1 · frutas+favo 50 g (Master) · suco 130 ml · chá mate 80 ml · café 100 ml · leite 30 ml · sachê chá 0,5.
Coquetel 100 pax: frios 2.080 g · queijos 2.400 g · cerveja 165 un (linha única) · refri 200 latas · hambúrguer 200 · verrine 165 (83+82) · homus 1.440 g · guacamole 1.650 g · coalhada 700 g · Doritos 200 · 2 a 3 tábuas.

---

## 🧬 CONFERÊNCIAS RODADAS (escritas)

**Bases** — zero ingrediente 2×: cenoura (só brioche do vegetariano) · goiaba · limão · tomate (mini lanche = 1 item) · pepino · maçã/mel/canela · damasco/ricota/nozes · melancia/beterraba/gengibre · iogurte/alho/hortelã · laranja (suco).
**Famílias** — pão recheado 1 (mini lanche, base) · confeitaria 1 (bebezinho, base) · pão de queijo 1 · massa 1 (barquete) · copo 1 (shot) · board 1. Item a mais nunca de "pão recheado".
**Convidado que não gosta** — 3 perfis de doce (goiaba · cítrico · fruta/mel) + 2 salgados e pão de queijo. Verrines do coquetel (chocolate e coco) não repetem goiaba nem limão do café do mesmo dia.
**Grep nos 5 arquivos:** zero atum · pão francês · ciabatta · multigrãos · aveia · alecrim · sabores variados · lanche a mais · item adicional · mini cup cake. "&" escapado.

---

## 🔴 PENDÊNCIAS ABERTAS

1. **HORÁRIO de cada serviço** — slides saíram com *"1 hora de serviço — horário a confirmar"* (café) e *"2 horas"* (coquetel), as durações-base de tabela. Se passar disso muda preço E quantidade: coffee +30 min = +30% · +1 h = +80%. No café de 100 pax, 1 h a mais = R$ 3.840.
2. **ENDEREÇO completo** — slides com *"São Paulo/SP — endereço a confirmar"*.
3. **Canapés do Coquetel Executive e Master** — biblioteca CAN/TR/BF não está no Project. Só existem `CAN-012 Torradinha de Rosbife` e `MQ-01 Mini Quiches Sortidas` na config. **Os cardápios dessas 2 opções não foram gerados** — o arquivo do coquetel tem preço das 3 e cardápio só da Opção I.
4. **Fotos dos cardápios** — ficaram com o selo do template. Troca manual do Bruno.
5. **Visita técnica** — obrigatória por tabela, escritório novo.
6. **Desconto de volume** — 5 eventos em 3 semanas, cliente novo, com imprensa. Teto CMV 33,3%.
7. **Logística** — R$ 250/evento. O dia 16/10 tem dois serviços: paga uma ou duas?
8. **CMV do coquetel** — régua nova de tábua (09/09) subiu de 12 g/pax para ~35 g/pax em 100 pax. A tabela Externos foi feita com a régua velha. Rodar antes de fechar.

---

## ⚠️ CONFLITOS DE REGRA LEVANTADOS (decisão do Bruno)

1. **Croissant e pão de batata.** §7.1/§7.5 os põem como 1ª escolha de manhã; §3.2 os classifica em "pão recheado" e §8 proíbe essa família como item a mais. **A config se contradiz.** Por isso usei barquete e shot, que passam nas duas leituras.
2. **Planilha × regra de linha.** Planilha: croissant = Executive, pão de batata = Master. Regra 08/09: ambos Standard+. Sabores também divergem.
3. **Bebezinho de manhã.** O catálogo só tem **Fubá com Goiabada** e **Limão Recheado** — cenoura e laranja vêm com recheio de chocolate (= tarde). Por isso o café de 100 pax ficou em 2 sabores, não nos 3 que a régua libera acima de ~90 pax.
4. **Descritivos da planilha × trava do brioche.** *Peito de Peru*, *Presunto Royale* e *Copa* estão com "mini pão francês"; *Vegetariano I/II/III* com "brioche integral, multigrãos ou aveia". Os slides saíram corrigidos; a planilha continua errada.

---

## 🛠️ PIPELINE TÉCNICO

Template base = **`Pieggi_Proposta_Go_Bravo_Coquetel_Premium_Isabella_14-11_SEM_BAR_1.pptx`** (subido pelo Bruno em 14/09 — o template não persiste entre sessões).
Slides do base: 1–5 institucionais · 6 dados (tabela 7×2, h=324650, última 580000) · 7 orçamento (tabela 8×3, h=240000, header 404600, total 345225) · 8 cardápio (sp id=2 título · id=10 subtítulo · id=11 corpo, Constantia #050505, header b=1 i=1 / desc / separador) · 10 capa final.
Scripts em `/home/claude/work/`: `build.py` (unpack → set_cells / clone_row / grow_frame / set_sections → clone_cardapio → pack) + `jobs_rivio.py`. Pack preserva fontes embarcadas (font1–10.fntdata). QA por soffice → pdftoppm.

---

**ITENS ESPECIAIS: NENHUM** — o Rafa não nomeou item, sabor, marca nem restrição.
📌 **PROCEDÊNCIA: 100% SUGESTÃO PIEGGI `[P]`** nos 5 arquivos. Nada foi pedido pelo cliente — o Bruno troca o que quiser sem consultar ele.
