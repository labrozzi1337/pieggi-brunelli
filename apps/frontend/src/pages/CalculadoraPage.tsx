// Calculadora: simulação rápida com o MESMO motor e os mesmos componentes do assistente de evento, sem cadastrar nada.
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth";
import { api } from "@/lib/api";
import { impedimentos, reais, simular, type ServicoForm, type Sugestao } from "@/lib/eventos";
import type { RegraApi } from "@/lib/regras";
import { Aviso, Campo } from "@/components/eventos/comum";
import { ServicosEditor } from "@/components/eventos/ServicosEditor";
import { campo, mensagem } from "@/components/eventos/util";

const hoje = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export function CalculadoraPage() {
  const { usuario } = useAuth();
  const empresa = usuario?.empresas[0];
  const [regras, setRegras] = useState<RegraApi[]>([]);
  const [data, setData] = useState(hoje);
  const [tabela, setTabela] = useState("EXTERNOS");
  const [cliente, setCliente] = useState("");
  const [regiao, setRegiao] = useState("");
  const [servicos, setServicos] = useState<ServicoForm[]>([]);
  const [resultado, setResultado] = useState<Sugestao | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!empresa) return;
    api<{ regras: RegraApi[] }>(`/api/v1/regras?empresaId=${empresa}`).then((r) => setRegras(r.regras)).catch((e: unknown) => setErro(mensagem(e)));
  }, [empresa]);
  const opcoes = useMemo(() => ({
    tabelas: [...new Set(regras.filter((r) => /^preco\.(?!avulso\.)/.test(r.codigo)).map((r) => r.codigo.split(".")[1]!))].sort(),
    chaves: [...new Set(regras.filter((r) => r.escopoTipo === "CLIENTE").map((r) => r.escopoChave))].sort()
  }), [regras]);

  const pedido = useRef(0);
  useEffect(() => {
    if (!servicos.length) return;
    const n = ++pedido.current;
    const t = setTimeout(() => {
      simular({ data, tabela, ...(cliente ? { cliente } : {}), regioes: regiao.split(",").map((r) => r.trim()).filter(Boolean) }, servicos.map((s) => ({ ...s, data })))
        .then((r) => { if (n === pedido.current) { setResultado(r); setErro(""); } })
        .catch((e: unknown) => { if (n === pedido.current) setErro(mensagem(e)); });
    }, 350);
    return () => clearTimeout(t);
  }, [data, tabela, cliente, regiao, servicos]);

  const r = servicos.length ? resultado : null;
  const travas = r ? impedimentos(r) : [];
  return <div className="space-y-5 p-3 sm:p-6 lg:p-8">
    <header><p className="text-xs uppercase tracking-widest text-primary">Motor de regras</p><h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Calculadora de evento</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Simule cardápio, quantidades, preço e travas com as regras vigentes na data. Para fechar, use “Novo evento” em Eventos — é o mesmo cálculo.</p></header>
    {erro && <p role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{erro}</p>}

    <section className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 lg:grid-cols-4">
      <Campo label="Data do evento"><input type="date" required className={campo} value={data} onChange={(e) => setData(e.target.value)} /></Campo>
      <Campo label="Tabela de preço"><select className={campo} value={tabela} onChange={(e) => setTabela(e.target.value)}>{(opcoes.tabelas.length ? opcoes.tabelas : ["EXTERNOS"]).map((t) => <option key={t}>{t}</option>)}</select></Campo>
      <Campo label="Regras de cliente"><select className={campo} value={cliente} onChange={(e) => setCliente(e.target.value)}><option value="">Nenhuma (externo)</option>{opcoes.chaves.map((c) => <option key={c}>{c}</option>)}</select></Campo>
      <Campo label="Bairro, cidade"><input className={campo} value={regiao} onChange={(e) => setRegiao(e.target.value)} placeholder="Alphaville, Barueri" /></Campo>
    </section>

    <ServicosEditor servicos={servicos} alterar={setServicos} sugestao={r} base={{ data, inicio: "09:00", fim: "10:00", pax: 50 }} dias={[data]} />

    {r && <div className="space-y-3">
      {!!travas.length && <Aviso tom="bloqueio" titulo="Bloqueios — o documento não pode ser gerado" itens={travas} />}
      {!!r.avisos.length && <Aviso tom="atencao" titulo="Atenção" itens={r.avisos} />}
      {!!r.regrasPendentes.length && <Aviso tom="info" titulo="Regras com decisão pendente" itens={r.regrasPendentes.map((p) => p.titulo)} />}
      {r.orcamento && <section className="rounded-xl border bg-card p-4"><h2 className="font-semibold">Orçamento (interno)</h2>
        <table className="mt-2 w-full text-sm"><tbody>{r.orcamento.linhas.map((l, i) => <tr key={i} className="border-b last:border-0"><td className="py-1.5">{l.descritivo}</td><td className="text-right text-xs text-muted-foreground">{l.pax ?? ""}</td><td className="text-right tabular-nums">{l.valorCentavos === null ? "—" : reais(l.valorCentavos)}</td></tr>)}</tbody></table>
        <p className="mt-2 flex justify-between border-t pt-2 font-semibold"><span>Total</span><span>{reais(r.orcamento.totalCentavos)}</span></p>
        {r.orcamento.cmv !== null && <p className="text-xs text-muted-foreground">CMV estimado {(r.orcamento.cmv * 100).toFixed(1)}% — nunca aparece para o cliente.</p>}
      </section>}
    </div>}
  </div>;
}
