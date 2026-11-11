import { AlertTriangle, CalendarDays, Check, ChevronRight, GripVertical, LockKeyhole, MapPin, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Evento } from "@/lib/api";
import { corEtapa, diasAte, etapas, formatarData, quantidadePendencias, rotulo, rotuloPrazo, urgenciaClasse, type Etapa } from "./util";

interface Comum { abrir: (evento: Evento) => void; setArrastando: (id: string | null) => void; podeMover: boolean }

export function Pipeline({ eventos, arrastando, mover, ...comum }: Comum & { eventos: Evento[]; arrastando: string | null; mover: (id: string, destino: Etapa) => Promise<void> }) {
  return <section className="mt-4 overflow-x-auto pb-3">
    <div className="grid min-w-[1740px] gap-3" style={{ gridTemplateColumns: "repeat(6, minmax(270px, 1fr))" }}>
      {etapas.map((etapa) => {
        const itens = eventos.filter((e) => e.etapaComercial === etapa.id);
        return <div key={etapa.id} className={`min-h-[420px] rounded-xl border bg-muted/35 p-3 transition ${arrastando ? "border-dashed border-primary/40" : ""}`}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
          onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/evento"); comum.setArrastando(null); if (id) void mover(id, etapa.id); }}>
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${etapa.cor}`} /><h2 className="text-xs font-bold uppercase tracking-[.08em]">{etapa.nome}</h2></div>
            <span className="rounded-full border bg-card px-2 py-0.5 text-[10px] font-bold">{itens.length}</span>
          </div>
          <div className="space-y-3">
            {itens.map((evento) => <Cartao key={evento.id} evento={evento} {...comum} />)}
            {!itens.length && <div className="grid min-h-24 place-items-center rounded-lg border border-dashed bg-card/50 p-4 text-center text-xs text-muted-foreground">Arraste um evento para cá</div>}
          </div>
        </div>;
      })}
    </div>
  </section>;
}

const GRUPOS_PRAZO: Array<[string, string]> = [["ATRASADO", "Data vencida"], ["3", "Até 3 dias"], ["7", "4 a 7 dias"], ["15", "8 a 15 dias"], ["MAIS", "Acima de 15 dias"], ["SEM_DATA", "Sem data"]];
const noGrupo = (grupo: string, d: number | null) => grupo === "SEM_DATA" ? d === null : d !== null && (grupo === "ATRASADO" ? d < 0 : grupo === "MAIS" ? d > 15 : grupo === "3" ? d >= 0 && d <= 3 : grupo === "7" ? d > 3 && d <= 7 : d > 7 && d <= 15);

export function QuadroPrazo({ eventos, ...comum }: Comum & { eventos: Evento[] }) {
  return <section className="mt-4 overflow-x-auto pb-3" aria-label="Quadro por prazo"><div className="grid min-w-[1740px] grid-cols-6 gap-3">
    {GRUPOS_PRAZO.map(([grupo, nome]) => {
      const itens = eventos.filter((e) => noGrupo(grupo, diasAte(e.dataEvento)));
      return <div key={grupo} className="min-h-[420px] rounded-xl border bg-muted/35 p-3"><h2 className="mb-3 flex justify-between text-xs font-bold uppercase">{nome}<span>{itens.length}</span></h2>
        <div className="space-y-3">{itens.map((e) => <Cartao key={e.id} evento={e} {...comum} podeMover={false} />)}{!itens.length && <p className="p-5 text-center text-xs text-muted-foreground">Sem eventos neste prazo.</p>}</div></div>;
    })}
  </div></section>;
}

function Cartao({ evento, abrir, setArrastando, podeMover }: Comum & { evento: Evento }) {
  const pendencias = quantidadePendencias(evento);
  const dias = diasAte(evento.dataEvento);
  return <button type="button" draggable={podeMover} onClick={() => abrir(evento)} onDragEnd={() => setArrastando(null)}
    onDragStart={(e) => { e.dataTransfer.setData("text/evento", evento.id); e.dataTransfer.effectAllowed = "move"; setArrastando(evento.id); }}
    className="group w-full cursor-grab rounded-xl border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md active:cursor-grabbing">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><h3 className="truncate text-sm font-semibold">{evento.titulo}</h3><p className="mt-1 truncate text-xs text-muted-foreground">{evento.clienteNome}</p></div>
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40 transition group-hover:text-muted-foreground" />
    </div>
    <div className="mt-4 grid gap-2 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatarData(evento.dataEvento)}{evento.horarioInicio ? ` · ${evento.horarioInicio.slice(0, 5)}` : ""}</span>
      <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{evento.pax ? `${evento.pax} pessoas` : "Pax pendente"}</span>
      {(evento.cidade || evento.logradouro) && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /><span className="truncate">{evento.cidade ? `${evento.cidade}${evento.uf ? `/${evento.uf}` : ""}` : evento.logradouro}</span></span>}
    </div>
    <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${urgenciaClasse(dias)}`}>{rotuloPrazo(dias)}</span>
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${pendencias ? "text-amber-700" : "text-emerald-700"}`}>
        {pendencias ? <AlertTriangle className="h-3 w-3" /> : <Check className="h-3 w-3" />}{pendencias ? `${pendencias} pendência${pendencias === 1 ? "" : "s"}` : "Completo"}
      </span>
    </div>
    <Artefatos evento={evento} />
  </button>;
}

export function Artefatos({ evento }: { evento: Evento }) {
  const a = evento.artefatos;
  if (!a) return null;
  const ok = (estado: string) => ["PRONTO", "APROVADA"].includes(estado);
  const ruim = (estado: string) => estado === "BLOQUEADO" || estado === "INVALIDADA";
  return <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Artefatos do evento">
    {([["Programação", a.programacao], ["Comanda", a.comanda], ["Plaquinhas", a.plaquinhas], ["Compras", a.compras], ["Campo", a.campo]] as const).map(([nome, estado]) =>
      <span key={nome} title={`${nome}: ${rotulo(estado)}${a.versao ? ` · v${a.versao}` : ""}`} aria-label={`${nome}: ${rotulo(estado)}`}
        className={`rounded-md border px-2 py-1 text-[9px] ${ok(estado) ? "border-success/30 bg-success/10 text-success" : ruim(estado) ? "border-destructive/20 bg-destructive/5 text-destructive" : "border-warning/30 bg-warning/10 text-foreground"}`}>
        {nome} · {ok(estado) ? "✓" : ruim(estado) ? "!" : "…"}</span>)}
  </div>;
}

const POR_PAGINA = 50;

export function ListaEventos({ eventos: todos, abrir }: { eventos: Evento[]; abrir: (evento: Evento) => void }) {
  const [pagina, setPagina] = useState(0);
  const paginas = Math.max(1, Math.ceil(todos.length / POR_PAGINA));
  const atual = Math.min(pagina, paginas - 1);
  const eventos = todos.slice(atual * POR_PAGINA, (atual + 1) * POR_PAGINA);
  return <section className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm"><div className="overflow-x-auto">
    <table className="w-full min-w-[940px] text-left text-sm">
      <thead className="bg-muted/60 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><tr>
        <th className="px-4 py-3">Evento e cliente</th><th className="px-4 py-3">Quando</th><th className="px-4 py-3">Local</th><th className="px-4 py-3">Pax</th>
        <th className="px-4 py-3">Comercial</th><th className="px-4 py-3">Operação</th><th className="px-4 py-3"><span className="sr-only">Ação</span></th>
      </tr></thead>
      <tbody>
        {eventos.map((e) => <tr key={e.id} className="border-t transition hover:bg-muted/35">
          <td className="px-4 py-3"><strong className="block">{e.titulo}</strong><span className="text-xs text-muted-foreground">{e.clienteNome}</span></td>
          <td className="px-4 py-3"><span className="block">{formatarData(e.dataEvento)}</span><span className="text-xs text-muted-foreground">{e.horarioInicio?.slice(0, 5) ?? "Horário pendente"}</span></td>
          <td className="px-4 py-3">{e.cidade ? `${e.cidade}/${e.uf}` : e.logradouro ?? "Pendente"}</td>
          <td className="px-4 py-3">{e.pax ?? "—"}</td>
          <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${corEtapa(e.etapaComercial)}`}>{rotulo(e.etapaComercial)}</span></td>
          <td className="px-4 py-3">{e.etapaOperacao === "BLOQUEADO" ? <span className="inline-flex items-center gap-1 text-amber-700"><LockKeyhole className="h-3.5 w-3.5" />Bloqueada</span> : rotulo(e.etapaOperacao)}</td>
          <td className="px-4 py-3 text-right"><Button variant="outline" onClick={() => abrir(e)}>Abrir <ChevronRight className="h-3.5 w-3.5" /></Button></td>
        </tr>)}
        {!eventos.length && <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">Nenhum evento corresponde aos filtros.</td></tr>}
      </tbody>
    </table>
  </div>{paginas > 1 && <nav className="flex items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground" aria-label="Paginação">
    <span>{atual * POR_PAGINA + 1}–{atual * POR_PAGINA + eventos.length} de {todos.length}</span>
    <span className="flex gap-2"><Button variant="outline" disabled={atual === 0} onClick={() => setPagina(atual - 1)}>Anterior</Button>
      <Button variant="outline" disabled={atual >= paginas - 1} onClick={() => setPagina(atual + 1)}>Próxima</Button></span>
  </nav>}</section>;
}
