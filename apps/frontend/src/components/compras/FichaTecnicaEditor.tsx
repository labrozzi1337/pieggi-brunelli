import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Plus, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { campoOperacao } from "@/components/operacao/ProgramacaoEditor";
import { comandar, mensagem, moeda } from "./comum";

interface LinhaFicha { insumo_id: string; unidade_item: string; quantidade: number; rendimento: number | null }
interface ItemFicha { id: string; nome: string; grupo: string; unidade: string; fornecedor: string | null; custo: number | null; pendencia: string | null; linhas: LinhaFicha[] }
interface InsumoFicha { id: string; nome: string; unidade: string; rendimentoChave: string | null }
const UNIDADES_ITEM = ["UN", "KG", "G", "L", "ML", "GARRAFA", "TRAVESSA", "PACOTE"];

/** Ficha técnica por item do cardápio: quanto de cada insumo (peso pronto) vai em 1 unidade do item. */
export function FichaTecnicaEditor({ empresa, podeEditar }: { empresa: string; podeEditar: boolean }) {
  const [itens, setItens] = useState<ItemFicha[]>([]);
  const [insumos, setInsumos] = useState<InsumoFicha[]>([]);
  const [busca, setBusca] = useState("");
  const [soPendentes, setSoPendentes] = useState(true);
  const [selecionado, setSelecionado] = useState<ItemFicha | null>(null);
  const [unidade, setUnidade] = useState("KG");
  const [linhas, setLinhas] = useState<Array<{ insumoId: string; quantidade: string; rendimento: string }>>([]);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const d = await api<{ itens: ItemFicha[]; insumos: InsumoFicha[] }>(`/api/v1/compras?empresaId=${empresa}&visao=fichas`);
      setItens(d.itens); setInsumos(d.insumos); setErro("");
    } catch (e) { setErro(mensagem(e, "Não foi possível carregar as fichas técnicas.")); }
  }, [empresa]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  function abrir(item: ItemFicha) {
    setSelecionado(item);
    setUnidade(item.linhas[0]?.unidade_item ?? "KG");
    setLinhas(item.linhas.map((l) => ({ insumoId: l.insumo_id, quantidade: String(l.quantidade), rendimento: l.rendimento === null ? "" : String(l.rendimento) })));
  }

  async function salvar() {
    if (!selecionado) return;
    setOcupado(true);
    try {
      await comandar("compras", empresa, "FICHA_SALVAR", {
        itemId: selecionado.id,
        linhas: linhas.filter((l) => l.insumoId).map((l) => ({ insumoId: l.insumoId, unidadeItem: unidade, quantidade: Number(l.quantidade.replace(",", ".")), rendimento: l.rendimento ? Number(l.rendimento.replace(",", ".")) : null }))
      });
      setSelecionado(null); await carregar();
    } catch (e) { setErro(mensagem(e, "Falha ao salvar a ficha técnica.")); }
    finally { setOcupado(false); }
  }

  const mudar = (i: number, campo: "insumoId" | "quantidade" | "rendimento", valor: string) => setLinhas((ls) => ls.map((l, k) => k === i ? { ...l, [campo]: valor } : l));
  const visiveis = itens.filter((i) => (!soPendentes || i.pendencia) && `${i.nome} ${i.grupo}`.toLowerCase().includes(busca.toLowerCase()));
  const pendentes = itens.filter((i) => i.pendencia).length;
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
    <section className="space-y-3">
      {erro && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{erro}</p>}
      <p className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"><AlertTriangle size={16} />{pendentes} item(ns) sem ficha técnica ou sem custo — a proposta não fecha com eles.</p>
      <label className="relative block"><Search size={16} className="absolute left-3 top-3 text-muted-foreground" /><input aria-label="Buscar item do cardápio" placeholder="Buscar item do cardápio" className={`${campoOperacao} pl-9`} value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} />Só pendentes</label>
      <ul className="max-h-[60vh] divide-y overflow-y-auto rounded-xl border bg-card">{visiveis.map((i) => <li key={i.id}>
        <button type="button" onClick={() => abrir(i)} className={`w-full p-3 text-left text-sm hover:bg-accent ${selecionado?.id === i.id ? "bg-accent" : ""}`}>
          <span className="font-medium">{i.nome}</span><span className="block text-xs text-muted-foreground">{i.grupo} · {i.linhas.length} insumo(s){i.custo !== null ? ` · ${moeda(i.custo)}` : ""}</span>
          {i.pendencia && <span className="block text-xs text-destructive">{i.pendencia}</span>}
        </button></li>)}</ul>
    </section>
    {selecionado ? <section className="space-y-4 rounded-xl border bg-card p-4">
      <div><h2 className="text-lg font-semibold">{selecionado.nome}</h2><p className="text-xs text-muted-foreground">Unidade de venda no cardápio: {selecionado.unidade}{selecionado.fornecedor ? ` · comprado pronto de ${selecionado.fornecedor}` : ""}</p></div>
      <label className="block text-sm">A ficha vale para 1<select className={campoOperacao} value={unidade} onChange={(e) => setUnidade(e.target.value)} disabled={!podeEditar}>{UNIDADES_ITEM.map((u) => <option key={u}>{u}</option>)}</select></label>
      <p className="text-xs text-muted-foreground">Quantidade = peso pronto do insumo em 1 {unidade} do item. Rendimento vazio usa a regra oficial do insumo (ex.: frango 0,80; arroz 3).</p>
      {linhas.map((l, i) => {
        const ins = insumos.find((x) => x.id === l.insumoId);
        return <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <label className="text-sm">Insumo<select className={campoOperacao} value={l.insumoId} disabled={!podeEditar} onChange={(e) => mudar(i, "insumoId", e.target.value)}><option value="">Selecione</option>{insumos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
          <label className="text-sm">Quantidade ({ins?.unidade ?? "—"})<input inputMode="decimal" className={campoOperacao} value={l.quantidade} disabled={!podeEditar} onChange={(e) => mudar(i, "quantidade", e.target.value)} /></label>
          <label className="text-sm">Rendimento<input inputMode="decimal" className={campoOperacao} placeholder={ins?.rendimentoChave ?? "1"} value={l.rendimento} disabled={!podeEditar} onChange={(e) => mudar(i, "rendimento", e.target.value)} /></label>
          {podeEditar && <Button variant="ghost" size="icon" className="self-end" aria-label="Remover insumo" onClick={() => setLinhas((ls) => ls.filter((_, k) => k !== i))}><Trash2 size={16} /></Button>}
        </div>;
      })}
      {podeEditar && <div className="flex flex-wrap justify-between gap-2">
        <Button variant="outline" onClick={() => setLinhas((ls) => [...ls, { insumoId: "", quantidade: "", rendimento: "" }])}><Plus size={16} />Adicionar insumo</Button>
        <div className="flex gap-2"><Button variant="outline" onClick={() => setSelecionado(null)}>Cancelar</Button><Button disabled={ocupado} onClick={() => { void salvar(); }}>Salvar ficha</Button></div>
      </div>}
    </section> : <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">Escolha um item do cardápio para editar a ficha técnica.</p>}
  </div>;
}
