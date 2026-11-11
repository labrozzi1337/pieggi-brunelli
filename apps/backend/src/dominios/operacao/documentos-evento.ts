// Os 4 arquivos do evento (§12): proposta .pptx, programação .docx, comanda .docx e plaquinha .pdf.
// Sempre com as regras vigentes na data do evento (Caso 7). Documento com bloqueio, regra faltando, tradução faltando
// ou reprovado na validação de render não chega ao usuário: volta 409 com a lista de problemas.
import { z } from "zod";
import type { PapelUsuario, UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import type { Programacao } from "@/dominios/documentos/tipos";
import { DocumentoInvalidoError, gerarDocumentoValidado, type DocumentoGerado, type PedidoDocumento } from "@/dominios/documentos/validacao";
import type { TextosProgramacao } from "@/dominios/documentos/programacao-docx";
import { freelancersDoEvento, verbaDoEvento } from "@/dominios/equipe/freelancers";
import { gerarComanda } from "@/dominios/regras/comanda";
import { Leitor } from "@/dominios/regras/motor";
import { gerarPlaquinhas } from "@/dominios/regras/plaquinha";
import { gerarProgramacao, type ServicoVendido } from "@/dominios/regras/programacao";
import { gerarPropostaDoc } from "@/dominios/regras/proposta";
import type { Sql } from "@/integrations/banco";
import type { Leitura } from "./eventos";
import { ErroOperacao } from "./http";
import { contextoDoEvento, ErroBloqueio } from "./fluxo";

export const TIPOS_DOCUMENTO = ["proposta", "programacao", "comanda", "plaquinha"] as const;
export type TipoDocumentoEvento = (typeof TIPOS_DOCUMENTO)[number];

/** §13: comercial gera a proposta; operação/programação gera programação, comanda e plaquinha; cozinha e expedição leem a comanda. */
export const PAPEIS_DOCUMENTO: Record<TipoDocumentoEvento, PapelUsuario[]> = {
  proposta: ["ADMIN", "COMERCIAL", "ATENDIMENTO", "FINANCEIRO"],
  programacao: ["ADMIN", "PROGRAMACAO"],
  comanda: ["ADMIN", "PROGRAMACAO", "PRODUCAO", "EXPEDICAO_COMPRAS"],
  plaquinha: ["ADMIN", "PROGRAMACAO"]
};

const checklistSchema = z.object({
  checklistTitulo: z.string().min(1),
  checklist: z.array(z.object({ titulo: z.string(), texto: z.string().optional(), itens: z.array(z.string()) })).min(1)
}) satisfies z.ZodType<TextosProgramacao>;

const diagnosticoBloqueia = (d: { bloqueios: Array<{ codigo: string; mensagem: string }>; regrasFaltando: string[] }, ignorar: readonly string[] = []) => [
  ...d.bloqueios.filter((b) => !ignorar.includes(b.codigo)).map((b) => b.mensagem),
  ...d.regrasFaltando.map((f) => `Regra não cadastrada: ${f}`)
];

export interface ArquivoEvento extends DocumentoGerado { programacaoId: string | null; aprovada: boolean }

async function renderizar(pedido: PedidoDocumento, titulo: string) {
  try {
    return await gerarDocumentoValidado(pedido);
  } catch (e) {
    if (e instanceof DocumentoInvalidoError) throw new ErroBloqueio(`${titulo} reprovado na validação`, e.problemas);
    throw e;
  }
}

/** Programação vigente do evento: a aprovada; sem aprovada, a última (só para conferir o .docx da programação). */
async function programacaoDoEvento(sql: Leitura, eventoId: string) {
  const [p] = await sql<{ id: string; status: string; estrutura: Programacao | null; versao: number }[]>`
    select id, status, estrutura, versao from programacoes where evento_id = ${eventoId} and status <> 'INVALIDADA'
    order by (status = 'APROVADA') desc, versao desc limit 1`;
  return p;
}

export async function documentoDoEvento(sql: Sql, usuario: UsuarioAutenticado, eventoId: string, tipo: TipoDocumentoEvento): Promise<ArquivoEvento> {
  const ctx = await contextoDoEvento(sql, usuario, eventoId, PAPEIS_DOCUMENTO[tipo]);

  if (tipo === "proposta") {
    const [p] = await sql<{ briefing: { servicos?: ServicoVendido[]; restricoes?: string; restritos?: number; cobrancaRestritos?: string; tabela?: string }; itens: Array<{ quantidade: number; preco: number }>; desconto: number; validade: string }[]>`
      select briefing, itens, desconto, validade::text validade from propostas where evento_id = ${eventoId} and status <> 'INVALIDADA'
      order by (status = 'APROVADA') desc, versao desc limit 1`;
    if (!p) throw new ErroOperacao("O evento ainda não tem proposta. Confirme o resumo para gerar a proposta.", 409);
    const servicos = p.briefing.servicos;
    if (!servicos?.length) throw new ErroOperacao("Esta proposta foi feita antes do fluxo guiado e não tem os serviços estruturados. Gere uma nova pelo evento.", 409);
    const tabela = p.briefing.tabela ?? ctx.tabela;
    const datas = [...new Set(servicos.map((s) => s.data))].sort();
    const cabecalho = { ...ctx.cabecalho, datas, restricoes: p.briefing.restricoes ? p.briefing.restricoes.split(", ") : [] };
    const prog = gerarProgramacao(ctx.regras, ctx.catalogo, { cabecalho, regioes: ctx.regioes, servicos });
    const bruto = p.itens.reduce((a, i) => a + i.quantidade * i.preco, 0);
    const horas = (s: ServicoVendido) => { const m = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5)); return Math.max(0, m(s.horarioFim) - m(s.horarioInicio)) / 60; };
    const restritos = p.briefing.restritos ?? 0;
    const pago = p.briefing.cobrancaRestritos === "PAGO";
    const doc = gerarPropostaDoc(ctx.regras, {
      cabecalho, data: ctx.data, tabela, regioes: ctx.regioes, descontoPercentual: bruto > 0 ? p.desconto / bruto : 0, validade: p.validade,
      opcoes: [{ servicos: servicos.map((s) => {
        const cardapio = prog.servicos.find((x) => x.id === s.id);
        return { linha: s.linha, tier: s.tier, pax: s.pax, horas: horas(s), descritivo: (s as { descritivo?: string }).descritivo || `${cardapio?.nome ?? s.linha} ${s.tier}`, cardapio };
      }) }],
      restricoes: restritos ? [{ descritivo: `Restrições alimentares${pago ? " (incluídas no total)" : ""}: ${p.briefing.restricoes ?? ""}`, pax: restritos, cortesia: !pago, ...(pago ? { valorCentavos: 0 } : {}) }] : []
    }, ctx.catalogo);
    // Desconto e CMV já foram autorizados ao salvar a versão (diretoria libera salvando); aqui não travam o arquivo.
    const problemas = [...diagnosticoBloqueia(prog), ...diagnosticoBloqueia(doc, ["DESCONTO", "CMV"])];
    if (problemas.length) throw new ErroBloqueio("Proposta bloqueada", problemas);
    return { ...(await renderizar({ tipo: "PROPOSTA", dados: doc }, "Proposta")), programacaoId: null, aprovada: false };
  }

  const p = await programacaoDoEvento(sql, eventoId);
  if (!p) throw new ErroOperacao("Gere a programação do evento primeiro.", 409);
  if (!p.estrutura) throw new ErroOperacao("Esta programação foi digitada antes do motor. Gere a programação pelo evento para liberar os arquivos.", 409);
  const aprovada = p.status === "APROVADA";
  if (tipo !== "programacao" && !aprovada) throw new ErroOperacao("Aprove a programação para liberar comanda e plaquinha.", 409);
  const estrutura = p.estrutura;
  const data = [...new Set(estrutura.servicos.map((s) => s.data))].sort()[0] ?? ctx.data;

  if (tipo === "programacao") {
    const leitor = new Leitor(ctx.regras, { data, cliente: estrutura.cabecalho.clienteChave ?? undefined });
    const textos = leitor.ler("programacao.checklist", checklistSchema);
    if (!textos) throw new ErroBloqueio("Programação bloqueada", diagnosticoBloqueia({ bloqueios: [], regrasFaltando: [...leitor.faltando] }));
    return { ...(await renderizar({ tipo: "PROGRAMACAO", dados: estrutura, textos }, "Programação")), programacaoId: p.id, aprovada };
  }

  if (tipo === "comanda") {
    const [freelancers, verbaCentavos] = await Promise.all([freelancersDoEvento(sql, eventoId), verbaDoEvento(sql, eventoId)]);
    // ponytail: locações extras ainda não têm cadastro; a página da Adriana sai "Não solicitado". Ligar quando existir a tabela.
    const c = gerarComanda(ctx.regras, estrutura, { freelancers: freelancers || null, locacoes: [], verbaCentavos });
    const problemas = diagnosticoBloqueia(c);
    if (problemas.length) throw new ErroBloqueio("Comanda bloqueada", problemas);
    return { ...(await renderizar({ tipo: "COMANDA", dados: { cabecalho: c.cabecalho, paginas: c.paginas, adriana: c.adriana } }, "Comanda")), programacaoId: p.id, aprovada };
  }

  const pl = gerarPlaquinhas(ctx.regras, estrutura);
  const problemas = [...diagnosticoBloqueia(pl, ["TRADUCAO"]), ...pl.faltandoTraducao.map((t) => `Falta tradução EN/ES: ${t}`)];
  if (problemas.length) throw new ErroBloqueio("Plaquinha bloqueada", problemas);
  return { ...(await renderizar({ tipo: "PLAQUINHA", dados: { cabecalho: pl.cabecalho, dias: pl.dias } }, "Plaquinha")), programacaoId: p.id, aprovada };
}

/** Content-Disposition com nome UTF-8 (RFC 5987) e alternativa ASCII. */
export function disposicao(nome: string) {
  const ascii = nome.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}
