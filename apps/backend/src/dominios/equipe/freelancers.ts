import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { autorizarEmpresa, ErroAutorizacao, exigirPapel, type UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import { cifrarSegredoFiscal, decifrarSegredoFiscal } from "@/dominios/fiscal/criptografia";
import { auditar, ErroOperacao } from "@/dominios/operacao/http";
import { Leitor, resolverRegra, type Regra } from "@/dominios/regras/motor";
import { carregarRegras, dataSaoPaulo } from "@/dominios/regras/repositorio";
import { banco, type Sql, type Tx } from "@/integrations/banco";
import {
  calcularVerba, centavos, cnpjValido, CODIGO_DIARIA, CODIGO_VERBA, compararVerba, faixaDiaria, formatarCnpj,
  montarRelatorio, reais, soDigitos, valorDaDiaria, type DiariaRelatorio
} from "./regras-freelancer";

// Módulo 7 — Freelancers e diárias. Toda regra, trava, cifragem e auditoria acontece aqui; o banco só guarda.

type Db = Sql | Tx;

/** Consulta do módulo, inclusive dados pessoais (LGPD: só quem agenda e quem paga). */
export const PAPEIS_FREELANCERS = ["ADMIN", "EXPEDICAO_COMPRAS", "FINANCEIRO"] as const;
/** Cadastro e escala: Logística (Adriana). */
export const PAPEIS_ESCALA = ["ADMIN", "EXPEDICAO_COMPRAS"] as const;
/** Fechamento e baixa de pagamento. */
export const PAPEIS_PAGAMENTO = ["ADMIN", "FINANCEIRO"] as const;

// ---------------------------------------------------------------- Dados pessoais cifrados

function chaveDados() {
  const chave = process.env.PIEGGI_CHAVE_CIFRAGEM_DADOS || process.env.PIEGGI_CHAVE_CIFRAGEM_FISCAL;
  if (!chave) throw new ErroAutorizacao("Configure PIEGGI_CHAVE_CIFRAGEM_DADOS no backend para guardar dados pessoais.", 503);
  return chave;
}
const cifrar = (v: string) => (v ? cifrarSegredoFiscal(v, chaveDados()) : null);
const decifrar = (v: string | null) => (v ? decifrarSegredoFiscal(v, chaveDados()) : "");
const hashCnpj = (digitos: string) => createHmac("sha256", Buffer.from(chaveDados(), "base64")).update(`cnpj:${digitos}`).digest("hex");

// ---------------------------------------------------------------- Regras

/** Leitura interna do backend: custo de diária e verba são calculados aqui (inclui regras financeiras). */
async function regras(): Promise<Regra[]> {
  return carregarRegras(banco(), { papeis: ["FINANCEIRO"] });
}

/** Funções com valor padrão na tabela (regra freelancer.diaria por ITEM) vigente na data. */
export function tabelaDiarias(lista: readonly Regra[], data: string) {
  const funcoes = [...new Set(lista.filter((r) => r.codigo === CODIGO_DIARIA && r.escopoTipo === "ITEM").map((r) => r.escopoChave))].sort();
  return {
    funcoes: funcoes.map((funcao) => {
      const r = resolverRegra(lista, CODIGO_DIARIA, { data, item: funcao });
      const valor = typeof r?.valor === "number" ? r.valor : null;
      return { funcao, valorCentavos: valor === null ? null : centavos(valor), pendente: r?.status === "PENDENTE" };
    }),
    faixa: faixaDiaria(new Leitor(lista, { data })) ?? null
  };
}

export async function consultarTabela(data = dataSaoPaulo(new Date())) {
  return tabelaDiarias(await regras(), data);
}

// ---------------------------------------------------------------- Cadastro

const dinheiro = z.number().positive().max(100000).refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "Use no máximo duas casas decimais.");
export const freelancerEntrada = z.object({
  nome: z.string().trim().min(2).max(200),
  cnpj: z.string().trim().refine(cnpjValido, "CNPJ inválido: confira os 14 dígitos."),
  celular: z.string().trim().refine((v) => /^\d{10,13}$/.test(soDigitos(v)), "Celular/WhatsApp inválido: informe DDD e número."),
  pix: z.string().trim().min(3).max(140),
  funcoes: z.array(z.string().regex(/^[A-Z0-9_]{2,40}$/)).min(1).max(10),
  valorDiaria: dinheiro.nullable(),
  documentosPath: z.string().trim().max(500).nullable()
}).strict();
export type FreelancerEntrada = z.infer<typeof freelancerEntrada>;

