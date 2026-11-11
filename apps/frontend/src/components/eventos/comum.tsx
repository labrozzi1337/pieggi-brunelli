import { AlertTriangle, CheckCircle2, Filter, Info, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { campo } from "./util";

export function Metrica({ icone, rotulo, valor, detalhe, tom = "slate" }: { icone: ReactNode; rotulo: string; valor: number; detalhe: string; tom?: string }) {
  const cores: Record<string, string> = { slate: "bg-slate-900 text-white", sky: "bg-sky-500/10 text-sky-700", amber: "bg-amber-500/10 text-amber-700", emerald: "bg-emerald-500/10 text-emerald-700" };
  return <article className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl [&>svg]:h-5 [&>svg]:w-5 ${cores[tom]}`}>{icone}</span>
    <div><p className="text-xs font-semibold text-muted-foreground">{rotulo}</p><p className="mt-0.5 text-2xl font-bold">{valor}</p><p className="text-[10px] text-muted-foreground">{detalhe}</p></div>
  </article>;
}

export function Filtro({ valor, alterar, rotulo, opcoes }: { valor: string; alterar: (valor: string) => void; rotulo: string; opcoes: Array<[string, string]> }) {
  return <label className="relative"><span className="sr-only">{rotulo}</span><Filter className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
    <select className={`${campo} min-w-44 pl-9 pr-8`} value={valor} onChange={(e) => alterar(e.target.value)}>{opcoes.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select>
  </label>;
}

export function IconeBotao({ ativo, rotulo, onClick, children }: { ativo: boolean; rotulo: string; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-pressed={ativo} className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-semibold transition [&>svg]:h-3.5 [&>svg]:w-3.5 ${ativo ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} onClick={onClick}>
    {children}<span className="hidden sm:inline">{rotulo}</span>
  </button>;
}

export function Campo({ label, children, critico, className = "" }: { label: string; children: ReactNode; critico?: boolean; className?: string }) {
  return <label className={`grid gap-1.5 text-xs font-semibold text-muted-foreground ${className}`}>
    <span>{label}{critico && <span className="ml-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300" title="Dado crítico: nunca deduzido">obrigatório</span>}</span>
    {children}
  </label>;
}

export function Secao({ titulo, descricao }: { titulo: string; descricao?: string }) {
  return <div><h3 className="font-semibold">{titulo}</h3>{descricao && <p className="mt-1 text-sm leading-6 text-muted-foreground">{descricao}</p>}</div>;
}

export function Bloco({ icone, titulo, valor, detalhe }: { icone: ReactNode; titulo: string; valor: string; detalhe: string }) {
  return <div className="rounded-xl border bg-muted/25 p-4"><span className="text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">{icone}</span>
    <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{titulo}</p><p className="mt-1 text-sm font-semibold">{valor}</p><p className="mt-1 text-xs text-muted-foreground">{detalhe}</p></div>;
}

export function ResumoItem({ nome, valor }: { nome: string; valor?: string | null }) {
  return <div className="rounded-lg bg-muted/35 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{nome}</p><p className="mt-1 break-words">{valor || "Pendente"}</p></div>;
}

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return <div className="mt-4 grid min-h-40 place-items-center rounded-xl border bg-card" role="status">
    <div className="text-center"><span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-primary border-r-transparent" /><p className="mt-3 text-sm text-muted-foreground">{texto}</p></div>
  </div>;
}

/** Caixa de mensagens: bloqueio (vermelho), atenção (âmbar), ok (verde) ou informação. */
export function Aviso({ tom, titulo, itens }: { tom: "bloqueio" | "atencao" | "ok" | "info"; titulo: string; itens?: string[] }) {
  const estilo = { bloqueio: "border-destructive/40 bg-destructive/10 text-destructive", atencao: "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200", ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200", info: "border-border bg-muted/40" }[tom];
  const Icone = { bloqueio: Lock, atencao: AlertTriangle, ok: CheckCircle2, info: Info }[tom];
  return <div role={tom === "bloqueio" ? "alert" : undefined} className={`rounded-xl border p-3 text-sm ${estilo}`}>
    <p className="flex items-center gap-2 font-semibold"><Icone className="h-4 w-4 shrink-0" />{titulo}</p>
    {!!itens?.length && <ul className="mt-2 list-disc space-y-1 pl-6 text-xs leading-5">{itens.map((i, k) => <li key={k}>{i}</li>)}</ul>}
  </div>;
}

/** Botão-chip de escolha rápida (linha, tier, período, bebida). */
export function Chip({ ativo, onClick, children, disabled }: { ativo?: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return <button type="button" disabled={disabled} aria-pressed={ativo} onClick={onClick}
    className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${ativo ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/50"}`}>{children}</button>;
}
