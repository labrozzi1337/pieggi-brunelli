// Gera as cargas a partir de apps/backend/src/dominios/regras/regras-iniciais.ts e da planilha autoritativa do cardápio:
//   20261108101000_carga_regras_e_cardapio.sql — carga 1 (regras + 137 itens). Congelada: o conteúdo não muda.
//   20261109103000_carga_regras_v2.sql         — carga 2 de regras (versões continuam a contagem da carga 1).
//   20261109103100_cardapio_traducoes_selos.sql — EN/ES do sabor, selo, estação e fornecedor dos itens (só preenche NULL).
//   20261109108000_carga_regras_v4.sql         — carga 4 de regras (documentos de Documentos/Pieggi) + itens novos do cardápio.
// As migrations já aplicadas não mudam: regenerar deixa os arquivos byte a byte iguais.
// Uso (Node 24+, sem build): node scripts/gerar-carga-regras-e-cardapio.ts
import { readFile, writeFile } from "node:fs/promises";
import JSZip from "jszip";
import { CARDAPIO_V4, comVersao, REGRAS_INICIAIS, REGRAS_V2, REGRAS_V3, REGRAS_V4, TODAS_AS_CARGAS, VIGENCIA_INICIAL, type ItemCardapioNovo, type RegraInicial } from "../apps/backend/src/dominios/regras/regras-iniciais.ts";
import { classificar, rotear, seloDoItem, type CategoriaRegra, type RotaRegra, type SeloRegra } from "../apps/backend/src/dominios/regras/classificacao.ts";

const PLANILHA = "Documentos/Pieggi/Gerador de Proposta/Regras/Card_pio_Coffee_Break__Planilha_de_Custos.xlsx";
const ABA = "Produtos Pieggi";
const SAIDA = "supabase/migrations/20261108101000_carga_regras_e_cardapio.sql";
const SAIDA_V2 = "supabase/migrations/20261109103000_carga_regras_v2.sql";
const SAIDA_CARDAPIO = "supabase/migrations/20261109103100_cardapio_traducoes_selos.sql";
const SAIDA_V4 = "supabase/migrations/20261109108000_carga_regras_v4.sql";
const TIERS = ["BASIC", "STANDARD", "EXECUTIVE", "MASTER", "PREMIUM"];

const texto = (v: string) => `'${v.replaceAll("'", "''")}'`;
const textoOuNulo = (v: string | null | undefined) => (v == null ? "null" : texto(v));
const xml = (v: string) => v.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&amp;", "&");

