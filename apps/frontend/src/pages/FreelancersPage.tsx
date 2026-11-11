import { useCallback, useEffect, useState } from "react";
import { useAoMudar } from "@/lib/aovivo";
import { useSearchParams } from "react-router-dom";
import { CadastroFreelancers } from "@/components/freelancers/CadastroFreelancers";
import { EscalaFreelancers } from "@/components/freelancers/EscalaFreelancers";
import { PagamentosFreelancers } from "@/components/freelancers/PagamentosFreelancers";
import type { DadosFreelancers } from "@/components/freelancers/comum";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/auth";
import { api } from "@/lib/api";

const abas = [["escala", "Escala"], ["cadastro", "Cadastro"], ["pagamentos", "Pagamentos"]] as const;
type Aba = (typeof abas)[number][0];

/** Módulo 7 — substitui a folha A4 da cozinha: cadastro, escala por evento e fechamento de pagamento. */
export function FreelancersPage() {
  const { usuario } = useAuth(); const empresa = usuario?.empresas[0];
  const [params, setParams] = useSearchParams();
  const aba: Aba = abas.some(([id]) => id === params.get("aba")) ? params.get("aba") as Aba : "escala";
  const [dados, setDados] = useState<DadosFreelancers | null>(null); const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!empresa) return;
    try { setDados(await api<DadosFreelancers>(`/api/v1/freelancers?empresaId=${empresa}`)); setErro(""); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível carregar os freelancers."); }
  }, [empresa]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);
  useAoMudar(carregar);

  const pendentes = dados?.tabela.funcoes.filter((f) => f.pendente) ?? [];
  return <div className="space-y-6 p-4 sm:p-6 lg:p-8">
    <header><p className="text-xs uppercase tracking-widest text-primary">Equipe de evento</p><h1 className="mt-2 text-3xl font-semibold">Freelancers e diárias</h1><p className="mt-2 text-sm text-muted-foreground">Escala por evento e dia, verba × custo e fechamento do pagamento.</p></header>
    {erro && <p role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{erro}</p>}
    {!!pendentes.length && <p className="rounded-lg bg-warning/10 p-3 text-sm">Tabela de diária por função ainda provisória ({pendentes.map((f) => f.funcao.toLowerCase()).join(", ")}). O admin confirma os valores em Regras.</p>}
    <nav className="flex flex-wrap gap-2" aria-label="Seções de freelancers">{abas.map(([id, nome]) =>
      <Button key={id} variant={aba === id ? "default" : "outline"} onClick={() => setParams((p) => { p.set("aba", id); return p; })}>{nome}</Button>)}</nav>
    {!dados && !erro && <p role="status">Carregando…</p>}
    {dados && empresa && <>
      {aba === "escala" && <EscalaFreelancers empresa={empresa} dados={dados} eventoInicial={params.get("evento") ?? undefined} />}
      {aba === "cadastro" && <CadastroFreelancers empresa={empresa} dados={dados} recarregar={carregar} />}
      {aba === "pagamentos" && <PagamentosFreelancers empresa={empresa} dados={dados} />}
    </>}
  </div>;
}
