import { useCallback, useEffect, useState } from "react";
import { useAoMudar } from "@/lib/aovivo";
import { ArrowUpRight, CalendarDays, ClipboardCheck, ReceiptText } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/auth";
import { consultarOperacao, dataCurta, diasComSobrecarga, moeda, rotulo, type Operacao } from "@/lib/operacao";

export function DashboardPage() {
  const { usuario } = useAuth();
  const empresa = usuario?.empresas[0];
  const [dados, setDados] = useState<Operacao>();
  const [erro, setErro] = useState("");
  const [mes, setMes] = useState(() => { const hoje = new Date(); return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2,"0")}`; });
  const carregar = useCallback(async () => {
    if (!empresa) return;
    try { setDados(await consultarOperacao(empresa, null, `${mes}-01`)); setErro(""); }
    catch (e) { setErro(e instanceof Error ? e.message : "Falha na consulta."); }
  }, [empresa, mes]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- busca remota ao trocar empresa/mês
  useEffect(() => { void carregar(); }, [carregar]);
  useAoMudar(carregar);
  const eventos = dados?.eventos.filter(e => e.data_evento?.startsWith(mes) && e.etapa_comercial !== "PERDIDO") ?? [];
  const ids = new Set(eventos.map(e => e.id));
  const valores = dados?.valores.filter(v => ids.has(v.evento_id)) ?? [];
  const titulos = dados?.titulos.filter(t => ids.has(t.evento_id)) ?? [];
  const venda = valores.reduce((s,v) => s + Number(v.valor_venda ?? 0),0);
  const custo = valores.reduce((s,v) => s + Number(v.custo_estimado ?? 0),0);
  const custos = dados?.custos.filter(c => ids.has(c.evento_id) && !c.cancelado_em) ?? [];
  const realizado = custos.reduce((s,c) => s + Number(c.valor),0);
  const semCusto = eventos.filter(e => !custos.some(c => c.evento_id === e.id)).length;
  const sobrecarga = diasComSobrecarga(eventos);
  const notas = dados?.posVenda.filter(p => ids.has(p.evento_id) && p.nota !== null) ?? [];
  const nps = notas.length ? Math.round(100 * (notas.filter(p => Number(p.nota) >= 9).length - notas.filter(p => Number(p.nota) <= 6).length) / notas.length) : null;
  const semValor = eventos.filter(e => !valores.some(v => v.evento_id === e.id && v.valor_venda !== null)).length;
  return <div className="space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="hub-hero flex flex-wrap items-end justify-between gap-6 rounded-xl p-6 text-white sm:p-8"><div><p className="text-xs uppercase tracking-widest text-white/70">Pieggi · controle do ciclo completo</p><h1 className="mt-3 text-3xl font-semibold">O que precisa da sua atenção?</h1><p className="mt-3 text-sm text-white/70">Acompanhe os eventos, a entrega e os recebimentos sem sair do fluxo.</p></div><label className="text-xs">Competência do evento<input type="month" required value={mes} onChange={e => setMes(e.target.value)} className="mt-2 block rounded-md border border-white/30 bg-background p-2 text-foreground" /></label></header>
    {erro && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">{erro}</p>}
    {!empresa && <p role="alert">Seu acesso não possui uma empresa vinculada.</p>}
    {!dados && !erro && empresa && <p role="status">Consultando indicadores…</p>}
    {dados && <>
      {sobrecarga.length > 0 && <section className="rounded-xl border border-warning/40 bg-warning/10 p-5" aria-label="Alerta de capacidade"><h2 className="font-semibold">Revise a capacidade da operação</h2><p className="mt-1 text-sm">Referência da temporada de confraternização: dois eventos por dia. Não bloqueia o agendamento; exige revisão da equipe.</p><div className="mt-3 flex flex-wrap gap-3">{sobrecarga.map(([dia,total]) => <span key={dia} className="rounded-lg border bg-card px-3 py-2 text-sm">{dataCurta(dia)} · {total} contratos</span>)}</div></section>}
      {dados.podeValores && <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Custos realizados · acompanhamento parcial</h2><p className="mt-2 text-sm text-muted-foreground">{semCusto ? `${semCusto} evento(s) sem lançamentos reais. Ausência de custo não significa custo zero.` : "Valores lançados manualmente; confira a completude antes de considerar o resultado final."}</p><p className="mt-4 text-2xl font-semibold">{custos.length ? moeda(realizado) : "Sem lançamentos"}</p><p className="mt-1 text-xs text-muted-foreground">{custos.length} lançamento(s) ativo(s) para os eventos do mês. Cancelamentos excluídos, histórico preservado.</p></section>}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Eventos no mês", eventos.length], ["Contratos pendentes", eventos.filter(e => !e.contrato_assinado_em).length], ["Em produção / expedição", eventos.filter(e => ["PRODUCAO","EXPEDICAO"].includes(e.etapa_operacao)).length], ["NPS", nps ?? "Sem respostas"]].map(([nome, valor]) => <article className="rounded-xl border bg-card p-5" key={nome}><p className="text-xs text-muted-foreground">{nome}</p><p className="mt-3 text-3xl font-semibold">{valor}</p></article>)}</section>
      {dados.podeValores && <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Financeiro por competência</h2><p className="mt-1 text-xs text-muted-foreground">Recebimentos referentes aos eventos do mês escolhido, independentemente da data do pagamento. {semValor > 0 && `${semValor} evento(s) ainda sem valor de venda.`}</p><div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{[["Venda cadastrada",venda], ["Custo estimado",custo], ["Recebido",titulos.filter(t => t.recebido_em).reduce((s,t) => s + Number(t.valor),0)], ["Títulos em aberto",titulos.filter(t => !t.recebido_em).reduce((s,t) => s + Number(t.valor),0)]].map(([k,v]) => <div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="mt-2 text-xl font-semibold">{moeda(Number(v))}</p></div>)}</div></section>}
      <section className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(250px,1fr)]"><div className="rounded-xl border bg-card p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Agenda do mês</h2><Link to="/eventos" className="text-xs text-primary">Ver funil completo</Link></div><div className="mt-4 space-y-2">{eventos.map(e => <Link key={e.id} to={`/operacao?evento=${e.id}`} className="flex items-center gap-4 rounded-lg border p-4 transition hover:border-primary"><CalendarDays size={20} className="shrink-0 text-primary" /><div className="min-w-0 flex-1"><h3 className="truncate font-medium">{e.titulo}</h3><p className="mt-1 text-xs text-muted-foreground">{dataCurta(e.data_evento)} · {e.pax ?? "—"} pessoas · {rotulo(e.etapa_operacao)}</p></div><ArrowUpRight size={16} /></Link>)}{!eventos.length && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum evento nesta competência.</p>}</div></div><aside className="space-y-4"><Link className="block rounded-xl border bg-card p-5 hover:border-primary" to="/operacao"><ClipboardCheck className="text-primary" /><h2 className="mt-3 font-semibold">Central de operação</h2><p className="mt-2 text-sm text-muted-foreground">Programações, conferências, evidências e retorno.</p></Link>{dados.podeValores && <Link className="block rounded-xl border bg-card p-5 hover:border-primary" to="/notas-fiscais"><ReceiptText className="text-primary" /><h2 className="mt-3 font-semibold">Documentos fiscais</h2><p className="mt-2 text-sm text-muted-foreground">Consultar notas e baixar XML e DANFE.</p></Link>}<div className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Alterações operacionais</h2>{dados.notificacoes.filter(n => ids.has(n.evento_id)).slice(0,5).map(n => <Link key={n.id} to={`/operacao?evento=${n.evento_id}&aba=historico`} className="mt-3 block border-l-2 border-warning pl-3 text-xs leading-5">{n.mensagem}</Link>)}{!dados.notificacoes.some(n => ids.has(n.evento_id)) && <p className="mt-3 text-xs text-muted-foreground">Sem alertas registrados neste mês.</p>}</div></aside></section>
    </>}
  </div>;
}