async function lerAba(caminho: string, aba: string) {
  const zip = await JSZip.loadAsync(await readFile(caminho));
  const ler = async (nome: string) => { const f = zip.file(nome); if (!f) throw new Error(`Planilha sem ${nome}`); return f.async("string"); };
  const compartilhadas = [...(await ler("xl/sharedStrings.xml")).matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((m) => xml([...(m[1] ?? "").matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join("")));
  const rid = (await ler("xl/workbook.xml")).match(new RegExp(`<sheet [^>]*name="${aba}"[^>]*r:id="([^"]+)"`))?.[1];
  const alvo = (await ler("xl/_rels/workbook.xml.rels")).match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`))?.[1];
  if (!alvo) throw new Error(`Aba "${aba}" não encontrada`);
  const folha = await ler(`xl/${alvo.replace(/^\/?xl\//, "")}`);
  return [...folha.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)].map((linha) => {
    const celulas: Record<string, string> = {};
    for (const c of (linha[1] ?? "").matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const v = c[3]?.match(/<v>([^<]*)<\/v>/)?.[1];
      if (v !== undefined && c[1]) celulas[c[1]] = /t="s"/.test(c[2] ?? "") ? compartilhadas[Number(v)] ?? "" : xml(v);
    }
    return celulas;
  });
}

function regrasSql(regras: Array<RegraInicial & { versao: number }>) {
  const valores = regras.map((r) => `  (gen_random_uuid(), ${texto(r.codigo)}, ${r.versao}, ${texto(r.titulo)}, ${texto(r.titulo)}, ${texto(r.origem)}, '${r.status ?? "APROVADA"}', '{}'::jsonb, timestamptz '${r.vigenteDesde ?? VIGENCIA_INICIAL}T00:00:00-03:00', ${texto(JSON.stringify(r.valor))}::jsonb, '${r.escopoTipo ?? "GLOBAL"}', ${texto(r.escopoChave ?? "")}, ${r.financeiro === true})`);
  return `insert into pieggi.regras_negocio (id, codigo, versao, titulo, descricao, origem, status, escopo, vigente_desde, valor, escopo_tipo, escopo_chave, financeiro) values\n${valores.join(",\n")}\non conflict (codigo, versao) do nothing;`;
}

function itensDaPlanilha(linhas: Array<Record<string, string>>) {
  return linhas.filter((l) => l.A && l.B && l.C && l.F && l.A !== "FAMÍLIA").map((l) => {
    const grupo = (l.B ?? "").trim();
    const ultima = grupo.split(/\s+/).pop()?.replace("+", "") ?? "";
    const tier = TIERS.includes(ultima) ? ultima : "BASE";
    const categoria = tier === "BASE" ? grupo : grupo.slice(0, grupo.lastIndexOf(" ")).trim();
    return { familia: (l.A ?? "").trim(), grupo, categoria, tier, nome: (l.C ?? "").trim(), ingredientes: (l.D ?? "").trim(), unidade: (l.E ?? "unidade").trim(), custo: Number(l.F) };
  });
}

function cardapioSql(itens: ReturnType<typeof itensDaPlanilha>) {
  const valores = itens.map((i) => `  (${[i.familia, i.grupo, i.categoria, i.tier, i.nome, i.ingredientes, i.unidade].map(texto).join(", ")}, ${Math.round(i.custo * 10000) / 10000})`);
  return `with carga(familia, grupo, categoria, tier, nome, ingredientes, unidade, custo) as (values\n${valores.join(",\n")}\n), novos as (
  insert into pieggi.cardapio_itens (familia, grupo, categoria, tier, nome, ingredientes, unidade)
  select familia, grupo, categoria, tier, nome, ingredientes, unidade from carga
  on conflict (grupo, nome) do nothing returning id, grupo, nome
)
insert into pieggi.cardapio_custos (item_id, custo)
select n.id, c.custo from novos n join carga c using (grupo, nome)
on conflict (item_id) do nothing;`;
}

// Tradução do SABOR (o que vem depois de "CATEGORIA /" na plaquinha); a categoria vem do glossário.
const TRADUCOES: Record<string, [string, string]> = {
  "Peito de Frango Defumado": ["Smoked Chicken Breast", "Pechuga de Pollo Ahumada"], "Peito de Peru": ["Turkey Breast", "Pechuga de Pavo"],
  "Presunto Comum": ["Ham", "Jamón"], "Vegetariano I": ["Carrot", "Zanahoria"], "Vegetariano II": ["Green Apple", "Manzana Verde"],
  "Vegetariano III": ["Arugula Pesto", "Pesto de Rúcula"], "Blanquet": ["Turkey Blanquet", "Blanquet de Pavo"], "Lombo Canadense": ["Canadian Pork Loin", "Lomo Canadiense"],
  "Provolone": ["Provolone", "Provolone"], "Atum": ["Tuna", "Atún"], "Peito de Frango Cozido Desfiado": ["Shredded Chicken Breast", "Pechuga de Pollo Desmenuzada"],
  "Salame Comum": ["Salami", "Salami"], "Búfala": ["Buffalo Mozzarella", "Mozzarella de Búfala"], "Copa": ["Coppa", "Coppa"],
  "Pastrami Artesanal": ["Artisan Pastrami", "Pastrami Artesanal"], "Presunto Royale": ["Royale Ham", "Jamón Royale"], "Rosbife Artesanal": ["Artisan Roast Beef", "Rosbif Artesanal"],
  "Tramezzino Creme de Abacate": ["Avocado Cream", "Crema de Aguacate"], "Tramezzino Creme de Abóbora": ["Pumpkin Cream", "Crema de Calabaza"],
  "Tramezzino Creme de Beterraba": ["Beet Cream", "Crema de Remolacha"], "Tramezzino Pasta de Cenoura com Gengibre e Tahine": ["Carrot, Ginger & Tahini Spread", "Pasta de Zanahoria, Jengibre y Tahini"],
  "Tramezzino Pasta de Frango": ["Chicken Spread", "Pasta de Pollo"], "Tramezzino Creme de Abobrinha com Ervas": ["Zucchini & Herb Cream", "Crema de Calabacín con Hierbas"],
  "Tramezzino Creme de Milho": ["Corn Cream", "Crema de Maíz"], "Tramezzino Pasta de Atum": ["Tuna Spread", "Pasta de Atún"],
  "Tramezzino Babaganoush (Berinjela Defumada)": ["Baba Ganoush (Smoked Eggplant)", "Babaganoush (Berenjena Ahumada)"],
  "Tramezzino Creme de Amendoim com Ervas": ["Peanut & Herb Cream", "Crema de Maní con Hierbas"], "Tramezzino Creme de Tomate Seco": ["Sun-Dried Tomato Cream", "Crema de Tomate Seco"],
  "Tramezzino Homus": ["Hummus", "Humus"], "Tramezzino Pasta de Queijos com Pesto de Rúcula e Manjericão": ["Cheese Spread with Arugula & Basil Pesto", "Pasta de Quesos con Pesto de Rúcula y Albahaca"],
  "Abacate & Tomate": ["Avocado & Tomato", "Aguacate y Tomate"], "Cenoura & Ervas Finas": ["Carrot & Fine Herbs", "Zanahoria y Finas Hierbas"],
  "Pepino, Maçã & Hortelã": ["Cucumber, Apple & Mint", "Pepino, Manzana y Menta"], "Uvas & Rúcula": ["Grapes & Arugula", "Uvas y Rúcula"],
  "Azeitonas & Agrião": ["Olives & Watercress", "Aceitunas y Berro"], "Tzatziki Pieggi": ["Pieggi Tzatziki", "Tzatziki Pieggi"],
  "Manga & Rúcula": ["Mango & Arugula", "Mango y Rúcula"], "Pasta de Ricota com Pesto": ["Ricotta & Pesto Spread", "Pasta de Ricota con Pesto"],
  "Barquete Banana, Mel & Canela": ["Banana, Honey & Cinnamon", "Plátano, Miel y Canela"], "Barquete Creme de queijo, Mel & Alecrim": ["Cheese Cream, Honey & Rosemary", "Crema de Queso, Miel y Romero"],
  "Barquete Creme de queijo, Tomate & Manjericão": ["Cheese Cream, Tomato & Basil", "Crema de Queso, Tomate y Albahaca"], "Barquete Maçã, Mel & Canela": ["Apple, Honey & Cinnamon", "Manzana, Miel y Canela"],
  "Barquete Creme de queijo & Geleia de Frutas": ["Cheese Cream & Fruit Jam", "Crema de Queso y Mermelada de Frutas"],
  "Barquete Ricota com Geleia de Damasco & Nozes": ["Ricotta, Apricot Jam & Walnuts", "Ricota, Mermelada de Albaricoque y Nueces"],
  "Shot Calm & Relax": ["Calm & Relax", "Calm & Relax"], "Shot Energia Rosa": ["Pink Energy", "Energía Rosa"], "Shot Fresh Detox": ["Fresh Detox", "Fresh Detox"],
  "Shot Hidra Mix": ["Hydra Mix", "Hidra Mix"], "Shot Imuno Power": ["Immuno Power", "Inmuno Power"], "Shot Verde Vital": ["Green Vital", "Verde Vital"],
  "Shot Banana Fit": ["Banana Fit", "Banana Fit"], "Shot Energia Solar": ["Solar Energy", "Energía Solar"], "Shot Pele Bonita": ["Glowing Skin", "Piel Bonita"],
  "Shot Pink Fresh": ["Pink Fresh", "Pink Fresh"], "Shot Verde Força": ["Green Power", "Fuerza Verde"],
  "Tartelete Creme de Queijo com Abacaxi Caramelizado": ["Cheese Cream & Caramelized Pineapple", "Crema de Queso con Piña Caramelizada"],
  "Tartelete Creme de Queijo com Geleia de Goiaba": ["Cheese Cream & Guava Jam", "Crema de Queso con Mermelada de Guayaba"],
  "Tartelete Doce de Leite com Banana e Flor de Sal": ["Dulce de Leche, Banana & Fleur de Sel", "Dulce de Leche, Plátano y Flor de Sal"],
  "Tartelete Ganache de Chocolate Branco com Morango": ["White Chocolate Ganache & Strawberry", "Ganache de Chocolate Blanco con Fresa"],
  "Tartelete Ganache de Chocolate ao Leite com Maracujá": ["Milk Chocolate Ganache & Passion Fruit", "Ganache de Chocolate con Leche y Maracuyá"],
  "Tartelete Cottage com Maçã, Mel e Canela": ["Cottage Cheese, Apple, Honey & Cinnamon", "Cottage, Manzana, Miel y Canela"],
  "Tartelete Ganache de Chocolate ao Leite com Amêndoas": ["Milk Chocolate Ganache & Almonds", "Ganache de Chocolate con Leche y Almendras"],
  "Tartelete Purê de Manga, Queijo Branco e Pimenta-Rosa": ["Mango Purée, White Cheese & Pink Pepper", "Puré de Mango, Queso Blanco y Pimienta Rosa"],
  "Mini Cup Crudités com Coalhada Temperada": ["Crudités with Seasoned Labneh", "Crudités con Jocoque Sazonado"], "Mini Cup Guacamole com Grissini": ["Guacamole & Grissini", "Guacamole con Grissini"],
  "Mini Cup Homus com Grissini": ["Hummus & Grissini", "Humus con Grissini"], "Mini Cup Mix de Castanhas": ["Mixed Nuts", "Mix de Frutos Secos"],
  "Verrine Brigadeiro de Colher": ["Spoon Brigadeiro", "Brigadeiro de Cuchara"], "Verrine Cocada de Colher": ["Spoon Coconut Sweet", "Cocada de Cuchara"],
  "Verrine Mousse de Maracujá": ["Passion Fruit Mousse", "Mousse de Maracuyá"], "Verrine Tortinha de Limão Desconstruída": ["Deconstructed Lemon Tart", "Tartaleta de Limón Deconstruida"],
  "Verrine Banoffee Desconstruída": ["Deconstructed Banoffee", "Banoffee Deconstruido"], "Verrine Brigadeiro Branco com Uva Verde": ["White Brigadeiro & Green Grape", "Brigadeiro Blanco con Uva Verde"],
  "Verrine Merengue de Morango Desconstruído": ["Deconstructed Strawberry Meringue", "Merengue de Fresa Deconstruido"],
  "Verrine Cottage com Mel, Manga e Granola": ["Cottage Cheese, Honey, Mango & Granola", "Cottage, Miel, Mango y Granola"], "Verrine Franui Desconstruído": ["Deconstructed Franui", "Franui Deconstruido"],
  "Verrine Mousse de Frutas Vermelhas com Mirtilo": ["Berry Mousse & Blueberry", "Mousse de Frutos Rojos con Arándano"],
  "Verrine Mousse de Limão com Coulis de Frutas Vermelhas": ["Lemon Mousse & Berry Coulis", "Mousse de Limón con Coulis de Frutos Rojos"],
  "Pasta Mix de Queijos Pieggi Alho-Poró & Limão-Siciliano": ["Pieggi Cheese Spread, Leek & Sicilian Lemon", "Pasta de Quesos Pieggi, Puerro y Limón Siciliano"],
  "Catupiry com Alho Frito, Azeite & Mel": ["Catupiry, Fried Garlic, Olive Oil & Honey", "Catupiry, Ajo Frito, Aceite de Oliva y Miel"],
  "Pasta Mix de Queijos Pieggi & Pesto de Azeitonas Pretas": ["Pieggi Cheese Spread & Black Olive Pesto", "Pasta de Quesos Pieggi y Pesto de Aceitunas Negras"],
  "Pasta Mix de Queijos Pieggi Pera & Nozes": ["Pieggi Cheese Spread, Pear & Walnuts", "Pasta de Quesos Pieggi, Pera y Nueces"],
  "Croissant de queijo": ["Cheese", "Queso"], "Croissant de calabresa": ["Calabrese Sausage", "Longaniza Calabresa"], "Croissant de presunto e queijo": ["Ham & Cheese", "Jamón y Queso"],
  "Pão de batata com catupiry": ["Catupiry Cheese", "Queso Catupiry"], "Pão de batata com calabresa": ["Calabrese Sausage", "Longaniza Calabresa"],
  "Pão de batata com presunto e queijo": ["Ham & Cheese", "Jamón y Queso"],
  "Bolo Inteiro Fubá com Goiabada": ["Cornmeal & Guava Paste", "Harina de Maíz y Dulce de Guayaba"], "Bolo Inteiro Milho na Folha": ["Corn", "Maíz"],
  "Bolo Inteiro de Banana": ["Banana", "Plátano"], "Bolo Inteiro Bem-Casado": ["Bem-Casado", "Bem-Casado"], "Bolo Inteiro Brigadeiro": ["Brigadeiro", "Brigadeiro"],
  "Bolo Inteiro Cenoura com Chocolate": ["Carrot & Chocolate", "Zanahoria y Chocolate"], "Bolo Inteiro Iogurte": ["Yogurt", "Yogur"], "Bolo Inteiro Laranja": ["Orange", "Naranja"],
  "Bolo Piscina Limão": ["Lemon", "Limón"], "Bolo Inteiro Coco Cremoso": ["Creamy Coconut", "Coco Cremoso"],
  "Bebezinho Cenoura com Recheio de Chocolate": ["Carrot & Chocolate", "Zanahoria y Chocolate"], "Bebezinho Chocolate com Recheio de Chocolate": ["Double Chocolate", "Chocolate Doble"],
  "Bebezinho Churros Recheado": ["Churros", "Churros"], "Bebezinho Laranja com Recheio de Chocolate": ["Orange & Chocolate", "Naranja y Chocolate"],
  "Bebezinho Limão Recheado": ["Lemon", "Limón"], "Fuba com Goiabada": ["Cornmeal & Guava", "Maíz y Guayaba"], "Leite Ninho Com Nutella": ["Ninho Milk & Nutella", "Leche Ninho y Nutella"],
  "Maracujá": ["Passion Fruit", "Maracuyá"], "Nhá Benta": ["Nhá Benta", "Nhá Benta"], "Prestigio": ["Coconut & Chocolate", "Coco y Chocolate"], "Red Velvet": ["Red Velvet", "Red Velvet"],
  "Bombom de Chocolate Meio Amargo": ["Semisweet Chocolate", "Chocolate Semiamargo"], "Bombom de Chocolate ao Leite": ["Milk Chocolate", "Chocolate con Leche"],
  "Bombom de Limão": ["Lemon", "Limón"], "Mini Queijadinha": ["Coconut Cheese Tart", "Quesadilla de Coco"], "Mini Carolina Tradicional": ["Traditional", "Tradicional"],
  "Mini Carolina de Limão": ["Lemon", "Limón"], "Café Tradicional": ["Traditional", "Tradicional"], "Kit de Chá em Sachê com Água Quente": ["Tea Kit", "Kit de Té"],
  "Kit Adoçante e Açúcar": ["Sweetener & Sugar Kit", "Kit de Endulzante y Azúcar"], "Kit de Descartáveis": ["Disposables Kit", "Kit de Descartables"], "Leite": ["Milk", "Leche"],
  "Pão de Queijo Multigrãos": ["Multigrain", "Multigrano"], "Pão de Queijo Tradicional": ["Traditional", "Tradicional"],
  "Salada de Frutas com Iogurte e Granola": ["Fruit Salad", "Ensalada de Frutas"], "Suco na Refresqueira": ["Juice", "Jugo"], "Água Minalba": ["Minalba Water", "Agua Minalba"],
  "Chá Gelado na Refresqueira": ["Iced Tea", "Té Helado"], "Favo de mel": ["Honeycomb", "Panal de Miel"], "Frutas Laminadas": ["Sliced Fruit", "Frutas Laminadas"]
};
// Mesma chave do sabor em grupos diferentes (wrap × envelope): a tradução é a do sabor.
const traducao = (nome: string, sabor: string | null) => TRADUCOES[nome] ?? (sabor ? TRADUCOES[sabor] : undefined);

const valorV2 = <T>(codigo: string) => REGRAS_V2.find((r) => r.codigo === codigo && !r.escopoTipo)?.valor as T;

function enriquecimentoSql(itens: ReturnType<typeof itensDaPlanilha>) {
  const categorias = valorV2<CategoriaRegra[]>("cardapio.categorias");
  const queijo = valorV2<string[]>("cardapio.queijo");
  const selo = valorV2<SeloRegra>("selo.classificacao");
  const rotas = valorV2<RotaRegra[]>("roteamento.estacao");
  const faltando: string[] = [];
  const valores = itens.map((i) => {
    const c = classificar(categorias, i.nome, i.categoria, queijo);
    const [en, es] = traducao(i.nome, c.sabor) ?? [];
    if (!en) faltando.push(i.nome);
    const rota = rotear(rotas, `${c.rotulo} ${i.nome}`, c.tipo, "COFFEE_BREAK");
    return `  (${[i.grupo, i.nome].map(texto).join(", ")}, ${textoOuNulo(en)}, ${textoOuNulo(es)}, ${textoOuNulo(seloDoItem(selo, `${c.rotulo} ${i.nome}`))}, ${textoOuNulo(rota?.estacao ?? "EXPEDICAO_ALIMENTACAO")}, ${textoOuNulo(rota?.fornecedor)})`;
  });
  if (faltando.length) throw new Error(`Sem tradução: ${faltando.join(", ")}`);
  return `alter table pieggi.cardapio_itens drop constraint if exists cardapio_itens_estacao_check;
alter table pieggi.cardapio_itens add constraint cardapio_itens_estacao_check check (estacao in
  ('COZINHA_QUENTE','COZINHA_FRIA','CONFEITARIA','EXPEDICAO_ALIMENTACAO','EXPEDICAO_BEBIDAS','BEBIDAS','ESTRUTURA','FORNECEDOR'));

update pieggi.cardapio_itens i set
  nome_en = coalesce(i.nome_en, v.nome_en), nome_es = coalesce(i.nome_es, v.nome_es), selo = coalesce(i.selo, v.selo),
  estacao = coalesce(i.estacao, v.estacao), fornecedor = coalesce(i.fornecedor, v.fornecedor), atualizado_em = now()
from (values
${valores.join(",\n")}
) as v(grupo, nome, nome_en, nome_es, selo, estacao, fornecedor)
where i.grupo = v.grupo and i.nome = v.nome
  and (i.nome_en is null or i.nome_es is null or i.selo is null or i.estacao is null or i.fornecedor is null);`;
}

function cardapioNovoSql(itens: readonly ItemCardapioNovo[]) {
  const valores = itens.map((i) => `  (${[i.familia, i.grupo, i.categoria, i.tier, i.nome, i.ingredientes, i.unidade, i.nomeEn, i.nomeEs].map(texto).join(", ")}, ${textoOuNulo(i.selo)}, ${texto(i.estacao)}, ${textoOuNulo(i.fornecedor)})`);
  return `insert into pieggi.cardapio_itens (familia, grupo, categoria, tier, nome, ingredientes, unidade, nome_en, nome_es, selo, estacao, fornecedor) values
${valores.join(",\n")}
on conflict (grupo, nome) do nothing;`;
}

const cabecalho = (linhas: string[]) => `-- GERADO por scripts/gerar-carga-regras-e-cardapio.ts — não edite à mão.\n${linhas.map((l) => `-- ${l}`).join("\n")}\n`;
const itens = itensDaPlanilha(await lerAba(PLANILHA, ABA));
const versionadas = comVersao([...REGRAS_INICIAIS, ...REGRAS_V2]);

await writeFile(SAIDA, `${cabecalho([`Regras vigentes em ${VIGENCIA_INICIAL} (${REGRAS_INICIAIS.length} linhas) e ${itens.length} itens da aba "${ABA}" da planilha de custos.`, "Idempotente: reaplicar não sobrescreve valores alterados pelo admin."])}begin;
${regrasSql(versionadas.slice(0, REGRAS_INICIAIS.length))}

${cardapioSql(itens)}
commit;
`);
await writeFile(SAIDA_V2, `${cabecalho([`Carga 2 de regras (${REGRAS_V2.length} linhas): programação, comanda, plaquinha e proposta. Vigência ${VIGENCIA_INICIAL}.`,
  "Regra que já existia ganha nova versão (a contagem continua a da carga 1). Idempotente: on conflict (codigo, versao) do nothing."])}begin;
${regrasSql(versionadas.slice(REGRAS_INICIAIS.length))}
commit;
`);
await writeFile(SAIDA_CARDAPIO, `${cabecalho([`Cardápio: tradução EN/ES do SABOR (a categoria vem do glossário), selo padrão (§8), estação e fornecedor (§7) dos ${itens.length} itens.`,
  "Só preenche o que está NULL — o que o admin já cadastrou fica. Selo, estação e fornecedor saem das mesmas regras do motor (classificacao.ts)."])}begin;
${enriquecimentoSql(itens)}
commit;
`);
const anteriores = REGRAS_INICIAIS.length + REGRAS_V2.length + REGRAS_V3.length;
await writeFile(SAIDA_V4, `${cabecalho([`Carga 4 de regras (${REGRAS_V4.length} linhas): regras dos documentos de Documentos/Pieggi que a especificação de 05/11/2026 não cobre,`,
  "pendências respondidas pelos documentos e novas versões (rastreabilidade em docs/regras-rastreabilidade.md). Vigência por regra.",
  `Também carrega ${CARDAPIO_V4.length} itens novos do cardápio (coquetel e brunch). Idempotente: on conflict do nothing.`])}begin;
${regrasSql(comVersao(TODAS_AS_CARGAS()).slice(anteriores))}

${cardapioNovoSql(CARDAPIO_V4)}
commit;
`);
console.log(`${SAIDA}: ${REGRAS_INICIAIS.length} regras, ${itens.length} itens · ${SAIDA_V2}: ${REGRAS_V2.length} regras · ${SAIDA_CARDAPIO}: ${itens.length} itens`);
