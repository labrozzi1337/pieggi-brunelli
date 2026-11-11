import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Plus, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { campoOperacao } from "@/components/operacao/ProgramacaoEditor";
import { api } from "@/lib/api";
import { dataBr, enviar, hoje, reais, rotuloFuncao, valorPrevisto, type DadosFreelancers } from "./comum";

interface EventoEscala { id: string; titulo: string; data_evento: string | null; horario_inicio: string | null; horario_fim: string | null; local: string }
interface Diaria { id: string; freelancer_id: string; nome: string; funcao: string; data: string; inicio: string; fim: string; local: string; valorCentavos: number; valor_origem: string; status: string; outroEventoNoDia: boolean }
interface Escala { evento: EventoEscala; freelancers: number; verba: { verbaCentavos: number; custoCentavos: number; saldoCentavos: number; estourou: boolean }; diarias: Diaria[] }

const hhmm = (v: string | null, padrao: string) => v?.slice(0, 5) ?? padrao;

export function EscalaFreelancers({ empresa, dados, eventoInicial }: { empresa: string; dados: DadosFreelancers; eventoInicial?: string }) {
  const [eventos, setEventos] = useState<EventoEscala[]>([]); const [eventoId, setEventoId] = useState(eventoInicial ?? "");
  const [escala, setEscala] = useState<Escala | null>(null); const [erro, setErro] = useState(""); const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [freelancerId, setFreelancerId] = useState(""); const [funcao, setFuncao] = useState("");
  const admin = dados.podeAnonimizar;

  const carregar = useCallback(async () => {
    try {
      const r = await api<{ eventos: EventoEscala[]; escala: Escala | null }>(`/api/v1/freelancers/escala?empresaId=${empresa}${eventoId ? `&eventoId=${eventoId}` : ""}`);
      setEventos(r.eventos); setEscala(r.escala); setErro("");
      // Sem evento escolhido: abre o próximo evento a partir de hoje.
      if (!eventoId) { const proximo = r.eventos.find((e) => (e.data_evento ?? "") >= hoje()) ?? r.eventos[0]; if (proximo) setEventoId(proximo.id); }
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao carregar a escala."); }
  }, [empresa, eventoId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  async function agir(acao: string, valores: unknown) {
    setOcupado(true); setErro(""); setAviso("");
    try {
      const r = await enviar<{ alertas?: string[] }>("/api/v1/freelancers/escala", { comando: { acao, dados: valores } });
      if (r.alertas?.length) setAviso(r.alertas.join(" "));
      await carregar(); return true;
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar."); return false; }
    finally { setOcupado(false); }
  }
  async function lancar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    // Mantém data, horário e local: lançar a próxima pessoa é só escolher o nome.
    if (await agir("LANCAR", { freelancerId, eventoId, funcao, data: f.get("data"), inicio: f.get("inicio"), fim: f.get("fim"), local: f.get("local") })) { setFreelancerId(""); setFuncao(""); }
  }
  function cancelar(d: Diaria) {
    const motivo = window.prompt(d.status === "PAGO" ? "Diária já paga: só o admin cancela. Justificativa (mín. 5 caracteres):" : "Motivo do cancelamento (mín. 5 caracteres):");
    if (motivo && motivo.trim().length >= 5) void agir("CANCELAR", { id: d.id, motivo });
  }
  function ajustarValor(d: Diaria) {
    const valor = window.prompt(`Novo valor da diária de ${d.nome} (R$). O valor foi congelado no lançamento:`, String(d.valorCentavos / 100));
    if (!valor) return;
    const justificativa = window.prompt("Justificativa (fica na auditoria):");
    if (justificativa) void agir("EDITAR", { id: d.id, valor: Number(valor.replace(",", ".")), justificativa });
  }

  const ev = escala?.evento;
  const ativos = dados.freelancers.filter((f) => f.ativo);
  const escolhido = ativos.find((f) => f.id === freelancerId);
  const previsto = funcao ? valorPrevisto(escolhido, funcao, dados.tabela) : null;
  const jaNaEscala = new Set(escala?.diarias.map((d) => d.freelancer_id));

  return <section className="space-y-5">
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 text-sm">Evento<select className={campoOperacao} value={eventoId} onChange={(e) => setEventoId(e.target.value)}>
        <option value="">Selecione</option>{eventos.map((e) => <option key={e.id} value={e.id}>{dataBr(e.data_evento)} · {e.titulo}</option>)}</select></label>
      <Button variant="outline" disabled={ocupado} onClick={() => { void carregar(); }}><RefreshCw size={16} />Atualizar</Button>
    </div>
    {erro && <p role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{erro}</p>}
    {aviso && <p role="status" className="flex gap-2 rounded-lg bg-warning/10 p-4 text-sm"><AlertTriangle size={18} className="shrink-0" />{aviso}</p>}

    {escala && <>
      <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-4">
        <div><p className="text-xs text-muted-foreground">Freelancers contratados</p><p className="mt-1 flex items-center gap-2 text-xl font-semibold"><Users size={18} />{escala.freelancers}</p></div>
        <div><p className="text-xs text-muted-foreground">Verba do evento</p><p className="mt-1 text-xl font-semibold">{escala.verba.verbaCentavos ? reais(escala.verba.verbaCentavos) : "Sem verba"}</p></div>
        <div><p className="text-xs text-muted-foreground">Custo da escala</p><p className="mt-1 text-xl font-semibold">{reais(escala.verba.custoCentavos)}</p></div>
        <div><p className="text-xs text-muted-foreground">Saldo</p><p className={`mt-1 text-xl font-semibold ${escala.verba.estourou ? "text-destructive" : ""}`}>{reais(escala.verba.saldoCentavos)}</p></div>
        {escala.verba.estourou && <p role="alert" className="flex gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive sm:col-span-4"><AlertTriangle size={18} className="shrink-0" />A escala estourou a verba do evento em {reais(-escala.verba.saldoCentavos)}.</p>}
      </div>

      {dados.podeEditar && <form key={escala.evento.id} className="grid gap-3 rounded-xl border border-primary/40 bg-card p-4 sm:grid-cols-2 lg:grid-cols-6" onSubmit={(e) => { void lancar(e); }}>
        <h2 className="font-semibold sm:col-span-2 lg:col-span-6">Adicionar à escala</h2>
        <label className="text-sm sm:col-span-2">Freelancer<select required className={campoOperacao} value={freelancerId} onChange={(e) => { setFreelancerId(e.target.value); setFuncao(ativos.find((f) => f.id === e.target.value)?.funcoes[0] ?? ""); }}>
          <option value="">Escolha</option>{ativos.map((f) => <option key={f.id} value={f.id}>{f.nome}{jaNaEscala.has(f.id) ? " ✓" : ""} · {f.funcoes.map(rotuloFuncao).join("/")}</option>)}</select></label>
        <label className="text-sm">Função<select required className={campoOperacao} value={funcao} onChange={(e) => setFuncao(e.target.value)}>
          <option value="">Escolha</option>{dados.tabela.funcoes.map((t) => <option key={t.funcao} value={t.funcao}>{rotuloFuncao(t.funcao)}</option>)}</select></label>
        <label className="text-sm">Dia<input name="data" type="date" required defaultValue={ev?.data_evento ?? hoje()} className={campoOperacao} /></label>
        <label className="text-sm">Início<input name="inicio" type="time" required defaultValue={hhmm(ev?.horario_inicio ?? null, "07:00")} className={campoOperacao} /></label>
        <label className="text-sm">Fim<input name="fim" type="time" required defaultValue={hhmm(ev?.horario_fim ?? null, "17:00")} className={campoOperacao} /></label>
        <label className="text-sm sm:col-span-2 lg:col-span-4">Local<input name="local" maxLength={300} defaultValue={ev?.local ?? ""} className={campoOperacao} /></label>
        <div className="flex items-end justify-between gap-3 sm:col-span-2"><p className="text-sm text-muted-foreground">{previsto !== null ? `Diária: ${reais(previsto)}` : funcao ? "Função sem valor na tabela" : ""}</p><Button type="submit" disabled={ocupado || !freelancerId || !funcao}><Plus size={16} />Adicionar</Button></div>
      </form>}

      <div className="grid gap-3 md:grid-cols-2">{escala.diarias.map((d) => <article key={d.id} className={`space-y-1 rounded-xl border bg-card p-4 ${d.outroEventoNoDia ? "border-warning/60" : ""}`}>
        <div className="flex justify-between gap-2"><h3 className="font-semibold">{d.nome}</h3><span className="text-xs font-semibold uppercase">{d.status === "PAGO" ? "Pago" : "Pendente"}</span></div>
        <p className="text-sm">{rotuloFuncao(d.funcao)} · {dataBr(d.data)} · {d.inicio}–{d.fim} · {reais(d.valorCentavos)}{d.valor_origem !== "FUNCAO" ? ` (${d.valor_origem === "INDIVIDUAL" ? "individual" : "ajustado"})` : ""}</p>
        {d.local && <p className="text-xs text-muted-foreground">{d.local}</p>}
        {d.outroEventoNoDia && <p className="text-xs text-warning">Também escalada em outro evento neste dia: decida se paga uma ou duas diárias.</p>}
        {dados.podeEditar && <div className="flex flex-wrap gap-2 pt-1">{(d.status !== "PAGO" || admin) && <Button variant="ghost" disabled={ocupado} onClick={() => cancelar(d)}>Cancelar diária</Button>}{admin && <Button variant="ghost" disabled={ocupado} onClick={() => ajustarValor(d)}>Ajustar valor</Button>}</div>}
      </article>)}</div>
      {!escala.diarias.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Ninguém escalado neste evento.</p>}
    </>}
  </section>;
}