interface LinhaFreelancer {
  id: string; empresa_id: string; nome: string; cnpj_cifrado: string | null; celular_cifrado: string | null; pix_cifrado: string | null;
  funcoes: string[]; valor_diaria: number | null; documentos_path: string | null; ativo: boolean; anonimizado_em: string | null; criado_em: string;
}

function paraDto(f: LinhaFreelancer) {
  return {
    id: f.id, nome: f.nome, cnpj: formatarCnpj(decifrar(f.cnpj_cifrado)), celular: decifrar(f.celular_cifrado), pix: decifrar(f.pix_cifrado),
    funcoes: f.funcoes, valorDiaria: f.valor_diaria, documentosPath: f.documentos_path, ativo: f.ativo, anonimizado: !!f.anonimizado_em, criadoEm: f.criado_em
  };
}

async function validarCadastro(d: FreelancerEntrada) {
  const lista = await regras();
  const tabela = tabelaDiarias(lista, dataSaoPaulo(new Date()));
  const desconhecidas = d.funcoes.filter((f) => !tabela.funcoes.some((t) => t.funcao === f));
  if (desconhecidas.length) throw new ErroOperacao(`Função sem valor na tabela de diárias: ${desconhecidas.join(", ")}. Peça ao admin para cadastrá-la.`, 422);
  if (d.valorDiaria !== null && tabela.faixa && (d.valorDiaria < tabela.faixa.min || d.valorDiaria > tabela.faixa.max)) {
    throw new ErroOperacao(`Diária individual fora da faixa de R$ ${tabela.faixa.min} a R$ ${tabela.faixa.max}.`, 422);
  }
}

async function freelancerTravado(tx: Tx, usuario: UsuarioAutenticado, id: string) {
  const [f] = await tx<LinhaFreelancer[]>`select * from freelancers where id = ${id} for update`;
  if (!f) throw new ErroOperacao("Freelancer não encontrado.", 404);
  autorizarEmpresa(usuario, f.empresa_id);
  if (f.anonimizado_em) throw new ErroOperacao("Cadastro anonimizado: não pode ser alterado.", 409);
  return f;
}

export async function criarFreelancer(tx: Tx, usuario: UsuarioAutenticado, empresaId: string, d: FreelancerEntrada) {
  exigirPapel(usuario, PAPEIS_ESCALA); autorizarEmpresa(usuario, empresaId);
  await validarCadastro(d);
  const id = randomUUID(); const cnpj = soDigitos(d.cnpj);
  await tx`insert into freelancers (id, empresa_id, nome, cnpj_cifrado, cnpj_hash, celular_cifrado, pix_cifrado, funcoes, valor_diaria, documentos_path, criado_por)
    values (${id}, ${empresaId}, ${d.nome}, ${cifrar(cnpj)}, ${hashCnpj(cnpj)}, ${cifrar(soDigitos(d.celular))}, ${cifrar(d.pix)}, ${d.funcoes}, ${d.valorDiaria}, ${d.documentosPath}, ${usuario.id})`;
  await auditar(tx, usuario, { acao: "FREELANCER_CRIAR", entidade: "freelancer", entidadeId: id, empresaId, dados: { nome: d.nome, funcoes: d.funcoes, valorDiaria: d.valorDiaria } });
  return { id };
}

