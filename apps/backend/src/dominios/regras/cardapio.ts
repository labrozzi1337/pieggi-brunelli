// Leitura das regras de cardápio (classificação, selo, roteamento, vocabulário, glossário) para um contexto.
// Usado por programação, comanda, plaquinha e proposta.
import { z } from "zod";
import type { Estacao, Fornecedor, ItemCatalogo, Selo } from "@/dominios/documentos/tipos";
import { Leitor, type Regra, type Trava } from "./motor";
import { baseDoItem, classificar, contemAlgum, normalizar, rotear, seloDoItem, type CategoriaRegra, type RotaRegra, type TipoItem } from "./classificacao";

export const ESTACOES = ["COZINHA_QUENTE", "COZINHA_FRIA", "CONFEITARIA", "EXPEDICAO_ALIMENTACAO", "EXPEDICAO_BEBIDAS"] as const satisfies readonly Estacao[];
export const FORNECEDORES = ["PAD_LETICIA", "SALGADERIA_LEAL", "PADARIA_CPL", "POP_VEGAN", "MERCADO"] as const satisfies readonly Fornecedor[];
const tipos = ["SALGADO", "DOCE", "SHOT", "MISTO", "BEBIDA", "BASE"] as const;
const textos = z.array(z.string());
export const registro = <T extends z.ZodTypeAny>(v: T) => z.record(z.string(), v);

const categoriasSchema = z.array(z.object({
  grupo: z.string().optional(), termos: textos.optional(), rotulo: z.string(), prefixos: textos.optional(), conector: z.string().optional(), tipo: z.enum(tipos),
  receitaSemRotulo: z.boolean().optional()   // o nome do item já é a receita inteira (ex.: estação de coquetel)
}));
const rotasSchema = z.array(z.object({
  termos: textos, estacao: z.enum(ESTACOES), fornecedor: z.enum(FORNECEDORES).optional(), compradoPronto: z.boolean().optional(),
  tipos: z.array(z.enum(tipos)).optional(), linhas: textos.optional()
}));
const seloSchema = z.object({ semSelo: textos, vegano: textos, vegetariano: textos });
const vocabularioSchema = z.array(z.object({ proibido: z.string().min(1), correto: z.string(), exato: z.boolean().optional() }));
const glossarioSchema = registro(z.tuple([z.string(), z.string()]));

export interface ItemClassificado {
  nome: string; rotulo: string; sabor: string | null; tipo: TipoItem; base: string; selo: Selo | null; conector?: string;
  catalogo?: ItemCatalogo;
}

/** Regras de cardápio lidas uma vez por contexto (data + cliente). */
export class Dicionario {
  readonly categorias: CategoriaRegra[];
  readonly rotas: RotaRegra[];
  readonly selo: z.infer<typeof seloSchema> | undefined;
  readonly bases: string[];
  readonly queijo: string[];
  readonly vocabulario: z.infer<typeof vocabularioSchema>;
  readonly glossario: Record<string, [string, string]>;
  readonly tiers: string[];
  private readonly glossarioNormalizado: Map<string, [string, string]>;

  constructor(readonly leitor: Leitor) {
    this.categorias = leitor.ler("cardapio.categorias", categoriasSchema) ?? [];
    this.rotas = leitor.ler("roteamento.estacao", rotasSchema) ?? [];
    this.selo = leitor.ler("selo.classificacao", seloSchema);
    this.bases = leitor.ler("cardapio.bases", textos) ?? [];
    this.queijo = leitor.ler("cardapio.queijo", textos) ?? [];
    this.vocabulario = leitor.ler("vocabulario_travado", vocabularioSchema, {}, false) ?? [];
    this.glossario = leitor.ler("glossario", glossarioSchema) ?? {};
    this.tiers = leitor.ler("tiers.ordem", textos) ?? [];
    this.glossarioNormalizado = new Map(Object.entries(this.glossario).map(([pt, t]) => [normalizar(pt), t]));
  }

  classificar(nome: string, grupo?: string | null, catalogo?: ItemCatalogo): ItemClassificado {
    const c = classificar(this.categorias, nome, grupo, this.queijo);
    const texto = `${c.rotulo} ${nome}`;
    const selo = catalogo?.selo ?? (this.selo ? seloDoItem(this.selo, texto) : null);
    return { nome, ...c, base: baseDoItem(this.bases, nome), selo, catalogo };
  }

  doCatalogo(item: ItemCatalogo) {
    return this.classificar(item.nome, item.categoria, item);
  }

  /** Estação e fornecedor: o cadastro do item vence; senão a regra de roteamento. */
  rota(c: Pick<ItemClassificado, "rotulo" | "tipo" | "catalogo">, receita: string, linha?: string) {
    const r = rotear(this.rotas, `${c.rotulo} ${receita}`, c.tipo, linha);
    const estacaoCadastro = c.catalogo?.estacao === "BEBIDAS" ? "EXPEDICAO_BEBIDAS" : c.catalogo?.estacao;
    const estacao = (ESTACOES as readonly string[]).includes(estacaoCadastro ?? "") ? estacaoCadastro as Estacao : r?.estacao ?? "EXPEDICAO_ALIMENTACAO";
    const fornecedor = (FORNECEDORES as readonly string[]).includes(c.catalogo?.fornecedor ?? "") ? c.catalogo!.fornecedor as Fornecedor : r?.fornecedor ?? null;
    return { estacao, fornecedor, compradoPronto: r?.compradoPronto ?? false };
  }

  tierPermitido(itemTier: string, contratado: string) {
    const i = this.tiers.indexOf(itemTier);
    return i < 0 || i <= this.tiers.indexOf(contratado);
  }

  traduzir(pt: string | null | undefined): [string, string] | undefined {
    return pt ? this.glossarioNormalizado.get(normalizar(pt)) : undefined;
  }

  /** Vocabulário travado: troca o termo proibido pelo correto. "exato" casa só a palavra inteira, com a mesma caixa. */
  limpar(texto: string) {
    let saida = texto;
    for (const v of this.vocabulario) {
      const termo = v.proibido.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      saida = saida.replace(new RegExp(`(?<![\\p{L}\\d])${termo}(?![\\p{L}\\d])`, v.exato ? "gu" : "giu"), v.correto);
    }
    return saida;
  }
}

export interface Diagnostico { avisos: string[]; bloqueios: Trava[]; regrasFaltando: string[]; regrasPendentes: Array<{ codigo: string; titulo: string }> }

/** Junta faltas e pendências de vários leitores (um por serviço/linha). */
export function diagnostico(leitores: readonly Leitor[], avisos: string[], bloqueios: Trava[]): Diagnostico {
  const faltando = new Set<string>();
  const pendentes = new Map<string, string>();
  for (const l of leitores) {
    l.faltando.forEach((f) => faltando.add(f));
    l.pendentes.forEach((t, c) => pendentes.set(c, t));
  }
  return { avisos: [...new Set(avisos)], bloqueios, regrasFaltando: [...faltando], regrasPendentes: [...pendentes].map(([codigo, titulo]) => ({ codigo, titulo })) };
}

export const contemTermo = contemAlgum;
export const novoLeitor = (regras: readonly Regra[], data: string, cliente?: string | null, regioes?: readonly string[]) =>
  new Leitor(regras, { data, cliente: cliente ?? undefined, regioes });

export function formatarNumero(n: number, casas = 3) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: casas });
}

export function formatarReais(centavos: number) {
  return `R$ ${(centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function preencher(texto: string, valores: Record<string, string | number>) {
  return texto.replace(/\{(\w+)\}/g, (m, chave: string) => (chave in valores ? String(valores[chave]) : m));
}
