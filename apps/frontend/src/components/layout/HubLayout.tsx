import { Suspense, useEffect, useState, type CSSProperties } from "react";
import { BookOpen, Boxes, Calculator, CalendarDays, ChefHat, ClipboardCheck, ChevronRight, FileText, LayoutDashboard, LogOut, Menu, Moon, Pin, PinOff, Settings, ShoppingCart, Sun, Users, X } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/contexts/theme";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth";
import { useVigiaMudancas } from "@/lib/aovivo";

const navItems = [
  { to: "/eventos", label: "Eventos", icon: CalendarDays },
  { to: "/propostas", label: "Propostas", icon: FileText, papeis: ["ADMIN", "COMERCIAL", "ATENDIMENTO", "FINANCEIRO"] },
  { to: "/calculadora", label: "Calculadora", icon: Calculator, papeis: ["ADMIN", "COMERCIAL", "ATENDIMENTO", "PROGRAMACAO"] },
  { to: "/operacao", label: "Operação", icon: ClipboardCheck },
  { to: "/producao", label: "Produção", icon: ChefHat, papeis: ["ADMIN", "PROGRAMACAO", "PRODUCAO"] },
  { to: "/compras", label: "Compras", icon: ShoppingCart, papeis: ["ADMIN", "PROGRAMACAO", "EXPEDICAO_COMPRAS", "PRODUCAO", "COMERCIAL"] },
  { to: "/estoque", label: "Estoque", icon: Boxes, papeis: ["ADMIN", "EXPEDICAO_COMPRAS", "PRODUCAO", "PROGRAMACAO", "COMERCIAL"] },
  { to: "/freelancers", label: "Freelancers", icon: Users, papeis: ["ADMIN", "EXPEDICAO_COMPRAS", "FINANCEIRO"] },
  { to: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { to: "/regras", label: "Regras e cardápio", icon: BookOpen, papeis: ["ADMIN", "COMERCIAL", "ATENDIMENTO", "FINANCEIRO", "PROGRAMACAO"] },
  { to: "/notas-fiscais", label: "Notas fiscais", icon: FileText, papeis: ["ADMIN", "FINANCEIRO", "COMERCIAL", "ATENDIMENTO"] },
  { to: "/configuracoes", label: "Configurações", icon: Settings, papeis: ["ADMIN", "FINANCEIRO"] },
];

const routeTitles: Record<string, string> = {
  "/eventos": "Eventos",
  "/propostas": "Propostas comerciais",
  "/operacao": "Central de operação",
  "/calculadora": "Calculadora de evento",
  "/regras": "Regras e cardápio",
  "/producao": "Estação de produção",
  "/compras": "Compras",
  "/estoque": "Estoque",
  "/freelancers": "Freelancers e diárias",
  "/dashboard": "Visão geral", "/notas-fiscais": "Notas fiscais", "/notas-fiscais/nova": "Nova NF-e", "/configuracoes": "Configurações"
};

export function HubLayout() {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(() => localStorage.getItem("hub-sidebar-pinned") === "true");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { usuario, sair } = useAuth();
  useVigiaMudancas(usuario?.empresas[0]);
  const location = useLocation();
  const expanded = pinned || hovered;
  const title = routeTitles[location.pathname] ?? "Pieggi";
  const shellClass = "shell-pieggi";

  useEffect(() => { localStorage.setItem("hub-sidebar-pinned", String(pinned)); }, [pinned]);

  return (
    <div className={`brand-shell ${shellClass} min-h-screen`} style={{ "--shell-left": expanded ? "var(--sb-open)" : "var(--sb-closed)" } as CSSProperties}>
      <aside className="brand-sidebar fixed inset-y-0 left-0 z-40 hidden flex-col border-r transition-[width,background-color,color] duration-300 ease-hub lg:flex" style={{ width: expanded ? "var(--sb-open)" : "var(--sb-closed)" }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <Brand expanded={expanded} />
        <Navigation expanded={expanded} onNavigate={() => undefined} />
        <div className="mt-auto space-y-2 border-t border-border p-2.5">
          <button type="button" onClick={() => setPinned((value) => !value)} className={cn("flex h-10 w-full items-center gap-3 overflow-hidden rounded-[5px] px-2.5 text-[12px] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.04]", pinned ? "text-primary" : "text-muted-foreground")} aria-label={pinned ? "Desafixar menu" : "Fixar menu"} title={pinned ? "Desafixar menu" : "Fixar menu"}>
            {pinned ? <PinOff className="h-[17px] w-[17px] shrink-0" /> : <Pin className="h-[17px] w-[17px] shrink-0" />}
            <span className={cn("whitespace-nowrap transition-opacity", expanded ? "opacity-100" : "opacity-0")}>{pinned ? "Desafixar menu" : "Fixar menu"}</span>
          </button>
          <div className="flex h-10 items-center gap-3 overflow-hidden rounded-md px-2.5">
            <div className="brand-logo grid h-7 w-7 shrink-0 place-items-center rounded-[5px] text-[10px] font-bold">P</div>
            <div className={cn("whitespace-nowrap transition-opacity", expanded ? "opacity-100" : "opacity-0")}><p className="text-[12px] font-medium">Pieggi</p><p className="text-[9px] uppercase tracking-widest text-muted-foreground">Operação 360</p></div>
          </div>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden">
        <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />
        <aside className="brand-sidebar relative flex h-full w-[290px] flex-col border-r">
          <div className="flex items-center justify-between pr-3"><Brand expanded /><Button variant="ghost" size="icon" aria-label="Fechar menu" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></Button></div>
          <Navigation expanded onNavigate={() => setMobileOpen(false)} />
        </aside>
      </div>}

      <header className="brand-header fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between border-b px-3 backdrop-blur-xl transition-[padding-left,background-color,color] duration-300 ease-hub sm:px-5 lg:pl-[calc(var(--shell-left)+20px)]">
        <div className="flex min-w-0 items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></Button><div className="flex min-w-0 items-center gap-2 text-[12px] font-semibold sm:text-[13px]"><span className="hidden text-muted-foreground sm:inline">Pieggi</span><ChevronRight className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" /><span className="truncate">{title}</span></div></div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" aria-label="Alternar tema" onClick={toggleTheme}>{theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}</Button>
          <div className="ml-1 grid h-8 w-8 place-items-center rounded-full bg-foreground text-[10px] font-semibold text-background" title={usuario?.nome}>{usuario?.nome.split(/\s+/).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase()}</div>
          <Button variant="ghost" size="icon" aria-label="Sair" title="Sair" onClick={() => { void sair(); }}><LogOut className="h-[18px] w-[18px]" /></Button>
        </div>
      </header>

      <div className="brand-canvas fixed bottom-2 left-2 right-2 top-[72px] overflow-hidden rounded-[8px] border transition-[left,background-color] duration-300 ease-hub sm:bottom-3 sm:right-3 lg:left-[calc(var(--shell-left)+8px)]"><main className="hub-scroll h-full overflow-y-auto"><Suspense fallback={<p role="status" className="p-8 text-sm text-muted-foreground">Carregando…</p>}><Outlet /></Suspense></main></div>
    </div>
  );
}

function Brand({ expanded }: { expanded: boolean }) {
  return <div className="flex h-16 items-center gap-3 overflow-hidden px-[18px]"><div className="brand-logo grid h-8 w-8 shrink-0 place-items-center rounded-[6px] font-display text-sm font-bold">P</div><div className={cn("whitespace-nowrap transition-opacity duration-200", expanded ? "opacity-100" : "opacity-0")}><p className="text-sm font-semibold leading-tight">Pieggi</p><p className="brand-muted text-[9px] uppercase tracking-[0.16em]">Operação 360</p></div></div>;
}

function Navigation({ expanded, onNavigate }: { expanded: boolean; onNavigate: () => void }) {
  const { usuario } = useAuth();
  return <nav className="space-y-1 px-2 py-3" aria-label="Navegação principal">
    <p className={cn("mb-2 overflow-hidden px-2.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-opacity", expanded ? "opacity-100" : "opacity-0")}>Pieggi</p>
    {navItems.filter(item => !item.papeis || usuario?.papeis.some(p => item.papeis.includes(p))).map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={onNavigate} title={!expanded ? label : undefined} className={({ isActive }) => cn("group relative flex h-10 w-full items-center gap-3 overflow-hidden rounded-[5px] pl-2.5 text-[13px] transition-all", isActive ? "brand-nav-active font-medium ring-1" : "brand-nav-idle")}><Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.75} /><span className={cn("whitespace-nowrap transition-opacity duration-200", expanded ? "opacity-100" : "opacity-0")}>{label}</span>{expanded && <ChevronRight className="ml-auto mr-3 h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-50" />}</NavLink>)}
  </nav>;
}