export async function editarFreelancer(tx: Tx, usuario: UsuarioAutenticado, id: string, d: FreelancerEntrada) {
  exigirPapel(usuario, PAPEIS_ESCALA);
  const antes = await freelancerTravado(tx, usuario, id);
  await validarCadastro(d);
  const cnpj = soDigitos(d.cnpj); const anterior = paraDto(antes);
  await tx`update freelancers set nome = ${d.nome}, cnpj_cifrado = ${cifrar(cnpj)}, cnpj_hash = ${hashCnpj(cnpj)}, celular_cifrado = ${cifrar(soDigitos(d.celular))},
    pix_cifrado = ${cifrar(d.pix)}, funcoes = ${d.funcoes}, valor_diaria = ${d.valorDiaria}, documentos_path = ${d.documentosPath}, atualizado_em = now()
    where id = ${id}`;
  // Auditoria sem dado pessoal em texto puro: registra só QUAIS campos pessoais mudaram.
  const pessoais = [soDigitos(anterior.cnpj) !== cnpj && "cnpj", anterior.celular !== soDigitos(d.celular) && "celular", anterior.pix !== d.pix && "pix"].filter(Boolean);
  await auditar(tx, usuario, { acao: "FREELANCER_EDITAR", entidade: "freelancer", entidadeId: id, empresaId: antes.empresa_id, dados: {
    antes: { nome: antes.nome, funcoes: antes.funcoes, valorDiaria: antes.valor_diaria },
    depois: { nome: d.nome, funcoes: d.funcoes, valorDiaria: d.valorDiaria }, dadosPessoaisAlterados: pessoais } });
  return { id };
}

/** Inativar/reativar (Logística) ou anonimizar (ADMIN, política de retenção da LGPD). */
export async function alterarSituacaoFreelancer(tx: Tx, usuario: UsuarioAutenticado, id: string, acao: "INATIVAR" | "REATIVAR" | "ANONIMIZAR", motivo: string) {
  exigirPapel(usuario, acao === "ANONIMIZAR" ? ["ADMIN"] : PAPEIS_ESCALA);
  const f = await freelancerTravado(tx, usuario, id);
  if (acao === "ANONIMIZAR") {
    const [pendente] = await tx`select 1 from freelancer_diarias where freelancer_id = ${id} and status = 'PENDENTE' limit 1`;
    if (pendente) throw new ErroOperacao("Há diárias pendentes de pagamento: feche o pagamento antes de anonimizar.", 409);
    // Diárias e pagamentos ficam (registro financeiro), mas sem nome, CNPJ, celular, PIX ou documentos.
    await tx`update freelancers set nome = 'Freelancer anonimizado', cnpj_cifrado = null, cnpj_hash = null, celular_cifrado = null, pix_cifrado = null,
      documentos_path = null, ativo = false, anonimizado_em = now(), atualizado_em = now() where id = ${id}`;
  } else {
    await tx`update freelancers set ativo = ${acao === "REATIVAR"}, atualizado_em = now() where id = ${id}`;
  }
  await auditar(tx, usuario, { acao: `FREELANCER_${acao}`, entidade: "freelancer", entidadeId: id, empresaId: f.empresa_id, dados: { motivo, ativoAntes: f.ativo } });
  return { id };
}

export async function listarFreelancers(sql: Sql, usuario: UsuarioAutenticado, empresaId: string) {
  exigirPapel(usuario, PAPEIS_FREELANCERS); autorizarEmpresa(usuario, empresaId);
  const linhas = await sql<(LinhaFreelancer & { eventos: number; ultima_diaria: string | null })[]>`
    select f.*, count(distinct d.evento_id)::int as eventos, max(d.data)::text as ultima_diaria
    from freelancers f left join freelancer_diarias d on d.freelancer_id = f.id and d.status <> 'CANCELADA'
    where f.empresa_id = ${empresaId} group by f.id order by f.ativo desc, f.nome`;
  return linhas.map((l) => ({ ...paraDto(l), eventos: l.eventos, ultimaDiaria: l.ultima_diaria }));
}

/** Histórico de eventos trabalhados (uma linha por diária). */
export async function historicoFreelancer(sql: Sql, usuario: UsuarioAutenticado, id: string) {
  exigirPapel(usuario, PAPEIS_FREELANCERS);
  const [f] = await sql<LinhaFreelancer[]>`select * from freelancers where id = ${id}`;
  if (!f) throw new ErroOperacao("Freelancer não encontrado.", 404);
  autorizarEmpresa(usuario, f.empresa_id);
  const diarias = await sql<{ id: string; evento_id: string; evento: string; data: string; funcao: string; local: string; valor: number; status: string; pago_em: string | null }[]>`
    select d.id, d.evento_id, e.titulo as evento, d.data::text, d.funcao, d.local, d.valor, d.status, p.pago_em::text
    from freelancer_diarias d join eventos e on e.id = d.evento_id left join freelancer_pagamentos p on p.id = d.pagamento_id
    where d.freelancer_id = ${id} order by d.data desc`;
  return { freelancer: paraDto(f), diarias: diarias.map((d) => ({ ...d, valorCentavos: centavos(d.valor) })) };
}

