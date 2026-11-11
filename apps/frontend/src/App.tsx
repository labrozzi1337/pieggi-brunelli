import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
import { HubLayout } from "@/components/layout/HubLayout";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { useAuth } from "@/contexts/auth";

// Cada tela é baixada só quando aberta; depois do login, as demais são pré-carregadas em segundo plano.
const importadores = {
  DashboardPage: () => import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
  NotasFiscaisPage: () => import("@/pages/NotasFiscaisPage").then((m) => ({ default: m.NotasFiscaisPage })),
  NovaNotaFiscalPage: () => import("@/pages/NovaNotaFiscalPage").then((m) => ({ default: m.NovaNotaFiscalPage })),
  EventosPage: () => import("@/pages/EventosPage").then((m) => ({ default: m.EventosPage })),
  OperacaoPage: () => import("@/pages/OperacaoPage").then((m) => ({ default: m.OperacaoPage })),
  ProducaoPage: () => import("@/pages/ProducaoPage").then((m) => ({ default: m.ProducaoPage })),
  ComprasPage: () => import("@/pages/ComprasPage").then((m) => ({ default: m.ComprasPage })),
  CampoPage: () => import("@/pages/CampoPage").then((m) => ({ default: m.CampoPage })),
  FreelancersPage: () => import("@/pages/FreelancersPage").then((m) => ({ default: m.FreelancersPage })),
  EstoquePage: () => import("@/pages/EstoquePage").then((m) => ({ default: m.EstoquePage })),
  RegrasPage: () => import("@/pages/RegrasPage").then((m) => ({ default: m.RegrasPage })),
  CalculadoraPage: () => import("@/pages/CalculadoraPage").then((m) => ({ default: m.CalculadoraPage })),
  ConfiguracoesPage: () => import("@/pages/ConfiguracoesPage").then((m) => ({ default: m.ConfiguracoesPage })),
  PropostasPage: () => import("@/pages/PropostasPage").then((m) => ({ default: m.PropostasPage }))
};
const DashboardPage = lazy(importadores.DashboardPage);
const NotasFiscaisPage = lazy(importadores.NotasFiscaisPage);
const NovaNotaFiscalPage = lazy(importadores.NovaNotaFiscalPage);
const EventosPage = lazy(importadores.EventosPage);
const OperacaoPage = lazy(importadores.OperacaoPage);
const ProducaoPage = lazy(importadores.ProducaoPage);
const ComprasPage = lazy(importadores.ComprasPage);
const CampoPage = lazy(importadores.CampoPage);
const FreelancersPage = lazy(importadores.FreelancersPage);
const EstoquePage = lazy(importadores.EstoquePage);
const RegrasPage = lazy(importadores.RegrasPage);
const CalculadoraPage = lazy(importadores.CalculadoraPage);
const ConfiguracoesPage = lazy(importadores.ConfiguracoesPage);
const PropostasPage = lazy(importadores.PropostasPage);
let preCarregado = false;
function preCarregarTelas() {
  if (preCarregado) return;
  preCarregado = true;
  const rodar = () => { for (const importar of Object.values(importadores)) void importar(); };
  if ("requestIdleCallback" in window) window.requestIdleCallback(rodar); else setTimeout(rodar, 1500);
}

export function App() {
  const { usuario, carregando } = useAuth();
  const location = useLocation();
  if (location.pathname === "/campo") return <Suspense fallback={null}><CampoPage /></Suspense>;
  if (carregando) return <div className="grid min-h-screen place-items-center bg-slate-950 text-sm text-white">Carregando…</div>;
  if (!usuario) return <LoginPage />;
  preCarregarTelas();
  return (
    <Routes>
      <Route element={<HubLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="eventos" element={<EventosPage />} />
        <Route path="propostas" element={<PropostasPage />} />
        <Route path="calculadora" element={<CalculadoraPage />} />
        <Route path="regras" element={<RegrasPage />} />
        <Route path="operacao" element={<OperacaoPage />} />
        <Route path="producao" element={<ProducaoPage />} />
        <Route path="compras" element={<ComprasPage />} />
        <Route path="estoque" element={<EstoquePage />} />
        <Route path="freelancers" element={<FreelancersPage />} />
        <Route path="notas-fiscais" element={<NotasFiscaisPage />} />
        <Route path="notas-fiscais/nova" element={<NovaNotaFiscalPage />} />
        <Route path="configuracoes" element={<ConfiguracoesPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

