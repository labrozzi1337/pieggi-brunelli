import { useEffect, useState } from "react";
import { ArrowRight, Boxes, Building2, CircleDollarSign, Database, FileText, MonitorCog, Server, ShieldCheck, Sparkles, TrendingUp, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { MiniBars, Sparkline } from "@/components/hub/Charts";
import { getHealth, type HealthResponse } from "@/lib/api";

const companies = [
  { name: "Auditto", path: "/auditto", description: "Inteligência fiscal e auditoria de dados", metric: "R$ 4,8 mi", label: "oportunidades", icon: Sparkles, className: "portfolio-auditto", trend: [30, 42, 38, 56, 54, 70, 83] },
  { name: "Solutta", path: "/solutta", description: "Contabilidade que impulsiona negócios", metric: "1.284", label: "clientes ativos", icon: Building2, className: "portfolio-solutta", trend: [42, 47, 53, 52, 64, 68, 79] },
  { name: "Alerta Fiscal", path: "/alerta-fiscal", description: "Monitoramento preventivo de riscos", metric: "96,8%", label: "conformidade", icon: ShieldCheck, className: "portfolio-alerta", trend: [68, 61, 73, 69, 77, 82, 90] }
];

export function DashboardPage() {
  return <div className="min-h-full bg-[radial-gradient(circle_at_85%_5%,hsl(var(--primary)/0.10),transparent_30%)] p-4 sm:p-6 lg:p-8">
    <section className="hub-hero relative overflow-hidden rounded-[14px] p-6 text-white sm:p-8 lg:p-10">
      <div className="relative z-10 max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white/70"><span className="h-1.5 w-1.5 rounded-full bg-[#7ecce4]" />Ecossistema em tempo real</span>
        <h1 className="mt-6 max-w-xl text-3xl font-medium leading-tight tracking-[-0.03em] sm:text-4xl lg:text-5xl">Visão integrada para decisões mais inteligentes.</h1>
        <p className="mt-4 max-w-lg text-sm leading-6 text-white/60">Acompanhe os principais indicadores das empresas do Grupo Pomin em uma experiência única, clara e conectada.</p>
      </div>
      <div className="absolute -right-16 -top-28 h-80 w-80 rounded-full border border-white/10 bg-primary/20 blur-3xl" />
      <div className="absolute bottom-7 right-8 hidden w-64 opacity-60 lg:block"><Sparkline values={[20, 28, 24, 39, 36, 55, 51, 68, 64, 82]} /></div>
    </section>

    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Metric icon={CircleDollarSign} label="Receita consolidada" value="R$ 12,4 mi" change="+12,8%" />
      <Metric icon={Users} label="Clientes no grupo" value="2.847" change="+186 este ano" />
      <Metric icon={TrendingUp} label="Índice de crescimento" value="18,6%" change="Acima da meta" />
    </div>

    <SystemOverview />

    <div className="mt-8 flex items-end justify-between gap-4"><div><p className="eyebrow">Portfólio</p><h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Empresas do grupo</h2></div><span className="hidden text-xs text-muted-foreground sm:block">Dados atualizados há 4 min</span></div>
    <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
      {companies.map(({ name, path, description, metric, label, icon: Icon, className, trend }) => <Link key={name} to={path} className={`portfolio-card ${className} group`}>
        <div className="flex items-start justify-between"><span className="company-mark"><Icon className="h-5 w-5" /></span><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></div>
        <h3 className="mt-5 text-lg font-semibold">{name}</h3><p className="mt-1 text-xs opacity-60">{description}</p>
        <div className="mt-7 flex items-end justify-between gap-4"><div><p className="text-2xl font-semibold tracking-tight">{metric}</p><p className="mt-1 text-[10px] uppercase tracking-wider opacity-50">{label}</p></div><div className="h-12 w-28"><Sparkline values={trend} compact /></div></div>
      </Link>)}
    </div>

    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
      <section className="hub-card rounded-[14px] p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="eyebrow">Performance</p><h2 className="mt-1 text-base font-semibold">Evolução consolidada</h2></div><span className="status-pill status-positive">+18,6%</span></div><div className="mt-7 h-48"><MiniBars values={[44, 51, 47, 62, 58, 73, 78, 70, 86, 91, 84, 96]} labels={["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]} /></div></section>
      <section className="hub-card rounded-[14px] p-5 sm:p-6"><p className="eyebrow">Atualizações</p><h2 className="mt-1 text-base font-semibold">Atividade recente</h2><div className="mt-5 space-y-5"><Activity color="violet" title="Auditto gerou novo relatório" time="Há 12 minutos" /><Activity color="blue" title="Solutta atingiu meta mensal" time="Há 1 hora" /><Activity color="yellow" title="3 alertas fiscais resolvidos" time="Hoje, 09:42" /></div></section>
    </div>
  </div>;
}

