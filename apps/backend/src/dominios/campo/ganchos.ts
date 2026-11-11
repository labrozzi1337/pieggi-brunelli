import { randomUUID } from "node:crypto";
import type { Tx } from "@/integrations/banco";
import type { UsuarioAutenticado } from "@/dominios/acesso/autenticacao";
import type { ProgramacaoLinha } from "@/dominios/operacao/ganchos-tipos";
import { ErroOperacao } from "@/dominios/operacao/http";

type Etapa = { tipo: string; titulo: string; orientacao: string; previstoEm: string };

/** Programação mudou de status (ex.: aprovada → gera roteiro de campo). Dono: módulo campo. Antigo trigger gerar_roteiro_campo. */
export async function aoMudarStatusProgramacao(tx: Tx, _usuario: UsuarioAutenticado, programacao: ProgramacaoLinha, statusAnterior: string): Promise<void> {
  if (programacao.status !== "APROVADA" || statusAnterior === "APROVADA") return;
  const roteiro = (programacao.roteiro_campo ?? []) as Etapa[];
  if (!roteiro.length) throw new ErroOperacao("Defina o roteiro de montagem, reposição e desmontagem na programação antes de aprovar.", 409);
  if (["MONTAGEM", "REPOSICAO", "DESMONTAGEM"].some(tipo => !roteiro.some(e => e?.tipo === tipo))) throw new ErroOperacao("O roteiro precisa conter montagem, reposição e desmontagem.", 409);
  const linhas = roteiro.map((e, i) => ({ id: randomUUID(), empresa_id: programacao.empresa_id, evento_id: programacao.evento_id, programacao_id: programacao.id,
    ordem: i + 1, tipo: e.tipo, titulo: e.titulo, orientacao: e.orientacao, previsto_em: e.previstoEm }));
  await tx`insert into campo_etapas ${tx(linhas)} on conflict (programacao_id, ordem) do nothing`;
}

const OPERACIONAIS = ["pax", "data_evento", "horario_inicio", "horario_fim", "logradouro", "numero_endereco", "complemento", "bairro", "cidade", "uf", "cep"];

/**
 * Antes de alterar dados do evento: recusa edições depois que o evento saiu e exige balanço (e termo) para encerrar.
 * Antigo trigger evento_portao_balanco. `alteracoes`: colunas de eventos em snake_case → novo valor (como camposEvento),
 * incluindo `etapa_operacao: "ENTREGUE"` ao encerrar. Dono: módulo campo/balanço.
 */
export async function validarEdicaoEvento(tx: Tx, eventoId: string, alteracoes: Record<string, unknown>): Promise<void> {
  const [atual] = await tx<{ etapa_operacao: string }[]>`select etapa_operacao from eventos where id = ${eventoId}`;
  if (!atual) return;
  const mudadas = OPERACIONAIS.filter(c => c in alteracoes);
  if (["EM_CAMPO", "ENTREGUE"].includes(atual.etapa_operacao) && mudadas.length) {
    // O Postgres compara com o tipo da coluna (date, time, int): "10:00" = "10:00:00".
    for (const c of mudadas) {
      const [r] = await tx<{ mudou: boolean }[]>`select ${tx(c)} is distinct from ${alteracoes[c] as string | number | null} as mudou from eventos where id = ${eventoId}`;
      if (r?.mudou) throw new ErroOperacao("Evento já saiu. Dados operacionais não podem ser alterados sem tratar a ocorrência.", 409);
    }
  }
  if (alteracoes.etapa_operacao === "ENTREGUE" && atual.etapa_operacao !== "ENTREGUE") {
    const [b] = await tx<{ programacao_id: string; revisao: number; remanescentes: boolean }[]>`
      select b.programacao_id, b.revisao, exists(select 1 from jsonb_array_elements(b.linhas) x where (x->>'remanescentes')::numeric > 0) as remanescentes
      from evento_balancos b join programacoes p on p.id = b.programacao_id and p.status = 'APROVADA' where b.evento_id = ${eventoId}`;
    if (!b) throw new ErroOperacao("Registre o balanço de consumo, retorno e descarte antes de encerrar.", 409);
    if (b.remanescentes) {
      const [termo] = await tx`select 1 from remanescentes_termos where programacao_id = ${b.programacao_id} and revisao_balanco = ${b.revisao}`;
      if (!termo) throw new ErroOperacao("Anexe o termo assinado dos remanescentes desta revisão antes de encerrar.", 409);
    }
  }
}