// ---------------------------------------------------------------- Verba e escala do evento

/** Verba de freelancer do evento em centavos: verba.percentual (8%) × orçamento total aprovado. */
export async function verbaDoEvento(sql: Db, eventoId: string): Promise<number> {
  const [e] = await sql<{ data_evento: string | null; chave: string | null; total: number | null }[]>`
    select e.data_evento::text, c.chave_regras as chave,
      coalesce(v.valor_venda, (select p.total from propostas p where p.evento_id = e.id and p.status = 'APROVADA' order by p.versao desc limit 1)) as total
    from eventos e join clientes c on c.id = e.cliente_id left join evento_valores v on v.evento_id = e.id where e.id = ${eventoId}`;
  if (!e?.total) return 0;
  const leitor = new Leitor(await regras(), { data: e.data_evento ?? dataSaoPaulo(new Date()), cliente: e.chave ?? undefined });
  return calcularVerba(centavos(e.total), leitor.ler(CODIGO_VERBA, z.number().min(0).max(1)) ?? 0);
}

/** Nº de freelancers contratados (pessoas distintas na escala) — comanda e dimensionamento de uniforme/luvas/toucas. */
export async function freelancersDoEvento(sql: Db, eventoId: string): Promise<number> {
  const [r] = await sql<{ n: number }[]>`select count(distinct freelancer_id)::int as n from freelancer_diarias where evento_id = ${eventoId} and status <> 'CANCELADA'`;
  return r?.n ?? 0;
}

/** Custo de mão de obra freelancer do evento em centavos (diárias não canceladas, valores congelados). */
export async function custoEquipeDoEvento(sql: Db, eventoId: string): Promise<number> {
  const [r] = await sql<{ total: number }[]>`select coalesce(sum(valor), 0) as total from freelancer_diarias where evento_id = ${eventoId} and status <> 'CANCELADA'`;
  return centavos(r?.total ?? 0);
}

interface EventoEscala { id: string; empresa_id: string; titulo: string; data_evento: string | null; horario_inicio: string | null; horario_fim: string | null; local: string }
const colunasEvento = (sql: Db) => sql`e.id, e.empresa_id, e.titulo, e.data_evento::text, e.horario_inicio::text, e.horario_fim::text,
  trim(concat_ws(', ', nullif(concat_ws(' ', e.logradouro, e.numero_endereco), ''), e.complemento, e.bairro, e.cidade)) as local`;

/** Eventos para escalar: dos últimos 60 dias em diante, exceto perdidos. */
export async function eventosParaEscala(sql: Sql, empresaId: string) {
  return sql<EventoEscala[]>`select ${colunasEvento(sql)} from eventos e
    where e.empresa_id = ${empresaId} and e.etapa_comercial <> 'PERDIDO' and (e.data_evento is null or e.data_evento >= current_date - 60)
    order by e.data_evento nulls last, e.titulo limit 500`;
}

export async function escalaDoEvento(sql: Sql, usuario: UsuarioAutenticado, eventoId: string) {
  exigirPapel(usuario, PAPEIS_FREELANCERS);
  const [evento] = await sql<EventoEscala[]>`select ${colunasEvento(sql)} from eventos e where e.id = ${eventoId}`;
  if (!evento) throw new ErroOperacao("Evento não encontrado.", 404);
  autorizarEmpresa(usuario, evento.empresa_id);
  const diarias = await sql<{ id: string; freelancer_id: string; nome: string; funcao: string; data: string; inicio: string; fim: string; local: string; valor: number; valor_origem: string; status: string; conflitos: number }[]>`
    select d.id, d.freelancer_id, f.nome, d.funcao, d.data::text, to_char(d.inicio, 'HH24:MI') as inicio, to_char(d.fim, 'HH24:MI') as fim, d.local, d.valor, d.valor_origem, d.status,
      (select count(*)::int from freelancer_diarias o where o.freelancer_id = d.freelancer_id and o.data = d.data and o.evento_id <> d.evento_id and o.status <> 'CANCELADA') as conflitos
    from freelancer_diarias d join freelancers f on f.id = d.freelancer_id
    where d.evento_id = ${eventoId} and d.status <> 'CANCELADA' order by d.data, f.nome`;
  const [verba, custo, pessoas] = await Promise.all([verbaDoEvento(sql, eventoId), custoEquipeDoEvento(sql, eventoId), freelancersDoEvento(sql, eventoId)]);
  return {
    evento, freelancers: pessoas, verba: compararVerba(verba, custo),
    diarias: diarias.map(({ conflitos, valor, ...d }) => ({ ...d, valorCentavos: centavos(valor), outroEventoNoDia: conflitos > 0 }))
  };
}

