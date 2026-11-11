import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Search, Star } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { campoOperacao } from "@/components/operacao/ProgramacaoEditor";
import { comandar, dataBr, mensagem, moeda, num, SETORES, UNIDADES, type Fornecedor, type Insumo } from "./comum";

interface Oferta {
  id: string; fornecedorId: string; fornecedor: string; preco: number; quantidadeEmbalagem: number; embalagem?: string; prazoDias: number; pedidoMinimo: number;
  preferido?: boolean; precoBase: number | null; base: string | null; precoAVista: number | null; atendeMinimo: boolean; posicao: number;
}
interface LinhaCotacao { insumoId: string; nome: string; setor: string; unidade: string; base: string | null; ofertas: Oferta[]; historico: Array<{ fornecedor: string; preco: number; origem: string; em: string }> }

/** Cotação comparativa: mesmo insumo entre fornecedores na unidade padronizada, com prazo e pedido mínimo ao lado. */
export function CotacaoTabela({ empresa, insumos, fornecedores, podeEditar }: { empresa: string; insumos: Insumo[]; fornecedores: Fornecedor[]; podeEditar: boolean }) {
  const [linhas, setLinhas] = useState<LinhaCotacao[]>([]);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const carregar = useCallback(async () => {
    try { setLinhas(await api<LinhaCotacao[]>(`/api/v1/compras?empresaId=${empresa}&visao=cotacao`)); setErro(""); }
    catch (e) { setErro(mensagem(e, "Não foi possível carregar a cotação.")); }
  }, [empresa]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const v = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setOcupado(true);
    try {
      await comandar("compras", empresa, "COTACAO_SALVAR", {
        insumoId: v.insumoId, fornecedorId: v.fornecedorId, embalagem: v.embalagem ?? "", quantidadeEmbalagem: Number(v.quantidadeEmbalagem), unidadeEmbalagem: v.unidadeEmbalagem,
        preco: Number(v.preco), preferido: v.preferido === "on"
      });
      form.reset(); await carregar();
    } catch (e) { setErro(mensagem(e, "Falha ao salvar a cotação.")); }
    finally { setOcupado(false); }
  }

  const filtradas = linhas.filter((l) => `${l.nome} ${SETORES[l.setor] ?? ""} ${l.ofertas.map((o) => o.fornecedor).join(" ")}`.toLowerCase().includes(busca.toLowerCase()));
  return <div className="space-y-5">
    {podeEditar && <form onSubmit={(e) => { void salvar(e); }} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      <h2 className="font-semibold sm:col-span-2 lg:col-span-4">Registrar preço de fornecedor</h2>
      <label className="text-sm">Insumo<select name="insumoId" required className={campoOperacao} defaultValue=""><option value="" disabled>Selecione</option>{insumos.filter((i) => i.ativo).map((i) => <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>)}</select></label>
      <label className="text-sm">Fornecedor<select name="fornecedorId" required className={campoOperacao} defaultValue=""><option value="" disabled>Selecione</option>{fornecedores.filter((f) => f.ativo !== false).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>
      <label className="text-sm">Embalagem<input name="embalagem" maxLength={100} placeholder="Caixa 10 kg" className={campoOperacao} /></label>
      <div className="flex gap-2"><label className="flex-1 text-sm">Conteúdo<input name="quantidadeEmbalagem" required type="number" min="0.001" step="any" className={campoOperacao} /></label>
        <label className="w-24 text-sm">Unid.<select name="unidadeEmbalagem" className={campoOperacao}>{UNIDADES.map((u) => <option key={u}>{u}</option>)}</select></label></div>
      <label className="text-sm">Preço da embalagem (R$)<input name="preco" required type="number" min="0" step="0.01" className={campoOperacao} /></label>
      <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="preferido" />Fornecedor preferido deste insumo</label>
      <Button type="submit" disabled={ocupado} className="self-end">Salvar preço</Button>
    </form>}
    {erro && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{erro}</p>}
    <label className="relative block"><Search size={16} className="absolute left-3 top-3 text-muted-foreground" /><input aria-label="Buscar insumo ou fornecedor" placeholder="Buscar insumo ou fornecedor" className={`${campoOperacao} pl-9`} value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
    {filtradas.map((l) => <section key={l.insumoId} className="overflow-x-auto rounded-xl border bg-card p-4">
      <h3 className="font-semibold">{l.nome} <span className="text-xs font-normal text-muted-foreground">· {SETORES[l.setor] ?? l.setor}</span></h3>
      {!l.ofertas.length ? <p className="mt-2 text-sm text-muted-foreground">Sem preço de fornecedor.</p> : <table className="mt-3 w-full min-w-[640px] text-sm">
        <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">#</th><th>Fornecedor</th><th>Embalagem</th><th className="text-right">Preço</th><th className="text-right">Por {l.base?.toLowerCase() ?? "un"}</th><th className="text-right">Equiv. à vista</th><th className="text-right">Prazo</th><th className="text-right">Pedido mín.</th></tr></thead>
        <tbody>{l.ofertas.map((o) => <tr key={o.id} className={`border-t ${o.posicao === 1 ? "font-semibold" : ""}`}>
          <td className="py-1.5">{o.posicao}</td>
          <td>{o.preferido && <Star size={14} className="mr-1 inline text-primary" aria-label="Preferido" />}{o.fornecedor}</td>
          <td>{o.embalagem || "—"} <span className="text-xs text-muted-foreground">({num(o.quantidadeEmbalagem)} {l.unidade})</span></td>
          <td className="text-right">{moeda(o.preco)}</td><td className="text-right">{moeda(o.precoBase)}</td><td className="text-right">{moeda(o.precoAVista)}</td>
          <td className="text-right">{o.prazoDias ? `${o.prazoDias} dias` : "à vista"}</td><td className={`text-right ${o.atendeMinimo ? "" : "text-destructive"}`}>{moeda(o.pedidoMinimo)}</td>
        </tr>)}</tbody></table>}
      {!!l.historico.length && <details className="mt-2 text-sm"><summary className="cursor-pointer text-muted-foreground">Histórico de preço ({l.historico.length})</summary>
        <ul className="mt-2 space-y-1">{l.historico.map((h, i) => <li key={i}>{dataBr(h.em)} · {h.fornecedor} · {moeda(h.preco)}/{l.unidade.toLowerCase()} · {h.origem === "NOTA" ? "compra" : "cotação"}</li>)}</ul></details>}
    </section>)}
    {!filtradas.length && <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Nenhum insumo cadastrado nesta busca.</p>}
  </div>;
}
