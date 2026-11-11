import { useState } from "react";
import { Check, PencilLine, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { gerarProgramacao } from "@/lib/eventos";
import { rotulo, type EventoOperacao, type Operacao, type Programacao } from "@/lib/operacao";

/**
 * A programação nasce sozinha da proposta aprovada (no registro do contrato). Aqui a equipe só confere,
 * ajusta se quiser e aprova — nunca começa de um formulário vazio.
 */
export function ProgramacaoAutomatica({ evento, atual, notificacoes, podeEditar, ocupado, editar, aprovar, recarregar }: {
  evento: EventoOperacao; atual?: Programacao; notificacoes: Operacao["notificacoes"]; podeEditar: boolean; ocupado: boolean;
  editar: () => void; aprovar: () => void; recarregar: () => Promise<void>;
}) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const contrato = !!evento.contrato_assinado_em;
  const falha = notificacoes.find((n) => n.evento_id === evento.id && n.mensagem.startsWith("Programação automática não gerada"));
  const servicos = [...new Set(atual?.itens.map((i) => i.servico) ?? [])];

  async function gerar() {
    setGerando(true); setErro("");
    try { await gerarProgramacao(evento.id, evento.revisao); await recarregar(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível gerar a programação."); }
    finally { setGerando(false); }
  }

  return <div className="space-y-4 rounded-xl border bg-card p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-lg font-semibold">{atual ? `Programação v${atual.versao} · ${rotulo(atual.status)}` : "Programação automática"}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {atual ? atual.alteracoes : contrato ? "Ainda não gerada. Clique para o sistema calcular a partir da proposta aprovada." : "É gerada sozinha assim que o contrato for registrado."}
        </p>
      </div>
      {podeEditar && contrato && <div className="flex flex-wrap gap-2">
        <Button variant={atual ? "outline" : "default"} disabled={ocupado || gerando} onClick={() => void gerar()}><Wand2 size={16} />{gerando ? "Calculando…" : atual ? "Gerar de novo pela proposta" : "Gerar programação agora"}</Button>
        {atual && <Button variant="outline" disabled={ocupado || gerando} onClick={editar}><PencilLine size={16} />Ajustar itens</Button>}
      </div>}
    </div>
    {falha && !atual && <p role="alert" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">{falha.mensagem}</p>}
    {erro && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">{erro}</p>}
    {atual && <>
      {servicos.map((s) => <section key={s} className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">{s || "Serviço"}</h4>
        <div className="divide-y rounded-lg border">{atual.itens.filter((i) => i.servico === s).map((item, i) =>
          <div key={i} className="grid gap-1 p-3 text-sm sm:grid-cols-[120px_1fr_160px]">
            <strong>{item.quantidade.toLocaleString("pt-BR")} {item.unidade}</strong>
            <span>{item.receita}</span>
            <span className="text-xs text-muted-foreground sm:text-right">{rotulo(item.setor)}</span>
          </div>)}
        </div>
      </section>)}
      {atual.status === "RASCUNHO" && podeEditar && <Button disabled={ocupado} onClick={aprovar}><Check size={16} />Aprovar e gerar operação</Button>}
    </>}
  </div>;
}