// ---------------------------------------------------------------- Lançamento de diárias

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM.");
export const diariaEntrada = z.object({
  freelancerId: z.string().uuid(), eventoId: z.string().uuid(), data: z.string().date(), funcao: z.string().regex(/^[A-Z0-9_]{2,40}$/),
  inicio: hora, fim: hora, local: z.string().trim().max(300)
}).strict().refine((d) => d.inicio !== d.fim, "Início e fim não podem ser iguais.");
export const diariaEdicao = z.object({
  id: z.string().uuid(), data: z.string().date().optional(), funcao: z.string().regex(/^[A-Z0-9_]{2,40}$/).optional(),
  inicio: hora.optional(), fim: hora.optional(), local: z.string().trim().max(300).optional(),
  valor: dinheiro.optional(), justificativa: z.string().trim().max(1000).optional()
}).strict();

interface LinhaDiaria {
  id: string; empresa_id: string; freelancer_id: string; evento_id: string; data: string; funcao: string; inicio: string; fim: string;
  local: string; valor: number; valor_origem: string; status: "PENDENTE" | "PAGO" | "CANCELADA"; pagamento_id: string | null; motivo: string | null;
}

async function resolverValor(funcao: string, data: string, individual: number | null) {
  const v = valorDaDiaria(new Leitor(await regras(), { data }), funcao, individual);
  if (!v) throw new ErroOperacao(`Função ${funcao} sem valor de diária na tabela vigente em ${data.split("-").reverse().join("/")}.`, 422);
  return v;
}

const descricaoCusto = (funcao: string, data: string) => `Diária freelancer · ${funcao} · ${data.slice(8, 10)}/${data.slice(5, 7)}`;

async function outrosEventosNoDia(tx: Tx, freelancerId: string, data: string, eventoId: string) {
  const r = await tx<{ titulo: string }[]>`select e.titulo from freelancer_diarias d join eventos e on e.id = d.evento_id
    where d.freelancer_id = ${freelancerId} and d.data = ${data} and d.evento_id <> ${eventoId} and d.status <> 'CANCELADA'`;
  return r.map((x) => `Esta pessoa também está escalada em "${x.titulo}" no mesmo dia: decida se paga uma ou duas diárias.`);
}

/** Lança uma diária com o valor CONGELADO (individual ou padrão da função na data) e rateia no custo do evento. */
export async function lancarDiaria(tx: Tx, usuario: UsuarioAutenticado, d: z.infer<typeof diariaEntrada>) {
  exigirPapel(usuario, PAPEIS_ESCALA);
  const [evento] = await tx<{ empresa_id: string }[]>`select empresa_id from eventos where id = ${d.eventoId} for share`;
  if (!evento) throw new ErroOperacao("Evento não encontrado.", 404);
  autorizarEmpresa(usuario, evento.empresa_id);
  const [f] = await tx<LinhaFreelancer[]>`select * from freelancers where id = ${d.freelancerId} for share`;
  if (!f || f.empresa_id !== evento.empresa_id) throw new ErroOperacao("Freelancer não encontrado.", 404);
  if (!f.ativo) throw new ErroOperacao("Freelancer inativo: reative o cadastro antes de escalar.", 409);
  const [repetida] = await tx`select 1 from freelancer_diarias where freelancer_id = ${d.freelancerId} and evento_id = ${d.eventoId} and data = ${d.data} and status <> 'CANCELADA'`;
  if (repetida) throw new ErroOperacao("Esta pessoa já tem diária neste evento e neste dia.", 409);
  const valor = await resolverValor(d.funcao, d.data, f.valor_diaria);
  const id = randomUUID();
  await tx`insert into freelancer_diarias (id, empresa_id, freelancer_id, evento_id, data, funcao, inicio, fim, local, valor, valor_origem, criado_por)
    values (${id}, ${evento.empresa_id}, ${d.freelancerId}, ${d.eventoId}, ${d.data}, ${d.funcao}, ${d.inicio}, ${d.fim}, ${d.local}, ${reais(valor.valorCentavos)}, ${valor.origem}, ${usuario.id})`;
  // Rateio: a diária entra no custo real do evento (evento_custos, categoria EQUIPE), ligada pela idempotência = id da diária.
  await tx`insert into evento_custos (id, empresa_id, evento_id, categoria, descricao, valor, competencia, referencia, idempotencia, criado_por)
    values (${randomUUID()}, ${evento.empresa_id}, ${d.eventoId}, 'EQUIPE', ${descricaoCusto(d.funcao, d.data)}, ${reais(valor.valorCentavos)}, ${d.data}, 'Escala de freelancers', ${id}, ${usuario.id})`;
  await auditar(tx, usuario, { acao: "DIARIA_LANCAR", entidade: "freelancer_diaria", entidadeId: id, empresaId: evento.empresa_id, dados: { ...d, valorCentavos: valor.valorCentavos, origem: valor.origem } });
  return { id, valorCentavos: valor.valorCentavos, origem: valor.origem, alertas: await outrosEventosNoDia(tx, d.freelancerId, d.data, d.eventoId) };
}

