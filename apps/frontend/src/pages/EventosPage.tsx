import { AlertTriangle, CalendarDays, Check, LayoutGrid, List, LockKeyhole, Plus, Search, Sparkles, X } from "lucide-react";
import { useAoMudar } from "@/lib/aovivo";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/auth";
import { atualizarEvento, listarEventos, type Evento } from "@/lib/api";
import type { ServicoForm } from "@/lib/eventos";
import { Carregando, Filtro, IconeBotao, Metrica } from "@/components/eventos/comum";
import { NovoEvento } from "@/components/eventos/NovoEvento";
import { PainelEvento } from "@/components/eventos/PainelEvento";
import { ListaEventos, Pipeline, QuadroPrazo } from "@/components/eventos/Quadro";
import { campo, diasAte, etapas, mensagem, PAPEIS_COMERCIAIS, quantidadePendencias, tem, type Etapa } from "@/components/eventos/util";

export function EventosPage() {
  const { usuario } = useAuth();
  const empresaId = usuario?.empresas[0] ?? "";
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [prazo, setPrazo] = useState("TODOS");
  const [etapa, setEtapa] = useState("TODAS");
  const [contrato, setContrato] = useState("TODOS");
  const [historico, setHistorico] = useState(false);
  const [visualizacao, setVisualizacao] = useState<"pipeline" | "prazo" | "lista">("pipeline");
  const [fluxo, setFluxo] = useState<{ evento?: Evento; servicos: ServicoForm[] } | null>(null);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const editar = tem(usuario?.papeis, PAPEIS_COMERCIAIS);
  const selecionado = eventos.find((e) => e.id === selecionadoId) ?? null;

  const carregar = useCallback(async () => {
    try {
      if (!empresaId) throw new Error("Seu acesso não possui uma empresa vinculada.");
      setEventos(await listarEventos(empresaId, historico));
      setErro("");
    } catch (falha) { setErro(mensagem(falha)); } finally { setCarregando(false); }
  }, [empresaId, historico]);
  useEffect(() => {
    // Busca inicial remota; sem laço de renderização.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);
  useAoMudar(carregar, !!arrastando);

  const filtrados = useMemo(() => eventos.filter((e) => {
    const texto = `${e.titulo} ${e.clienteNome} ${e.cidade ?? ""}`.toLocaleLowerCase("pt-BR");
    const dias = diasAte(e.dataEvento);
    const noPrazo = prazo === "TODOS" || (prazo === "SEM_DATA" ? dias === null : dias !== null && (prazo === "MAIS" ? dias > 15 : dias >= 0 && dias <= Number(prazo)));
    const noContrato = contrato === "TODOS" || (contrato === "ASSINADO" ? !!e.contratoAssinadoEm : !e.contratoAssinadoEm);
    return texto.includes(busca.trim().toLocaleLowerCase("pt-BR")) && noPrazo && noContrato && (etapa === "TODAS" || e.etapaComercial === etapa);
  }), [eventos, busca, prazo, etapa, contrato]);

  const proximos = eventos.filter((e) => { const d = diasAte(e.dataEvento); return d !== null && d >= 0 && d <= 7; }).length;
  const bloqueados = eventos.filter((e) => e.etapaOperacao === "BLOQUEADO").length;
  const prontos = eventos.filter((e) => quantidadePendencias(e) === 0 && !e.contratoAssinadoEm).length;
  const filtrosAtivos = [busca, prazo !== "TODOS", etapa !== "TODAS", contrato !== "TODOS"].filter(Boolean).length;

  async function mover(id: string, destino: Etapa) {
    if (!editar) return;
    const atual = eventos.find((e) => e.id === id);
    if (!atual || atual.etapaComercial === destino) return;
    if (destino === "CONTRATO_ASSINADO") return setErro("A assinatura não pode ser simulada por arraste. Abra o evento e registre o contrato assinado na Operação.");
    setEventos((lista) => lista.map((e) => (e.id === id ? { ...e, etapaComercial: destino } : e)));
    try {
      const atualizado = await atualizarEvento(id, { empresaId: atual.empresaId, atualizadoEm: atual.atualizadoEm, etapaComercial: destino });
      setEventos((lista) => lista.map((e) => (e.id === id ? { ...e, ...atualizado } : e)));
      setErro("");
    } catch (falha) {
      setEventos((lista) => lista.map((e) => (e.id === id ? atual : e)));
      setErro(mensagem(falha));
    }
  }

  const abrir = (e: Evento) => setSelecionadoId(e.id);
  const comum = { abrir, setArrastando, podeMover: editar };
  return <div className="min-h-full bg-muted/20 p-3 sm:p-6 lg:p-8">
    <header className="overflow-hidden rounded-2xl bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/10 sm:p-8"
      style={{ background: "radial-gradient(circle at top right, rgba(34,211,238,.24), transparent 35%), linear-gradient(135deg,#020617,#0f172a 60%,#083344)" }}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-[240px] flex-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.18em] text-cyan-100"><Sparkles className="h-3.5 w-3.5" />Central comercial</span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-4xl">Eventos</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Um cadastro por evento: o sistema sugere o cardápio, calcula pelas regras da data e gera proposta, programação, comanda e plaquinha.</p>
        </div>
        <Button className="h-12 w-full self-start bg-cyan-300 px-5 font-bold text-slate-950 hover:bg-cyan-200 sm:w-auto" onClick={() => setFluxo({ servicos: [] })} disabled={!editar}><Plus className="h-4 w-4" />Novo evento</Button>
      </div>
    </header>

    <section className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Resumo do pipeline">
      <Metrica icone={<LayoutGrid />} rotulo="No pipeline" valor={eventos.filter((e) => e.etapaComercial !== "PERDIDO").length} detalhe="negociações ativas" />
      <Metrica icone={<CalendarDays />} rotulo="Próximos 7 dias" valor={proximos} detalhe="eventos no radar" tom="sky" />
      <Metrica icone={<LockKeyhole />} rotulo="Operação bloqueada" valor={bloqueados} detalhe="aguardando contrato" tom="amber" />
      <Metrica icone={<Check />} rotulo="Prontos para contrato" valor={prontos} detalhe="cadastros completos" tom="emerald" />
    </section>

    <section className="mt-4 rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1"><span className="sr-only">Buscar eventos</span><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input className={`${campo} pl-10`} placeholder="Buscar evento, cliente ou cidade…" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
        <div className="flex flex-1 flex-wrap gap-2 xl:flex-none">
          <Filtro valor={prazo} alterar={setPrazo} rotulo="Prazo" opcoes={[["TODOS", "Qualquer data"], ["3", "Até 3 dias"], ["7", "Até 7 dias"], ["15", "Até 15 dias"], ["MAIS", "Acima de 15 dias"], ["SEM_DATA", "Sem data"]]} />
          <Filtro valor={etapa} alterar={setEtapa} rotulo="Etapa" opcoes={[["TODAS", "Todas as etapas"], ...etapas.map((i) => [i.id, i.nome] as [string, string])]} />
          <Filtro valor={contrato} alterar={setContrato} rotulo="Contrato" opcoes={[["TODOS", "Todos os contratos"], ["PENDENTE", "Contrato pendente"], ["ASSINADO", "Contrato assinado"]]} />
        </div>
        {filtrosAtivos > 0 && <button className="h-10 whitespace-nowrap px-2 text-xs font-semibold text-primary hover:underline" onClick={() => { setBusca(""); setPrazo("TODOS"); setEtapa("TODAS"); setContrato("TODOS"); }}>Limpar {filtrosAtivos} filtro{filtrosAtivos === 1 ? "" : "s"}</button>}
        <label className="flex h-10 items-center gap-2 whitespace-nowrap px-1 text-xs text-muted-foreground" title="Por padrão a lista traz os eventos em aberto e os encerrados nos últimos 90 dias.">
          <input type="checkbox" checked={historico} onChange={(e) => setHistorico(e.target.checked)} />Incluir encerrados há mais de 90 dias</label>
        <div className="flex rounded-lg border bg-background p-1">
          <IconeBotao ativo={visualizacao === "prazo"} rotulo="Quadro por prazo" onClick={() => setVisualizacao("prazo")}><CalendarDays /></IconeBotao>
          <IconeBotao ativo={visualizacao === "pipeline"} rotulo="Pipeline" onClick={() => setVisualizacao("pipeline")}><LayoutGrid /></IconeBotao>
          <IconeBotao ativo={visualizacao === "lista"} rotulo="Lista" onClick={() => setVisualizacao("lista")}><List /></IconeBotao>
        </div>
      </div>
    </section>

    {erro && <div role="alert" className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
      <span className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{erro}</span><button aria-label="Fechar aviso" onClick={() => setErro("")}><X className="h-4 w-4" /></button>
    </div>}
    {carregando ? <Carregando texto="Carregando pipeline…" />
      : visualizacao === "prazo" ? <QuadroPrazo eventos={filtrados} {...comum} />
      : visualizacao === "pipeline" ? <Pipeline eventos={filtrados} arrastando={arrastando} mover={mover} {...comum} />
      : <ListaEventos eventos={filtrados} abrir={abrir} />}

    {fluxo && <NovoEvento empresaId={empresaId} inicial={fluxo.evento ? { evento: fluxo.evento, servicos: fluxo.servicos } : undefined}
      onFechar={() => { setFluxo(null); void carregar(); }}
      onConcluido={(id) => { setFluxo(null); setSelecionadoId(id); void carregar(); }} />}
    {selecionado && !fluxo && <PainelEvento key={selecionado.id} evento={selecionado} onFechar={() => setSelecionadoId(null)}
      onAtualizado={(e) => setEventos((lista) => lista.map((x) => (x.id === e.id ? { ...x, ...e } : x)))} onRecarregar={carregar}
      onFluxo={(evento, servicos) => setFluxo({ evento, servicos })} />}
  </div>;
}
