import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAoMudar } from "@/lib/aovivo";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowRight, Check, ClipboardCheck, Clock, Layers, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/auth";
import { api, baixarArquivo } from "@/lib/api";
import { ProgramacaoEditor, campoOperacao } from "@/components/operacao/ProgramacaoEditor";
import { Contrato } from "@/components/operacao/Contrato";
import { Documentos } from "@/components/operacao/Documentos";
import { ProgramacaoAutomatica } from "@/components/operacao/ProgramacaoAutomatica";
import { CampoAcesso } from "@/components/operacao/CampoAcesso";
import { Balanco } from "@/components/operacao/Balanco";
import { Custos } from "@/components/operacao/Custos";
import { Equipe } from "@/components/operacao/Equipe";
import { PropostaReferencia } from "@/components/operacao/PropostaReferencia";
import { consultarOperacao, executarOperacao, dataCurta, moeda, rotulo, setores, type EventoOperacao, type Operacao, type Tarefa } from "@/lib/operacao";

type Aba = "contrato" | "programacao" | "producao" | "expedicao" | "equipe" | "campo" | "financeiro" | "pos-venda" | "historico";
const abas: { id: Aba; nome: string }[] = [{ id: "programacao", nome: "Programação" }, { id: "producao", nome: "Produção" }, { id: "expedicao", nome: "Expedição" }, { id: "equipe", nome: "Equipe e extras" }, { id: "campo", nome: "Campo e retorno" }, { id: "financeiro", nome: "Financeiro" }, { id: "pos-venda", nome: "Pós-venda" }, { id: "historico", nome: "Histórico" }];
export function OperacaoPage() {
  const { usuario } = useAuth();
  const [params, setParams] = useSearchParams();
  const empresaId = usuario?.empresas[0] ?? "";
  const [dados, setDados] = useState<Operacao | null>(null);
  const [erro, setErro] = useState(""); const [sucesso, setSucesso] = useState("");
  const [ocupado, setOcupado] = useState(false); const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState(""); const [setor, setSetor] = useState(""); const [pendentes, setPendentes] = useState(true);
  const [editando, setEditando] = useState(false);
  const [eventoDoLink] = useState(() => params.get("evento"));
  const aba = (params.get("aba") === "contrato" ? "contrato" : abas.find(a => a.id === params.get("aba"))?.id ?? "programacao");
  const selecionado = dados?.eventos.find(e => e.id === params.get("evento"));
  const pode = (...papeis: string[]) => usuario?.papeis.some(p => papeis.includes(p)) ?? false;
  const carregar = useCallback(async () => {
    if (!empresaId) { setErro("Seu acesso não possui uma empresa vinculada."); setCarregando(false); return; }
    try { setDados(await consultarOperacao(empresaId, eventoDoLink)); setErro(""); } catch (falha) { setErro(mensagem(falha)); } finally { setCarregando(false); }
  }, [empresaId, eventoDoLink]);
  // Fetch remote state when the authorized company changes, not derived render state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);
  useAoMudar(carregar, editando || ocupado);
  const programas = dados?.programacoes.filter(p => p.evento_id === selecionado?.id) ?? [];
  const atual = programas[0];
  const tarefas = dados?.tarefas.filter(t => t.evento_id === selecionado?.id && t.programacao_id === atual?.id && atual.status === "APROVADA") ?? [];
  const visiveis = useMemo(() => dados?.eventos.filter(e => `${e.titulo} ${e.etapa_operacao}`.toLowerCase().includes(busca.toLowerCase())) ?? [], [dados, busca]);
  async function agir(acao: string, valores: unknown) {
    if (!selecionado) return;
    setOcupado(true); setErro(""); setSucesso("");
    try {
      if (valores instanceof FormData) {
        valores.set("revisao", String(selecionado.revisao));
        await api(`/api/v1/operacao/${acao === "CONTRATO" ? "contratos" : "evidencias"}`, { method: "POST", body: valores });
      } else if (acao === "FINANCEIRO") await api("/api/v1/operacao/financeiro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventoId: selecionado.id, revisao: selecionado.revisao, comando: valores }) });
      else await executarOperacao(selecionado, acao, valores);
      await carregar(); setSucesso("Alteração registrada com sucesso.");
    }
    catch (falha) { setErro(mensagem(falha)); throw falha; }
    finally { setOcupado(false); }
  }
  function trocar(evento: string, proximaAba: Aba = aba) {
    if (editando && !window.confirm("Descartar a edição ainda não salva?")) return;
    setEditando(false); setSucesso(""); setParams({ evento, aba: proximaAba });
  }
  return <div className="space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-primary">Do contrato à entrega</p><h1 className="mt-2 text-3xl font-semibold">Central de operação</h1><p className="mt-2 text-sm text-muted-foreground">Uma programação. Toda a equipe na mesma versão.</p></div><Button variant="outline" disabled={ocupado} onClick={() => { void carregar(); }}><RefreshCw size={16} />Atualizar</Button></header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      ["Em programação", dados?.eventos.filter(e => e.etapa_operacao === "PROGRAMACAO").length ?? 0],
      ["Produção e expedição", dados?.eventos.filter(e => ["PRODUCAO", "EXPEDICAO"].includes(e.etapa_operacao)).length ?? 0],
      ["Em campo", dados?.eventos.filter(e => e.etapa_operacao === "EM_CAMPO").length ?? 0],
      ["Entregues", dados?.eventos.filter(e => e.etapa_operacao === "ENTREGUE").length ?? 0]
    ].map(([titulo, numero]) => <div key={titulo} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{titulo}</p><p className="mt-2 text-3xl font-semibold">{numero}</p></div>)}</div>
    {erro && <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm"><AlertTriangle size={18} className="shrink-0" />{erro}</div>}
    {sucesso && <p role="status" className="rounded-lg bg-success/10 p-3 text-sm text-success">{sucesso}</p>}
    {carregando ? <p role="status">Carregando operação…</p> : !dados ? <p className="text-sm text-muted-foreground">Os dados ainda não puderam ser consultados. Corrija a configuração indicada e clique em Atualizar.</p> : <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-3"><label className="relative block"><span className="sr-only">Buscar evento</span><Search className="absolute left-3 top-3 text-muted-foreground" size={16} /><input className={`${campoOperacao} pl-9`} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar evento ou etapa" /></label><div className="max-h-[65vh] space-y-2 overflow-auto">{visiveis.map(e => <button key={e.id} onClick={() => trocar(e.id)} className={`w-full rounded-xl border p-4 text-left transition hover:border-primary ${selecionado?.id === e.id ? "border-primary bg-primary/10" : "bg-card"}`}><span className="text-[11px] uppercase text-primary">{rotulo(e.etapa_operacao)}</span><h2 className="mt-1 font-semibold">{e.titulo}</h2><p className="mt-2 text-xs text-muted-foreground">{dataCurta(e.data_evento)} · {e.pax ?? "—"} pessoas</p></button>)}{!visiveis.length && <p className="p-4 text-sm text-muted-foreground">Nenhum evento encontrado. <Link className="text-primary underline" to="/eventos">Abra o comercial para cadastrar.</Link></p>}</div></aside>
      <section className="min-w-0 space-y-5">{!selecionado ? <div className="grid min-h-80 place-items-center rounded-xl border border-dashed bg-card p-8 text-center"><div><Layers className="mx-auto text-primary" size={36} /><h2 className="mt-4 text-xl font-semibold">Escolha um evento para continuar</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">Programação, produção, expedição, financeiro e histórico conectados no mesmo lugar.</p></div></div> : <>
        <div className="rounded-xl border bg-card p-5"><div className="flex flex-wrap justify-between gap-4"><div><h2 className="text-xl font-semibold">{selecionado.titulo}</h2><p className="mt-1 text-sm text-muted-foreground">{dataCurta(selecionado.data_evento)} · {selecionado.pax ?? "—"} pessoas · revisão {selecionado.revisao}</p></div><span className="flex items-center gap-2 text-xs text-primary"><ShieldCheck size={18} />{selecionado.contrato_assinado_em ? "Contrato registrado" : "Operação bloqueada: contrato pendente"}</span></div><nav className="mt-5 flex gap-1 overflow-x-auto border-t pt-3" aria-label="Etapas do evento">{abas.filter(a => (a.id !== "financeiro" || dados?.podeValores) && (a.id !== "equipe" || pode("ADMIN", "PROGRAMACAO", "EXPEDICAO_COMPRAS", "FINANCEIRO", "COMERCIAL", "ATENDIMENTO"))).map(a => <button key={a.id} onClick={() => trocar(selecionado.id, a.id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${aba === a.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{a.nome}</button>)}</nav></div>
        {aba === "programacao" && (editando ? <ProgramacaoEditor key={selecionado.id} anterior={atual} produtos={dados?.produtos ?? []} ocupado={ocupado} cancelar={() => { if (window.confirm("Descartar alterações não salvas?")) setEditando(false); }} salvar={async valores => { await agir("PROGRAMACAO_SALVAR", valores); setEditando(false); }} />
          : <ProgramacaoAutomatica evento={selecionado} atual={atual} notificacoes={dados?.notificacoes ?? []} podeEditar={pode("ADMIN", "PROGRAMACAO")} ocupado={ocupado} editar={() => setEditando(true)} recarregar={carregar}
            aprovar={() => { if (window.confirm("Aprovar esta versão e gerar as tarefas de produção, expedição e campo?")) void agir("PROGRAMACAO_APROVAR", {}).catch(() => undefined); }} />)}
        {aba === "programacao" && pode("ADMIN", "PROGRAMACAO", "COMERCIAL", "ATENDIMENTO") && <PropostaReferencia key={`${selecionado.id}-${selecionado.revisao}`} eventoId={selecionado.id} />}
        {aba === "programacao" && !editando && <Documentos key={atual?.id ?? selecionado.id} eventoId={selecionado.id} programacao={atual} />}
        {aba === "equipe" && pode("ADMIN", "PROGRAMACAO", "EXPEDICAO_COMPRAS", "FINANCEIRO", "COMERCIAL", "ATENDIMENTO") && <Equipe key={selecionado.id} evento={selecionado} programacao={atual} atualizar={carregar} />}
        {aba === "campo" && pode("ADMIN", "EXPEDICAO_COMPRAS") && <CampoAcesso key={selecionado.id} eventoId={selecionado.id} />}
        {aba==="campo" && atual?.status==="APROVADA" && <section className="space-y-3 rounded-xl border bg-card p-5"><h3 className="text-lg font-semibold">Roteiro em campo · v{atual.versao}</h3><p className="text-xs text-muted-foreground">Acompanhamento automático a cada 30 segundos. Execuções e horários são registrados pelo link do líder, sem edição nesta tela.</p>{dados.etapasCampo.filter(e=>e.programacao_id===atual.id).map(e=><article key={e.id} className={`rounded-lg border p-4 ${e.concluido_em?"border-success/30":""}`}><p className="text-xs text-primary">{e.ordem}. {rotulo(e.tipo)} · previsto {new Date(e.previsto_em).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</p><h4 className="mt-2 font-semibold">{e.titulo}</h4><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{e.orientacao}</p><p className={`mt-2 text-xs ${e.concluido_em?"text-success":"text-warning"}`}>{e.concluido_em?`Concluído ${new Date(e.concluido_em).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}`:"A executar"}{e.observacao&&` · ${e.observacao}`}</p></article>)}{!dados.etapasCampo.some(e=>e.programacao_id===atual.id)&&<p role="alert" className="text-sm text-warning">Roteiro ausente nesta versão antiga. Crie uma revisão para definir a sequência de campo.</p>}</section>}
        {aba === "campo" && atual?.status === "APROVADA" && pode("ADMIN", "EXPEDICAO_COMPRAS", "ATENDIMENTO", "COMERCIAL") && <Balanco key={`${selecionado.id}-${atual.id}`} evento={selecionado} programacao={atual} editar={pode("ADMIN", "EXPEDICAO_COMPRAS")} atualizar={carregar} />}
        {["producao", "expedicao", "campo"].includes(aba) && <div className="space-y-4"><div className="flex flex-wrap items-center gap-3"><select aria-label="Filtrar setor" className={`${campoOperacao} max-w-56`} value={setor} onChange={e => setSetor(e.target.value)}><option value="">Todos os setores</option>{setores.slice(1).map(s => <option key={s} value={s}>{rotulo(s)}</option>)}</select><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pendentes} onChange={e => setPendentes(e.target.checked)} />Somente pendentes</label><span className="ml-auto text-xs text-muted-foreground">{tarefas.filter(t => t.estado === "PRONTO").length}/{tarefas.length} concluídas · atualização a cada 30s</span></div>{atual?.status !== "APROVADA" && <p className="rounded-lg bg-warning/10 p-4 text-sm">Aprove a programação para liberar os itens. Documentos de versões anteriores não são válidos.</p>}<div className="grid gap-3 md:grid-cols-2">{tarefas.filter(t => (aba === "producao" ? t.tipo === "PRODUCAO" : aba === "expedicao" ? ["EXPEDICAO", "CONFERENCIA"].includes(t.tipo) : ["CAMPO", "RETORNO"].includes(t.tipo)) && (!setor || t.setor === setor) && (!pendentes || t.estado !== "PRONTO")).map(t => <TarefaCard key={t.id} tarefa={t} ocupado={ocupado} permitido={pode("ADMIN", ...(t.tipo === "PRODUCAO" ? ["PRODUCAO"] : t.tipo === "CONFERENCIA" ? ["PROGRAMACAO", "PRODUCAO", "EXPEDICAO_COMPRAS"] : ["EXPEDICAO_COMPRAS"]))} agir={valores => agir("TAREFA_ATUALIZAR", valores)} />)}</div>{aba === "expedicao" && pode("ADMIN", "EXPEDICAO_COMPRAS") && <Button disabled={ocupado || selecionado.etapa_operacao !== "EXPEDICAO"} onClick={() => { void agir("EXPEDIR", {}).catch(() => undefined); }}>Conferir e liberar saída<ArrowRight size={16} /></Button>}{aba === "campo" && pode("ADMIN", "EXPEDICAO_COMPRAS") && <Button disabled={ocupado || selecionado.etapa_operacao !== "EM_CAMPO"} onClick={() => { void agir("ENTREGAR", {}).catch(() => undefined); }}>Concluir entrega e retorno</Button>}</div>}
        <div className="flex flex-wrap gap-4">{dados?.podeValores && <button className="text-sm text-primary underline" onClick={() => trocar(selecionado.id, "contrato")}>Contrato e assinatura</button>}{selecionado.contrato_assinado_em && <button className="text-sm text-primary underline" onClick={() => { void baixarArquivo(`/api/v1/operacao/agenda?eventoId=${selecionado.id}`, "evento-pieggi.ics").catch(e => setErro(mensagem(e))); }}>Exportar para agenda (.ics)</button>}</div>
        {aba === "contrato" && dados?.podeValores && <Contrato key={selecionado.id} evento={selecionado} ocupado={ocupado} permitido={pode("ADMIN", "COMERCIAL", "ATENDIMENTO")} salvar={form => agir("CONTRATO", form)} />}
        {aba === "financeiro" && dados?.podeValores && <Financeiro key={selecionado.id} dados={dados} evento={selecionado} agir={agir} ocupado={ocupado} editar={pode("ADMIN", "FINANCEIRO")} />}
        {aba === "financeiro" && dados?.podeValores && <Custos key={selecionado.id} dados={dados} evento={selecionado} agir={agir} ocupado={ocupado} editar={pode("ADMIN", "FINANCEIRO")} />}
        {aba === "pos-venda" && <PosVenda key={selecionado.id} dados={dados} evento={selecionado} agir={agir} ocupado={ocupado || !pode("ADMIN", "COMERCIAL", "ATENDIMENTO")} />}
        {aba === "historico" && <div className="space-y-3">{programas.map(p => <div key={p.id} className="rounded-xl border bg-card p-4"><h3 className="font-semibold">Versão {p.versao} · {rotulo(p.status)}</h3><p className="mt-1 text-xs text-muted-foreground">{new Date(p.criado_em).toLocaleString("pt-BR")}</p><p className="mt-3 whitespace-pre-wrap text-sm">{p.alteracoes}</p></div>)}{dados?.notificacoes.filter(n => n.evento_id === selecionado.id).map(n => <p key={n.id} className="rounded-lg border-l-4 border-warning bg-muted p-4 text-sm">{n.mensagem}</p>)}</div>}
      </>}</section>
    </div>}
  </div>;
}

function TarefaCard({ tarefa: t, ocupado, permitido, agir }: { tarefa: Tarefa; ocupado: boolean; permitido: boolean; agir: (dados: unknown) => Promise<void> }) {
  const [erro, setErro] = useState("");
  const proximo = t.estado === "PENDENTE" && ["PRODUCAO", "EXPEDICAO"].includes(t.tipo) ? "EM_ANDAMENTO" : "PRONTO";
  const texto = t.tipo === "EXPEDICAO" ? (proximo === "EM_ANDAMENTO" ? "Marcar separado" : "Confirmar carregamento") : proximo === "EM_ANDAMENTO" ? "Iniciar produção" : "Concluir conferência";
  return <article className={`space-y-3 rounded-xl border bg-card p-5 ${t.estado === "PRONTO" ? "border-success/40" : ""}`}>
    <div className="flex justify-between gap-2"><span className="text-xs uppercase text-primary">{rotulo(t.setor)}</span><span className="flex items-center gap-1 text-xs text-muted-foreground">{t.estado === "PRONTO" ? <Check size={14} /> : <Clock size={14} />}{rotulo(t.estado)}</span></div>
    <h3 className="font-semibold">{t.quantidade !== null && `${t.quantidade} ${t.unidade} · `}{t.titulo}</h3><p className="whitespace-pre-wrap text-sm text-muted-foreground">{t.descricao}</p>
    {t.evidencia_path && <Button variant="outline" onClick={() => { void baixarArquivo(`/api/v1/operacao/evidencias?tarefaId=${t.id}`, "evidencia").catch(e => setErro(mensagem(e))); }}>Baixar evidência</Button>}
    {t.estado !== "PRONTO" && permitido && (t.evidencia_obrigatoria ? <form className="space-y-3" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); form.set("tarefaId", t.id); void agir(form).catch(f => setErro(mensagem(f))); }}><label className="block text-sm">Foto obrigatória · até 8 MB<input name="foto" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required className="mt-2 block w-full text-xs" /></label><Button type="submit" disabled={ocupado}>Enviar foto e concluir</Button></form> : <Button variant="outline" disabled={ocupado} onClick={() => { void agir({ id: t.id, estado: proximo }).catch(f => setErro(mensagem(f))); }}><ClipboardCheck size={16} />{texto}</Button>)}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
  </article>;
}