async function diariaTravada(tx: Tx, usuario: UsuarioAutenticado, id: string) {
  const [d] = await tx<LinhaDiaria[]>`select id, empresa_id, freelancer_id, evento_id, data::text, funcao, to_char(inicio, 'HH24:MI') as inicio, to_char(fim, 'HH24:MI') as fim,
    local, valor, valor_origem, status, pagamento_id, motivo from freelancer_diarias where id = ${id} for update`;
  if (!d) throw new ErroOperacao("Diária não encontrada.", 404);
  autorizarEmpresa(usuario, d.empresa_id);
  if (d.status === "CANCELADA") throw new ErroOperacao("Diária cancelada: lance uma nova.", 409);
  return d;
}

/** Diária paga (período fechado) ou ajuste manual de valor: só ADMIN, com justificativa, auditado (antes/depois). */
function exigirLiberacao(usuario: UsuarioAutenticado, justificativa: string | undefined, motivo: string) {
  if (!usuario.papeis.includes("ADMIN")) throw new ErroAutorizacao(`${motivo} Só o admin altera, com justificativa.`, 403);
  if (!justificativa || justificativa.length < 5) throw new ErroOperacao(`${motivo} Informe a justificativa (mínimo 5 caracteres).`, 422);
}

export async function editarDiaria(tx: Tx, usuario: UsuarioAutenticado, e: z.infer<typeof diariaEdicao>) {
  exigirPapel(usuario, PAPEIS_ESCALA);
  const antes = await diariaTravada(tx, usuario, e.id);
  if (antes.status === "PAGO") exigirLiberacao(usuario, e.justificativa, "Diária de período fechado e pago.");
  else if (e.valor !== undefined) exigirLiberacao(usuario, e.justificativa, "O valor da diária é congelado no lançamento.");
  const depois = { data: e.data ?? antes.data, funcao: e.funcao ?? antes.funcao, inicio: e.inicio ?? antes.inicio, fim: e.fim ?? antes.fim, local: e.local ?? antes.local };
  if (depois.inicio === depois.fim) throw new ErroOperacao("Início e fim não podem ser iguais.", 422);
  let valorCentavos = centavos(antes.valor); let origem = antes.valor_origem;
  if (e.valor !== undefined) { valorCentavos = centavos(e.valor); origem = "AJUSTE"; }
  else if (depois.funcao !== antes.funcao) {
    // Trocar a função é relançar: valor da nova função (ou individual) na data, congelado de novo.
    const [f] = await tx<{ valor_diaria: number | null }[]>`select valor_diaria from freelancers where id = ${antes.freelancer_id}`;
    ({ valorCentavos, origem } = await resolverValor(depois.funcao, depois.data, f?.valor_diaria ?? null));
  }
  // ponytail: diária já paga com valor ajustado não reabre o pagamento registrado; a diferença aparece no relatório e na auditoria.
  await tx`update freelancer_diarias set data = ${depois.data}, funcao = ${depois.funcao}, inicio = ${depois.inicio}, fim = ${depois.fim}, local = ${depois.local},
    valor = ${reais(valorCentavos)}, valor_origem = ${origem}, atualizado_em = now() where id = ${e.id}`;
  await tx`update evento_custos set valor = ${reais(valorCentavos)}, competencia = ${depois.data}, descricao = ${descricaoCusto(depois.funcao, depois.data)}
    where idempotencia = ${e.id} and cancelado_em is null`;
  await auditar(tx, usuario, { acao: antes.status === "PAGO" ? "DIARIA_EDITAR_APOS_FECHAMENTO" : "DIARIA_EDITAR", entidade: "freelancer_diaria", entidadeId: e.id, empresaId: antes.empresa_id,
    dados: { antes: { ...antes, valorCentavos: centavos(antes.valor) }, depois: { ...depois, valorCentavos, origem }, justificativa: e.justificativa ?? null } });
  return { id: e.id, valorCentavos, alertas: await outrosEventosNoDia(tx, antes.freelancer_id, depois.data, antes.evento_id) };
}

