import { ArrowDownRight, ArrowUpRight, CalendarDays, Check, ChevronDown, Download, FileSearch, Filter, Landmark, Search, ShieldAlert, Users } from "lucide-react";
import type { CSSProperties } from "react";
import { MiniBars, Sparkline } from "@/components/hub/Charts";

type Company = "pomin" | "auditto" | "solutta" | "alerta";

const configs = {
  pomin: {
    name: "Grupo Pomin", eyebrow: "Business intelligence", greeting: "Estratégia conectada. Crescimento sustentável.", description: "Uma visão executiva das pessoas, operações e resultados que movem todo o ecossistema Pomin.", period: "Consolidado 2026",
    stats: [["Receita consolidada", "R$ 12,4 mi", "+12,8%"], ["Empresas no grupo", "3", "100% ativas"], ["Clientes atendidos", "2.847", "+186"], ["Eficiência operacional", "94,2%", "+4,8%"]],
    chartTitle: "Performance consolidada", chartValue: "+18,6%", chartData: [38, 46, 43, 55, 61, 59, 69, 73, 78, 84, 89, 96], chartLabels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
    ring: 88, ringTitle: "Objetivos estratégicos", ringValue: "88%", ringText: "22 de 25 objetivos alcançados",
    tableTitle: "Iniciativas do grupo", rows: [["GP-028", "Transformação digital", "Estratégico", "Q4 2026", "No prazo"], ["GP-024", "Expansão regional", "Comercial", "Q1 2027", "Em análise"], ["GP-019", "Academia de líderes", "Pessoas", "Outubro", "Concluída"]]
  },
  auditto: {
    name: "Auditto", eyebrow: "Fiscal Luminary", greeting: "Inteligência que revela oportunidades.", description: "Transforme dados fiscais complexos em decisões claras e resultados mensuráveis.", period: "Últimos 30 dias",
    stats: [["Créditos identificados", "R$ 4,8 mi", "+18,2%"], ["Documentos analisados", "18.420", "+7,4%"], ["Precisão da auditoria", "98,7%", "+1,2%"], ["Economia projetada", "R$ 890 mil", "+24,5%"]],
    chartTitle: "Créditos recuperáveis", chartValue: "R$ 1,24 mi", chartData: [35, 47, 42, 58, 62, 55, 71, 68, 79, 83, 91, 96], chartLabels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
    ring: 74, ringTitle: "Meta trimestral", ringValue: "74%", ringText: "R$ 3,2 mi de R$ 4,3 mi",
    tableTitle: "Auditorias recentes", rows: [["AT-2026-048", "Indústria Aurora", "ICMS", "R$ 284.900", "Concluída"], ["AT-2026-047", "Grupo Meridian", "PIS/COFINS", "R$ 186.420", "Em análise"], ["AT-2026-046", "Vértice Logística", "INSS", "R$ 92.800", "Concluída"]]
  },
  solutta: {
    name: "Solutta", eyebrow: "Contabilidade estratégica", greeting: "Crescimento com controle e clareza.", description: "Indicadores contábeis, operação e relacionamento em uma visão simples do seu negócio.", period: "Outubro 2026",
    stats: [["Receita gerenciada", "R$ 18,6 mi", "+14,8%"], ["Clientes ativos", "1.284", "+6,1%"], ["Entregas no prazo", "97,4%", "+2,8%"], ["NPS médio", "82", "+9 pts"]],
    chartTitle: "Crescimento da carteira", chartValue: "+186 clientes", chartData: [40, 44, 49, 56, 53, 65, 69, 72, 78, 82, 88, 94], chartLabels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
    ring: 91, ringTitle: "Saúde da operação", ringValue: "91%", ringText: "Excelente desempenho",
    tableTitle: "Entregas em andamento", rows: [["SL-2841", "Nexora Tecnologia", "Fechamento", "Hoje, 16:00", "Em revisão"], ["SL-2838", "Casa Vita", "Obrigações", "Amanhã", "No prazo"], ["SL-2834", "Studio Norte", "Planejamento", "04 out", "No prazo"]]
  },
  alerta: {
    name: "Alerta Fiscal", eyebrow: "Monitoramento preventivo", greeting: "Antecipe riscos. Proteja resultados.", description: "Visibilidade imediata para manter sua empresa em conformidade e agir no momento certo.", period: "Monitoramento ao vivo",
    stats: [["Empresas monitoradas", "842", "+38"], ["Alertas resolvidos", "1.964", "+12,4%"], ["Conformidade", "96,8%", "+3,1%"], ["Riscos evitados", "R$ 2,1 mi", "+18,9%"]],
    chartTitle: "Ocorrências por mês", chartValue: "-22% em riscos", chartData: [92, 83, 88, 72, 75, 64, 60, 55, 58, 48, 43, 37], chartLabels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
    ring: 96, ringTitle: "Índice de conformidade", ringValue: "96,8%", ringText: "Meta definida: 95%",
    tableTitle: "Alertas recentes", rows: [["AF-0918", "Comercial Atlas", "Divergência SPED", "R$ 42.800", "Atenção"], ["AF-0917", "Norte Distribuição", "Certidão", "2 dias", "Resolvido"], ["AF-0914", "Lumi Serviços", "Obrigação acessória", "Hoje", "Em análise"]]
  }
} as const;