function Financeiro({ dados, evento, agir, ocupado, editar }: { dados: Operacao; evento: EventoOperacao; agir: (acao: string, dados: unknown) => Promise<void>; ocupado: boolean; editar: boolean }) {
  const idempotencia = useRef(crypto.randomUUID());
  const titulos = dados.titulos.filter(t => t.evento_id === evento.id);
  const total = titulos.reduce((s, t) => s + Number(t.valor), 0);
  async function criar(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const form = e.currentTarget; const v = new FormData(form); try { await agir("TITULO_CRIAR", { descricao: v.get("descricao"), valor: Number(v.get("valor")), vencimento: v.get("vencimento"), forma: v.get("forma"), idempotencia: idempotencia.current }); idempotencia.current = crypto.randomUUID(); form.reset(); } catch { /* erro apresentado na central; preserve a chave para não duplicar uma tentativa */ } }
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3">{[["Previsto em títulos", total], ["Recebido", titulos.filter(t => t.recebido_em).reduce((s, t) => s + Number(t.valor), 0)], ["Em aberto", titulos.filter(t => !t.recebido_em).reduce((s, t) => s + Number(t.valor), 0)]].map(([k, v]) => <div key={k} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-2 text-xl font-semibold">{moeda(Number(v))}</p></div>)}</div><p className="text-sm text-muted-foreground">Títulos não emitem boleto ou nota automaticamente. A emissão fiscal permanece no módulo fiscal.</p>{titulos.map(t => <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"><div><h3 className="font-semibold">{t.descricao} · {moeda(Number(t.valor))}</h3><p className="text-xs text-muted-foreground">{t.forma} · vence {dataCurta(t.vencimento)} · {t.recebido_em ? `recebido ${dataCurta(t.recebido_em)}` : t.vencimento < new Date().toLocaleDateString("en-CA") ? "EM ATRASO" : "em aberto"}</p></div>{!t.recebido_em && editar && <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); const v = new FormData(e.currentTarget); if (window.confirm("Confirmar recebimento conciliado no banco?")) void agir("TITULO_RECEBER", { id: t.id, recebidoEm: v.get("recebidoEm"), referencia: v.get("referencia") }).catch(() => undefined); }}><input aria-label="Data do recebimento" className={campoOperacao} required type="date" name="recebidoEm" /><input aria-label="Referência de conciliação" className={campoOperacao} name="referencia" placeholder="Referência bancária" required /><Button disabled={ocupado} type="submit">Confirmar recebimento</Button></form>}</div>)}{editar && <form onSubmit={e => { void criar(e); }} className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2"><h3 className="font-semibold sm:col-span-2">Adicionar parcela / entrada</h3><label className="text-sm">Descrição<input name="descricao" className={campoOperacao} required minLength={2} /></label><label className="text-sm">Valor (R$)<input name="valor" className={campoOperacao} type="number" min="0.01" step="0.01" required /></label><label className="text-sm">Vencimento<input name="vencimento" className={campoOperacao} type="date" required /></label><label className="text-sm">Forma<select name="forma" className={campoOperacao}>{["PIX", "BOLETO", "TRANSFERENCIA", "CARTAO", "DINHEIRO"].map(f => <option key={f}>{f}</option>)}</select></label><Button type="submit" disabled={ocupado || !evento.contrato_assinado_em}>Registrar título</Button></form>}<Link className="inline-flex text-sm text-primary underline" to="/notas-fiscais">Abrir notas fiscais</Link><div className="rounded-xl border bg-card p-4"><h3 className="font-semibold">Fila de integrações</h3>{dados.integracoes.filter(i => i.evento_id === evento.id).map(i => <p key={i.id} className="mt-2 text-sm">{rotulo(i.tipo)} · {rotulo(i.status)}</p>)}</div></div>;
}
function PosVenda({ dados, evento, agir, ocupado }: { dados: Operacao | null; evento: EventoOperacao; agir: (acao: string, dados: unknown) => Promise<void>; ocupado: boolean }) {
  const salvo = dados?.posVenda.find(p => p.evento_id === evento.id);
  return <form className="space-y-4 rounded-xl border bg-card p-5" onSubmit={e => { e.preventDefault(); const v = new FormData(e.currentTarget); void agir("POS_VENDA", { nota: Number(v.get("nota")), comentario: v.get("comentario"), retornoEm: v.get("retornoEm") || null }).catch(() => undefined); }}><h3 className="text-lg font-semibold">Feche o ciclo com o cliente</h3><p className="text-sm text-muted-foreground">Registre a resposta recebida, sem atribuir nota em nome do cliente.</p><label className="block text-sm">NPS (0 a 10)<input className={campoOperacao} name="nota" type="number" min={0} max={10} required defaultValue={salvo?.nota ?? ""} /></label><label className="block text-sm">Feedback<textarea className={campoOperacao} rows={4} name="comentario" defaultValue={salvo?.comentario ?? ""} /></label><label className="block text-sm">Próximo contato<input className={campoOperacao} name="retornoEm" type="date" defaultValue={salvo?.retorno_em ?? ""} /></label><Button type="submit" disabled={ocupado || evento.etapa_operacao !== "ENTREGUE"}>Salvar acompanhamento</Button></form>;
}
function mensagem(erro: unknown) { return erro instanceof Error ? erro.message : "Falha ao carregar operação."; }

