import type postgres from "postgres";
import { z } from "zod";
import type { UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import { escoposTipo, type Regra } from "./motor";

const linhaRegra = z.object({
  id: z.string().uuid(), codigo: z.string(), versao: z.number().int(), titulo: z.string(), origem: z.string(),
  status: z.enum(["APROVADA", "PENDENTE"]), valor: z.unknown(), escopo_tipo: z.enum(escoposTipo), escopo_chave: z.string(),
  vigente_desde: z.string(), financeiro: z.boolean(), justificativa: z.string().nullable(),
  substitui_regra_id: z.string().uuid().nullable(), criado_em: z.string()
});

export const dataSaoPaulo = (instante: string | Date) => new Date(instante).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
export const PAPEIS_FINANCEIROS = ["ADMIN", "COMERCIAL", "ATENDIMENTO", "FINANCEIRO"] as const;

// Regras mudam raramente e são lidas em quase toda tela: ficam 60 s em memória; quem altera chama invalidarRegras().
// ponytail: cache por instância; alteração direta no banco (migração) aparece em até 60 s.
const REGRAS_TTL_MS = 60_000;
const global = globalThis as typeof globalThis & { pieggiRegras?: CacheRegras };
type CacheRegras = Map<boolean, { ate: number; regras: ReturnType<typeof lerRegras> }>;
const cacheRegras: CacheRegras = (global.pieggiRegras ??= new Map() as CacheRegras);
export function invalidarRegras() { cacheRegras.clear(); }

/** Todas as versões com valor. Preços, taxas e CMV (financeiro=true) só para perfis comerciais/financeiros. */
export function carregarRegras(sql: postgres.ISql, usuario: Pick<UsuarioAutenticado, "papeis">): ReturnType<typeof lerRegras> {
  const comFinanceiro = usuario.papeis.some((p) => (PAPEIS_FINANCEIROS as readonly string[]).includes(p));
  const atual = cacheRegras.get(comFinanceiro);
  if (atual && atual.ate > Date.now()) return atual.regras;
  const regras = lerRegras(sql, comFinanceiro);
  cacheRegras.set(comFinanceiro, { ate: Date.now() + REGRAS_TTL_MS, regras });
  regras.catch(() => cacheRegras.delete(comFinanceiro));
  return regras;
}

async function lerRegras(sql: postgres.ISql, comFinanceiro: boolean) {
  const linhas = await sql<{ j: unknown }[]>`
    select to_jsonb(r) j from (
      select id,codigo,versao,titulo,origem,status,valor,escopo_tipo,escopo_chave,vigente_desde,financeiro,justificativa,substitui_regra_id,criado_em
      from regras_negocio where valor is not null and status in ('APROVADA','PENDENTE') ${comFinanceiro ? sql`` : sql`and not financeiro`}) r
    order by r.codigo, r.versao`;
  return z.array(linhaRegra).parse(linhas.map((l) => l.j)).map((r) => ({
    id: r.id, codigo: r.codigo, versao: r.versao, titulo: r.titulo, origem: r.origem, status: r.status, valor: r.valor,
    escopoTipo: r.escopo_tipo, escopoChave: r.escopo_chave, vigenteDesde: dataSaoPaulo(r.vigente_desde), financeiro: r.financeiro,
    justificativa: r.justificativa, substituiRegraId: r.substitui_regra_id, criadoEm: r.criado_em
  } satisfies Regra & Record<string, unknown>));
}