export function CompanyPage({ company }: { company: Company }) {
  const config = configs[company];
  const companyClass = { pomin: "company-pomin", auditto: "company-auditto", solutta: "company-solutta", alerta: "company-alerta" }[company];
  return <div className={`company-page ${companyClass} min-h-full p-4 sm:p-6 lg:p-8`}>
    <header className="company-hero relative overflow-hidden rounded-[var(--company-radius)] p-6 sm:p-8">
      <div className="relative z-10 flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
        <div className="max-w-2xl"><div className="flex items-center gap-2"><span className="company-logo">{company === "pomin" ? "P" : company === "auditto" ? "A" : company === "solutta" ? "S" : "!"}</span><span className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">{config.eyebrow}</span></div><h1 className="mt-6 text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">{config.greeting}</h1><p className="mt-3 max-w-xl text-sm leading-6 opacity-65">{config.description}</p></div>
        <div className="flex flex-wrap gap-2"><button className="company-button-secondary"><CalendarDays className="h-4 w-4" />{config.period}<ChevronDown className="h-3.5 w-3.5" /></button><button className="company-button-primary"><Download className="h-4 w-4" />Exportar relatório</button></div>
      </div>
    </header>

    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{config.stats.map(([label, value, change], index) => <section className="company-card company-stat" key={label}><div className="flex items-center justify-between"><span className="company-label">{label}</span>{index === 0 ? <Landmark className="h-4 w-4" /> : index === 1 ? <FileSearch className="h-4 w-4" /> : index === 2 ? <ShieldAlert className="h-4 w-4" /> : <Users className="h-4 w-4" />}</div><div className="mt-5 flex items-end justify-between"><strong className="text-2xl font-semibold tracking-tight">{value}</strong><span className="company-positive inline-flex items-center gap-0.5 text-[10px] font-semibold"><ArrowUpRight className="h-3 w-3" />{change}</span></div></section>)}</div>

    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_0.8fr]">
      <section className="company-card p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="company-label">{config.chartTitle}</p><div className="mt-2 flex items-baseline gap-3"><strong className="text-2xl font-semibold">{config.chartValue}</strong><span className="company-positive text-[10px] font-semibold">vs. período anterior</span></div></div><div className="flex rounded-[var(--company-small-radius)] bg-black/[0.04] p-1 dark:bg-white/[0.05]"><button className="company-segment active">Mensal</button><button className="company-segment">Anual</button></div></div><div className="mt-7 h-52"><MiniBars values={[...config.chartData]} labels={[...config.chartLabels]} /></div></section>
      <section className="company-card flex flex-col p-5 sm:p-6"><p className="company-label">{config.ringTitle}</p><div className="grid flex-1 place-items-center py-5"><div className="progress-ring" style={{ "--progress": `${config.ring * 3.6}deg` } as CSSProperties}><div><strong>{config.ringValue}</strong><span>alcançado</span></div></div></div><p className="text-center text-[11px] opacity-55">{config.ringText}</p></section>
    </div>

    <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_0.8fr]">
      <section className="company-card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-current/10 p-5 sm:px-6"><div><p className="company-label">Operação</p><h2 className="mt-1 text-base font-semibold">{config.tableTitle}</h2></div><div className="flex gap-2"><button className="company-icon-button" aria-label="Buscar"><Search className="h-4 w-4" /></button><button className="company-icon-button" aria-label="Filtrar"><Filter className="h-4 w-4" /></button></div></div><div className="overflow-x-auto"><table className="company-table"><thead><tr><th>ID</th><th>Cliente</th><th>Categoria</th><th>Valor / Prazo</th><th>Status</th></tr></thead><tbody>{config.rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={cell}>{index === 4 ? <span className={`company-status ${cell === "Concluída" || cell === "No prazo" || cell === "Resolvido" ? "success" : "pending"}`}>{cell}</span> : cell}</td>)}</tr>)}</tbody></table></div></section>
      <section className="company-card p-5 sm:p-6"><p className="company-label">Biblioteca UI</p><h2 className="mt-1 text-base font-semibold">Componentes da marca</h2><div className="mt-5 space-y-5"><div><p className="mb-2 text-[10px] opacity-50">BOTÕES</p><div className="flex flex-wrap gap-2"><button className="company-button-primary">Primário</button><button className="company-button-secondary">Secundário</button></div></div><div><p className="mb-2 text-[10px] opacity-50">STATUS</p><div className="flex flex-wrap gap-2"><span className="company-status success"><Check className="h-3 w-3" />Concluído</span><span className="company-status pending">Em análise</span></div></div><div><p className="mb-2 text-[10px] opacity-50">TENDÊNCIA</p><div className="h-12 w-full"><Sparkline values={[42, 58, 49, 68, 63, 80, 89]} compact /></div></div><button className="company-link">Ver documentação <ArrowDownRight className="h-3.5 w-3.5" /></button></div></section>
    </div>
  </div>;
}
