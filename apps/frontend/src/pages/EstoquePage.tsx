import { useCallback, useEffect, useState } from "react";
import { useAoMudar } from "@/lib/aovivo";
import { AlertTriangle, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { campoOperacao } from "@/components/operacao/ProgramacaoEditor";
import { InventarioContagem } from "@/components/compras/InventarioContagem";
import { NotasEntrada } from "@/components/compras/NotasEntrada";
import { comandar, dataBr, mensagem, moeda, num, SETORES, type Fornecedor, type Insumo } from "@/components/compras/comum";

interface Painel {
  insumos: Insumo[]; fornecedores: Fornecedor[];
  lotes: Array<{ id: string; insumo_id: string; lote: string; validade: string | null; saldo: number }>;
  alertas: Array<{ tipo: string; mensagem: string; referenciaId: string }>;
  eventos: Array<{ id: string; titulo: string; data_evento: string | null }>;
  pedidos: Array<{ id: string; fornecedor: string; semana: string; fornecedor_id: string }>;
}
const ABAS = [["ESTOQUE", "Estoque por setor"], ["NOTAS", "Entrada de notas"], ["INVENTARIO", "Inventário"], ["DEVOLUCAO", "Devolução de evento"]] as const;
const TIPOS: Record<string, string> = { ESTOQUE_MINIMO: "Abaixo do mínimo", VALIDADE: "Validade", VARIACAO_PRECO: "Variação de preço", SEM_FICHA: "Cardápio sem ficha/custo", CMV: "CMV perto do teto" };

export function EstoquePage() {
  const { usuario } = useAuth();
  const empresa = usuario?.empresas[0];
  const papeis = usuario?.papeis ?? [];
  const escrita = papeis.includes("ADMIN") || papeis.includes("EXPEDICAO_COMPRAS");
  const inventario = escrita || papeis.includes("PRODUCAO");
  const comercial = papeis.includes("ADMIN") || papeis.includes("COMERCIAL");
  const [aba, setAba] = useState<(typeof ABAS)[number][0]>("ESTOQUE");
  const [painel, setPainel] = useState<Painel | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [devolucao, setDevolucao] = useState<{ eventoId: string; itens: Array<{ insumoId: string; quantidade: string }> }>({ eventoId: "", itens: [{ insumoId: "", quantidade: "" }] });

  const carregar = useCallback(async () => {
    if (!empresa) return;
    try { setPainel(await api<Painel>(`/api/v1/estoque?empresaId=${empresa}`)); setErro(""); }
    catch (e) { setErro(mensagem(e, "Não foi possível carregar o estoque.")); }
  }, [empresa]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);
  useAoMudar(carregar);

  async function devolver() {
    if (!empresa) return;
    setOcupado(true); setErro(""); setAviso("");
    try {
      await comandar("estoque", empresa, "DEVOLUCAO", { eventoId: devolucao.eventoId, itens: devolucao.itens.filter((i) => i.insumoId).map((i) => ({ insumoId: i.insumoId, quantidade: Number(i.quantidade.replace(",", ".")) })) });
      setAviso("Devolução registrada no estoque."); setDevolucao({ eventoId: "", itens: [{ insumoId: "", quantidade: "" }] }); await carregar();
    } catch (e) { setErro(mensagem(e, "Falha ao registrar a devolução.")); }
    finally { setOcupado(false); }
  }

  /** Comercial ajustou o preço do item: o custo atual vira a referência do aviso de CMV. */
  async function precoRevisado(itemId: string) {
    if (!empresa) return;
    setOcupado(true); setErro("");
    try { await comandar("compras", empresa, "CMV_REFERENCIA", { itemId }); await carregar(); }
    catch (e) { setErro(mensagem(e, "Falha ao registrar a revisão de preço.")); }
    finally { setOcupado(false); }
  }

  const insumos = painel?.insumos ?? [];
  return <div className="space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap justify-between gap-4">
      <div><p className="text-xs uppercase tracking-widest text-primary">Custo real do CMV</p><h1 className="mt-2 text-3xl font-semibold">Estoque</h1>
        <p className="mt-2 text-sm text-muted-foreground">Entrada por nota com custo médio ponderado, baixa automática na expedição e inventário por setor.</p></div>
      <Button variant="outline" onClick={() => { void carregar(); }}><RefreshCw size={16} />Atualizar</Button>
    </header>
    <nav className="flex flex-wrap gap-2">{ABAS.filter(([id]) => id === "ESTOQUE" || (id === "INVENTARIO" ? inventario : escrita)).map(([id, nome]) => <Button key={id} variant={aba === id ? "default" : "outline"} onClick={() => setAba(id)}>{nome}</Button>)}</nav>
    {erro && <p role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{erro}</p>}
    {aviso && <p role="status" className="rounded-lg border border-success/40 p-4 text-sm text-success">{aviso}</p>}

    {aba === "ESTOQUE" && painel && <div className="space-y-5">
      {!!painel.alertas.length && <section className="rounded-xl border border-warning/50 bg-warning/10 p-4"><h2 className="flex items-center gap-2 font-semibold"><AlertTriangle size={18} />Alertas ({painel.alertas.length})</h2>
        {Object.entries(TIPOS).map(([tipo, nome]) => {
          const lista = painel.alertas.filter((a) => a.tipo === tipo);
          return !!lista.length && <details key={tipo} open={tipo !== "SEM_FICHA"} className="mt-2 text-sm"><summary className="cursor-pointer font-medium">{nome} ({lista.length})</summary>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">{lista.map((a, i) => <li key={i}>{a.mensagem}
              {tipo === "CMV" && comercial && <Button variant="ghost" className="ml-2 h-7 px-2 text-xs" disabled={ocupado} onClick={() => { void precoRevisado(a.referenciaId); }}>Preço revisado</Button>}</li>)}</ul></details>;
        })}</section>}
      {Object.entries(SETORES).map(([setor, nome]) => {
        const lista = insumos.filter((i) => i.ativo && i.setor === setor);
        const valor = lista.reduce((s, i) => s + Math.max(0, i.saldo) * i.custo_medio, 0);
        return !!lista.length && <section key={setor} className="overflow-x-auto rounded-xl border bg-card p-4">
          <h2 className="font-semibold">{nome} <span className="text-sm font-normal text-muted-foreground">· {moeda(valor)}</span></h2>
          <table className="mt-2 w-full min-w-[520px] text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Insumo</th><th className="text-right">Saldo</th><th className="text-right">Mínimo</th><th className="text-right">Em pedido</th><th className="text-right">Custo médio</th><th>Lotes</th></tr></thead>
            <tbody>{lista.map((i) => <tr key={i.id} className={`border-t ${i.estoque_minimo > 0 && i.saldo < i.estoque_minimo ? "text-destructive" : ""}`}>
              <td className="py-1.5">{i.nome}</td><td className="text-right">{num(i.saldo)} {i.unidade}</td><td className="text-right">{num(i.estoque_minimo)}</td><td className="text-right">{num(i.em_pedido)}</td><td className="text-right">{moeda(i.custo_medio)}</td>
              <td className="pl-3 text-xs">{painel.lotes.filter((l) => l.insumo_id === i.id).map((l) => `${l.lote || "s/ lote"}: ${num(l.saldo)} até ${dataBr(l.validade)}`).join(" · ")}</td>
            </tr>)}</tbody></table>
        </section>;
      })}
      {!insumos.length && <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">Cadastre insumos em Compras → Insumos e fornecedores.</p>}
    </div>}

    {aba === "NOTAS" && empresa && painel && <NotasEntrada empresa={empresa} insumos={insumos} fornecedores={painel.fornecedores} pedidos={painel.pedidos} aoLancar={() => { void carregar(); }} />}
    {aba === "INVENTARIO" && empresa && painel && <InventarioContagem empresa={empresa} insumos={insumos} aoRegistrar={() => { void carregar(); }} />}

    {aba === "DEVOLUCAO" && painel && <section className="max-w-2xl space-y-3 rounded-xl border bg-card p-4">
      <h2 className="font-semibold">Sobra que voltou do evento</h2>
      <label className="block text-sm">Evento<select className={campoOperacao} value={devolucao.eventoId} onChange={(e) => setDevolucao((d) => ({ ...d, eventoId: e.target.value }))}><option value="">Selecione</option>{painel.eventos.map((e) => <option key={e.id} value={e.id}>{dataBr(e.data_evento)} · {e.titulo}</option>)}</select></label>
      {devolucao.itens.map((item, k) => <div key={k} className="grid grid-cols-[2fr_1fr_auto] gap-2">
        <select aria-label="Insumo" className={campoOperacao} value={item.insumoId} onChange={(e) => setDevolucao((d) => ({ ...d, itens: d.itens.map((x, j) => j === k ? { ...x, insumoId: e.target.value } : x) }))}><option value="">Insumo</option>{insumos.filter((i) => i.ativo).map((i) => <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>)}</select>
        <input aria-label="Quantidade" inputMode="decimal" placeholder="Qtd." className={campoOperacao} value={item.quantidade} onChange={(e) => setDevolucao((d) => ({ ...d, itens: d.itens.map((x, j) => j === k ? { ...x, quantidade: e.target.value } : x) }))} />
        <Button variant="ghost" size="icon" aria-label="Remover" onClick={() => setDevolucao((d) => ({ ...d, itens: d.itens.filter((_, j) => j !== k) }))}><Trash2 size={16} /></Button>
      </div>)}
      <div className="flex justify-between gap-2"><Button variant="outline" onClick={() => setDevolucao((d) => ({ ...d, itens: [...d.itens, { insumoId: "", quantidade: "" }] }))}><Plus size={16} />Item</Button>
        <Button disabled={ocupado || !devolucao.eventoId} onClick={() => { void devolver(); }}>Registrar devolução</Button></div>
    </section>}
  </div>;
}