export async function cancelarDiaria(tx: Tx, usuario: UsuarioAutenticado, id: string, motivo: string) {
  exigirPapel(usuario, PAPEIS_ESCALA);
  const antes = await diariaTravada(tx, usuario, id);
  if (antes.status === "PAGO") exigirLiberacao(usuario, motivo, "Diária de período fechado e pago.");
  await tx`update freelancer_diarias set status = 'CANCELADA', motivo = ${motivo}, atualizado_em = now() where id = ${id}`;
  await tx`update evento_custos set cancelado_em = now(), cancelado_por = ${usuario.id}, motivo_cancelamento = ${motivo} where idempotencia = ${id} and cancelado_em is null`;
  await auditar(tx, usuario, { acao: antes.status === "PAGO" ? "DIARIA_CANCELAR_APOS_FECHAMENTO" : "DIARIA_CANCELAR", entidade: "freelancer_diaria", entidadeId: id, empresaId: antes.empresa_id, dados: { antes, motivo } });
  return { id };
}

// ---------------------------------------------------------------- Relatório, fechamento e comprovante

export const filtroRelatorio = z.object({
  inicio: z.string().date(), fim: z.string().date(), eventoId: z.string().uuid().optional(), situacao: z.enum(["TODAS", "PENDENTE", "PAGO"]).default("TODAS")
}).refine((f) => f.inicio <= f.fim, "Período inválido.");

export async function relatorioPagamento(sql: Sql, usuario: UsuarioAutenticado, empresaId: string, filtro: z.infer<typeof filtroRelatorio>) {
  exigirPapel(usuario, PAPEIS_FREELANCERS); autorizarEmpresa(usuario, empresaId);
  const linhas = await sql<{ id: string; freelancer_id: string; nome: string; cnpj_cifrado: string | null; pix_cifrado: string | null; funcao: string; valor: number; status: "PENDENTE" | "PAGO";
    evento_id: string; evento: string; data: string; local: string; pagamento_id: string | null; pago_em: string | null; comprovante_path: string | null }[]>`
    select d.id, d.freelancer_id, f.nome, f.cnpj_cifrado, f.pix_cifrado, d.funcao, d.valor, d.status, d.evento_id, e.titulo as evento, d.data::text, d.local,
      d.pagamento_id, p.pago_em::text, p.comprovante_path
    from freelancer_diarias d join freelancers f on f.id = d.freelancer_id join eventos e on e.id = d.evento_id left join freelancer_pagamentos p on p.id = d.pagamento_id
    where d.empresa_id = ${empresaId} and d.data between ${filtro.inicio} and ${filtro.fim} and d.status <> 'CANCELADA'
      ${filtro.eventoId ? sql`and d.evento_id = ${filtro.eventoId}` : sql``}
      ${filtro.situacao !== "TODAS" ? sql`and d.status = ${filtro.situacao}` : sql``}`;
  const pessoais = new Map<string, { cnpj: string; pix: string }>();
  const diarias: DiariaRelatorio[] = linhas.map((l) => {
    let p = pessoais.get(l.freelancer_id);
    if (!p) { p = { cnpj: formatarCnpj(decifrar(l.cnpj_cifrado)), pix: decifrar(l.pix_cifrado) }; pessoais.set(l.freelancer_id, p); }
    return { id: l.id, freelancerId: l.freelancer_id, nome: l.nome, ...p, funcao: l.funcao, valorCentavos: centavos(l.valor), status: l.status, eventoId: l.evento_id,
      evento: l.evento, data: l.data, local: l.local, pagamentoId: l.pagamento_id, pagoEm: l.pago_em, comprovante: l.comprovante_path };
  });
  return { filtro, ...montarRelatorio(diarias) };
}