const documents = [
  ["constitution.md", "Regras obrigatórias do projeto"],
  ["arch.md", "Arquitetura e convenções"],
  ["design.md", "Diretrizes visuais"],
  ["sac-boia.md", "Referência do produto"]
];

function SystemOverview() {
  const [health, setHealth] = useState<HealthResponse["data"] | null>(null);
  const [apiOffline, setApiOffline] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then(({ data }) => setHealth(data))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setApiOffline(true);
      });
    return () => controller.abort();
  }, []);

  const apiStatus = apiOffline ? "Fora do ar" : health ? "Em execução" : "Verificando";
  const databaseStatus = health?.database === "connected" ? "Conectado" : health?.database === "unconfigured" ? "Não configurado" : health?.database === "unavailable" ? "Indisponível" : "Verificando";

  return <section className="mt-8">
    <div><p className="eyebrow">Infraestrutura</p><h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Como o sistema está de pé</h2></div>
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
      <StackCard icon={MonitorCog} name="Vite" version="8.3.2" detail="Frontend React · porta 5173" status="Em execução" ok />
      <StackCard icon={Server} name="Next.js" version="16.3.8" detail="API · porta 3000" status={apiStatus} ok={!apiOffline} />
      <StackCard icon={Database} name="Supabase" version="JS 2.117.2" detail="Schema start_back" status={databaseStatus} ok={health?.database === "connected"} />
    </div>

    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="hub-card rounded-[14px] p-5 sm:p-6">
        <div className="flex items-start gap-3"><span className="rounded-[8px] bg-primary/10 p-2 text-primary"><Boxes className="h-5 w-5" /></span><div><p className="eyebrow">Monorepo · npm workspaces</p><h3 className="mt-1 text-base font-semibold">Frontend e backend sobem juntos</h3></div></div>
        <div className="mt-5 grid gap-2 font-mono text-xs">
          <code className="rounded-[8px] border bg-background/70 px-4 py-3"><span className="text-muted-foreground">1.</span> npm install</code>
          <code className="rounded-[8px] border bg-background/70 px-4 py-3"><span className="text-muted-foreground">2.</span> npm run dev</code>
        </div>
        <p className="mt-4 text-[11px] leading-5 text-muted-foreground">Execute na raiz. O script usa <strong className="text-foreground">concurrently</strong> para iniciar os dois workspaces.</p>
      </section>

      <section className="hub-card rounded-[14px] p-5 sm:p-6">
        <div className="flex items-start gap-3"><span className="rounded-[8px] bg-primary/10 p-2 text-primary"><FileText className="h-5 w-5" /></span><div><p className="eyebrow">Documentos</p><h3 className="mt-1 text-base font-semibold">Referências da pasta Documentos</h3></div></div>
        <div className="mt-4 divide-y divide-border">
          {documents.map(([file, description]) => <div key={file} className="flex items-center justify-between gap-4 py-2.5"><code className="text-[11px] font-semibold text-primary">{file}</code><span className="text-right text-[10px] text-muted-foreground">{description}</span></div>)}
        </div>
      </section>
    </div>
  </section>;
}

function StackCard({ icon: Icon, name, version, detail, status, ok }: { icon: typeof Server; name: string; version: string; detail: string; status: string; ok: boolean }) {
  return <section className="hub-card rounded-[14px] p-5"><div className="flex items-start justify-between gap-4"><span className="rounded-[8px] bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></span><span className={`status-pill ${ok ? "status-positive" : "bg-warning/10 text-warning"}`}><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current" />{status}</span></div><div className="mt-5 flex items-baseline gap-2"><h3 className="text-lg font-semibold">{name}</h3><code className="text-[10px] text-muted-foreground">v{version}</code></div><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p></section>;
}

function Metric({ icon: Icon, label, value, change }: { icon: typeof Users; label: string; value: string; change: string }) {
  return <section className="hub-card rounded-[14px] p-5 transition-transform hover:-translate-y-0.5"><div className="flex items-center justify-between"><span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-primary" /></div><div className="mt-4 flex items-end justify-between gap-3"><strong className="text-2xl font-semibold tracking-tight">{value}</strong><span className="text-[10px] font-medium text-success">{change}</span></div></section>;
}

function Activity({ color, title, time }: { color: string; title: string; time: string }) {
  const tone = color === "violet" ? "activity-violet" : color === "blue" ? "activity-blue" : "activity-yellow";
  return <div className="flex gap-3"><span className={`activity-dot ${tone}`} /><div><p className="text-xs font-medium">{title}</p><p className="mt-1 text-[10px] text-muted-foreground">{time}</p></div></div>;
}
