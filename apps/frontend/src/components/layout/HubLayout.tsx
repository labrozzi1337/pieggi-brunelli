import { useEffect, useState, type CSSProperties } from "react";
import { Bell, Building2, ChevronRight, Gem, LayoutDashboard, Menu, Moon, Pin, PinOff, Search, ShieldCheck, Sparkles, Sun, X } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/contexts/theme";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { to: "/grupo-pomin", label: "Grupo Pomin", icon: Gem },
  { to: "/auditto", label: "Auditto", icon: Sparkles },
  { to: "/solutta", label: "Solutta", icon: Building2 },
  { to: "/alerta-fiscal", label: "Alerta Fiscal", icon: ShieldCheck }
];

const routeTitles: Record<string, string> = {
  "/dashboard": "Visão geral", "/grupo-pomin": "Grupo Pomin", "/auditto": "Auditto", "/solutta": "Solutta", "/alerta-fiscal": "Alerta Fiscal"
};

export function HubLayout() {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(() => localStorage.getItem("hub-sidebar-pinned") === "true");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const expanded = pinned || hovered;
  const title = routeTitles[location.pathname] ?? "Grupo Pomin";
  const shellClass = location.pathname === "/auditto" ? "shell-auditto" : location.pathname === "/solutta" ? "shell-solutta" : location.pathname === "/alerta-fiscal" ? "shell-alerta" : "shell-pomin";

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
            <div className="brand-logo grid h-7 w-7 shrink-0 place-items-center rounded-[5px] text-[10px] font-bold">GP</div>
            <div className={cn("whitespace-nowrap transition-opacity", expanded ? "opacity-100" : "opacity-0")}><p className="text-[12px] font-medium">Grupo Pomin</p><p className="text-[9px] uppercase tracking-widest text-muted-foreground">Ecossistema</p></div>
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
        <div className="flex min-w-0 items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></Button><div className="flex min-w-0 items-center gap-2 text-[12px] font-semibold sm:text-[13px]"><span className="hidden text-muted-foreground sm:inline">Grupo Pomin</span><ChevronRight className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" /><span className="truncate">{title}</span></div></div>
        <div className="flex items-center gap-1.5">
          <button className="hidden h-9 w-52 items-center gap-2 rounded-[7px] border border-border bg-muted/50 px-3 text-left text-[11px] text-muted-foreground transition-colors hover:border-primary/40 md:flex"><Search className="h-3.5 w-3.5" /> Buscar no hub...<kbd className="ml-auto rounded border border-border bg-background px-1.5 py-0.5 text-[9px]">⌘K</kbd></button>
          <Button variant="ghost" size="icon" aria-label="Notificações"><Bell className="h-[18px] w-[18px]" /></Button>
          <Button variant="ghost" size="icon" aria-label="Alternar tema" onClick={toggleTheme}>{theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}</Button>
          <div className="ml-1 grid h-8 w-8 place-items-center rounded-full bg-foreground text-[10px] font-semibold text-background">MS</div>
        </div>
      </header>

      <div className="brand-canvas fixed bottom-2 left-2 right-2 top-[72px] overflow-hidden rounded-[8px] border transition-[left,background-color] duration-300 ease-hub sm:bottom-3 sm:right-3 lg:left-[calc(var(--shell-left)+8px)]"><main className="hub-scroll h-full overflow-y-auto"><Outlet /></main></div>
    </div>
  );
}

function Brand({ expanded }: { expanded: boolean }) {
  return <div className="flex h-16 items-center gap-3 overflow-hidden px-[18px]"><div className="brand-logo grid h-8 w-8 shrink-0 place-items-center rounded-[6px] font-display text-sm font-bold">P</div><div className={cn("whitespace-nowrap transition-opacity duration-200", expanded ? "opacity-100" : "opacity-0")}><p className="text-sm font-semibold leading-tight">Grupo Pomin</p><p className="brand-muted text-[9px] uppercase tracking-[0.16em]">Business hub</p></div></div>;
}

function Navigation({ expanded, onNavigate }: { expanded: boolean; onNavigate: () => void }) {
  return <nav className="space-y-1 px-2 py-3" aria-label="Navegação principal">
    <p className={cn("mb-2 overflow-hidden px-2.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-opacity", expanded ? "opacity-100" : "opacity-0")}>Empresas</p>
    {navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={onNavigate} className={({ isActive }) => cn("group relative flex h-10 items-center gap-3 overflow-hidden rounded-[5px] pl-2.5 text-[13px] transition-all", isActive ? "brand-nav-active font-medium ring-1" : "brand-nav-idle")}><Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.75} /><span className={cn("whitespace-nowrap transition-opacity duration-200", expanded ? "opacity-100" : "opacity-0")}>{label}</span>{expanded && <ChevronRight className="ml-auto mr-3 h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-50" />}</NavLink>)}
  </nav>;
}