export const fechamentoEntrada = z.object({
  inicio: z.string().date(), fim: z.string().date(), eventoId: z.string().uuid().optional(), pagoEm: z.string().date(), observacao: z.string().trim().max(1000).default("")
}).strict().refine((f) => f.inicio <= f.fim, "Período inválido.");

/** Fecha o período: diárias pendentes viram PAGO (travadas), com um pagamento por freelancer. */
export async function fecharPeriodo(tx: Tx, usuario: UsuarioAutenticado, empresaId: string, f: z.infer<typeof fechamentoEntrada>) {
  exigirPapel(usuario, PAPEIS_PAGAMENTO); autorizarEmpresa(usuario, empresaId);
  // FOR UPDATE: dois fechamentos simultâneos não pagam a mesma diária duas vezes.
  const diarias = await tx<{ id: string; freelancer_id: string; valor: number }[]>`
    select id, freelancer_id, valor from freelancer_diarias
    where empresa_id = ${empresaId} and status = 'PENDENTE' and data between ${f.inicio} and ${f.fim} ${f.eventoId ? tx`and evento_id = ${f.eventoId}` : tx``}
    order by id for update`;
  if (!diarias.length) throw new ErroOperacao("Nenhuma diária pendente neste período.", 409);
  const fechamentoId = randomUUID();
  await tx`insert into freelancer_fechamentos (id, empresa_id, inicio, fim, evento_id, pago_em, observacao, fechado_por)
    values (${fechamentoId}, ${empresaId}, ${f.inicio}, ${f.fim}, ${f.eventoId ?? null}, ${f.pagoEm}, ${f.observacao}, ${usuario.id})`;
  const porPessoa = new Map<string, { total: number; ids: string[] }>();
  for (const d of diarias) {
    const p = porPessoa.get(d.freelancer_id) ?? { total: 0, ids: [] };
    p.total += centavos(d.valor); p.ids.push(d.id); porPessoa.set(d.freelancer_id, p);
  }
  for (const [freelancerId, p] of porPessoa) {
    const pagamentoId = randomUUID();
    await tx`insert into freelancer_pagamentos (id, empresa_id, fechamento_id, freelancer_id, valor, pago_em) values (${pagamentoId}, ${empresaId}, ${fechamentoId}, ${freelancerId}, ${reais(p.total)}, ${f.pagoEm})`;
    await tx`update freelancer_diarias set status = 'PAGO', pagamento_id = ${pagamentoId}, atualizado_em = now() where id in ${tx(p.ids)}`;
  }
  const totalCentavos = [...porPessoa.values()].reduce((s, p) => s + p.total, 0);
  await auditar(tx, usuario, { acao: "FREELANCER_FECHAMENTO", entidade: "freelancer_fechamento", entidadeId: fechamentoId, empresaId, dados: { ...f, diarias: diarias.length, pagamentos: porPessoa.size, totalCentavos } });
  return { id: fechamentoId, diarias: diarias.length, pagamentos: porPessoa.size, totalCentavos };
}

export async function registrarComprovante(tx: Tx, usuario: UsuarioAutenticado, pagamentoId: string, comprovantePath: string) {
  exigirPapel(usuario, PAPEIS_PAGAMENTO);
  const [p] = await tx<{ empresa_id: string; comprovante_path: string | null }[]>`select empresa_id, comprovante_path from freelancer_pagamentos where id = ${pagamentoId} for update`;
  if (!p) throw new ErroOperacao("Pagamento não encontrado.", 404);
  autorizarEmpresa(usuario, p.empresa_id);
  await tx`update freelancer_pagamentos set comprovante_path = ${comprovantePath} where id = ${pagamentoId}`;
  await auditar(tx, usuario, { acao: "FREELANCER_COMPROVANTE", entidade: "freelancer_pagamento", entidadeId: pagamentoId, empresaId: p.empresa_id, dados: { antes: p.comprovante_path, depois: comprovantePath } });
  return { id: pagamentoId };
}
