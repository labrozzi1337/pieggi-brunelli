import { Navigate, Route, Routes } from "react-router-dom";
import { HubLayout } from "@/components/layout/HubLayout";
import { CompanyPage } from "@/pages/CompanyPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export function App() {
  return (
    <Routes>
      <Route element={<HubLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="grupo-pomin" element={<CompanyPage company="pomin" />} />
        <Route path="auditto" element={<CompanyPage company="auditto" />} />
        <Route path="solutta" element={<CompanyPage company="solutta" />} />
        <Route path="alerta-fiscal" element={<CompanyPage company="alerta" />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

