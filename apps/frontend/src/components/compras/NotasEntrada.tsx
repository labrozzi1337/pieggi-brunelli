import { useState } from "react";
import { Camera, Check, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { campoOperacao } from "@/components/operacao/ProgramacaoEditor";
import { comandar, hojeSaoPaulo, mensagem, moeda, type Fornecedor, type Insumo } from "./comum";

interface Sugestao { id: string; nome: string; apelido: boolean; score: number; unidade: string; fator: number }
interface Item { chave: string; descricao: string; insumoId: string; quantidade: string; fator: string; valorTotal: string; lote: string; validade: string; sugestoes: Sugestao[] }
interface Nota { chave: string; fornecedorId: string; numero: string; emitidaEm: string; fotoPath: string | null; pedidoId: string; itens: Item[] }

const novoItem = (): Item => ({ chave: crypto.randomUUID(), descricao: "", insumoId: "", quantidade: "", fator: "1", valorTotal: "", lote: "", validade: "", sugestoes: [] });
const novaNota = (): Nota => ({ chave: crypto.randomUUID(), fornecedorId: "", numero: "", emitidaEm: hojeSaoPaulo(), fotoPath: null, pedidoId: "", itens: [novoItem()] });
const numero = (t: string) => Number(t.replace(",", "."));

/** Entrada por nota em lote: vários fornecedores de uma vez, sugere o insumo pelo nome da nota e aprende o apelido. */
export function NotasEntrada({ empresa, insumos, fornecedores, pedidos, aoLancar }: {
  empresa: string; insumos: Insumo[]; fornecedores: Fornecedor[]; pedidos: Array<{ id: string; fornecedor: string; semana: string; fornecedor_id: string }>; aoLancar: () => void;
}) {
  const [notas, setNotas] = useState<Nota[]>([novaNota()]);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const mudarNota = (n: string, campos: Partial<Nota>) => setNotas((ns) => ns.map((x) => x.chave === n ? { ...x, ...campos } : x));
  const mudarItem = (n: string, i: string, campos: Partial<Item>) => setNotas((ns) => ns.map((x) => x.chave === n ? { ...x, itens: x.itens.map((y) => y.chave === i ? { ...y, ...campos } : y) } : x));

  async function sugerir(nota: Nota, item: Item) {
    if (item.descricao.trim().length < 2) return;
    try {
      const s = await api<Sugestao[]>(`/api/v1/estoque?empresaId=${empresa}&sugerir=${encodeURIComponent(item.descricao)}${nota.fornecedorId ? `&fornecedorId=${nota.fornecedorId}` : ""}`);
      const melhor = s[0];
      // Apelido aprendido ou nome quase igual: já escolhe; senão só sugere.
      const auto = !item.insumoId && melhor && (melhor.apelido || melhor.score >= 0.85);
      mudarItem(nota.chave, item.chave, { sugestoes: s, ...(auto ? { insumoId: melhor.id, fator: String(melhor.fator) } : {}) });
    } catch { /* sugestão é opcional */ }
  }

  async function enviarFoto(nota: Nota, arquivo: File | undefined) {
    if (!arquivo) return;
    const form = new FormData();
    form.set("empresaId", empresa); form.set("arquivo", arquivo);
    try { mudarNota(nota.chave, { fotoPath: (await api<{ path: string }>("/api/v1/estoque/foto", { method: "POST", body: form })).path }); }
    catch (e) { setErro(mensagem(e, "Falha ao enviar a foto.")); }
  }

  async function lancar() {
    setOcupado(true); setErro(""); setAviso("");
    try {
      const r = await comandar<{ notas: string[]; custosAtualizados: number }>("estoque", empresa, "NOTAS_LANCAR", {
        notas: notas.map((n) => ({
          fornecedorId: n.fornecedorId, numero: n.numero.trim(), emitidaEm: n.emitidaEm, fotoPath: n.fotoPath, pedidoId: n.pedidoId || null,
          itens: n.itens.filter((i) => i.descricao.trim() || i.insumoId).map((i) => ({
            insumoId: i.insumoId, descricao: i.descricao.trim() || (insumos.find((x) => x.id === i.insumoId)?.nome ?? ""), quantidade: numero(i.quantidade), fator: numero(i.fator),
            valorTotal: numero(i.valorTotal), lote: i.lote.trim() || undefined, validade: i.validade || null
          }))
        }))
      });
      setAviso(`${r.notas.length} nota(s) lançada(s). Custo médio e CMV de ${r.custosAtualizados} item(ns) do cardápio atualizados.`);
      setNotas([novaNota()]); aoLancar();
    } catch (e) { setErro(mensagem(e, "Falha ao lançar as notas.")); }
    finally { setOcupado(false); }
  }

  return <div className="space-y-4">
    {notas.map((n, k) => {
      const total = n.itens.reduce((s, i) => s + (numero(i.valorTotal) || 0), 0);
      return <section key={n.chave} className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Nota {k + 1} · {moeda(total)}</h2>
          {notas.length > 1 && <Button variant="ghost" size="icon" aria-label="Remover nota" onClick={() => setNotas((ns) => ns.filter((x) => x.chave !== n.chave))}><Trash2 size={16} /></Button>}</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm lg:col-span-2">Fornecedor<select required className={campoOperacao} value={n.fornecedorId} onChange={(e) => mudarNota(n.chave, { fornecedorId: e.target.value, pedidoId: "" })}><option value="">Selecione</option>{fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>
          <label className="text-sm">Número<input className={campoOperacao} value={n.numero} maxLength={60} onChange={(e) => mudarNota(n.chave, { numero: e.target.value })} /></label>
          <label className="text-sm">Emissão<input type="date" className={campoOperacao} value={n.emitidaEm} onChange={(e) => mudarNota(n.chave, { emitidaEm: e.target.value })} /></label>
          <label className="text-sm">Pedido recebido<select className={campoOperacao} value={n.pedidoId} onChange={(e) => mudarNota(n.chave, { pedidoId: e.target.value })}><option value="">Nenhum</option>{pedidos.filter((p) => p.fornecedor_id === n.fornecedorId).map((p) => <option key={p.id} value={p.id}>Semana {p.semana.split("-").reverse().join("/")}</option>)}</select></label>
        </div>
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">{n.fotoPath ? <Check size={16} className="text-success" /> : <Camera size={16} />}{n.fotoPath ? "Foto anexada" : "Fotografar ou anexar a nota"}
          <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => { void enviarFoto(n, e.target.files?.[0]); }} /></label>
        {n.itens.map((i) => {
          const ins = insumos.find((x) => x.id === i.insumoId);
          return <div key={i.chave} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_1fr_auto]">
            <label className="text-sm">Descrição na nota<input className={campoOperacao} value={i.descricao} onChange={(e) => mudarItem(n.chave, i.chave, { descricao: e.target.value })} onBlur={() => { void sugerir(n, i); }} /></label>
            <div className="text-sm"><label>Insumo<select className={campoOperacao} value={i.insumoId} onChange={(e) => mudarItem(n.chave, i.chave, { insumoId: e.target.value, fator: String(insumos.find((x) => x.id === e.target.value)?.fator_compra ?? 1) })}>
              <option value="">Selecione</option>
              {!!i.sugestoes.length && <optgroup label="Sugestões">{i.sugestoes.map((s) => <option key={`s${s.id}`} value={s.id}>{s.nome}{s.apelido ? " ✓" : ` (${Math.round(s.score * 100)}%)`}</option>)}</optgroup>}
              <optgroup label="Todos">{insumos.filter((x) => x.ativo).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</optgroup>
            </select></label></div>
            <label className="text-sm">Qtd. comprada<input inputMode="decimal" className={campoOperacao} value={i.quantidade} onChange={(e) => mudarItem(n.chave, i.chave, { quantidade: e.target.value })} /></label>
            <label className="text-sm">× {ins?.unidade ?? "un. uso"}<input inputMode="decimal" className={campoOperacao} value={i.fator} title="Unidades de uso por unidade comprada" onChange={(e) => mudarItem(n.chave, i.chave, { fator: e.target.value })} /></label>
            <label className="text-sm">Valor total<input inputMode="decimal" className={campoOperacao} value={i.valorTotal} onChange={(e) => mudarItem(n.chave, i.chave, { valorTotal: e.target.value })} /></label>
            <label className="text-sm">Lote<input className={campoOperacao} value={i.lote} maxLength={60} onChange={(e) => mudarItem(n.chave, i.chave, { lote: e.target.value })} /></label>
            <label className="text-sm">Validade<input type="date" className={campoOperacao} value={i.validade} onChange={(e) => mudarItem(n.chave, i.chave, { validade: e.target.value })} /></label>
            <Button variant="ghost" size="icon" className="self-end" aria-label="Remover item" onClick={() => setNotas((ns) => ns.map((x) => x.chave === n.chave ? { ...x, itens: x.itens.filter((y) => y.chave !== i.chave) } : x))}><Trash2 size={16} /></Button>
          </div>;
        })}
        <Button variant="outline" onClick={() => mudarNota(n.chave, { itens: [...n.itens, novoItem()] })}><Plus size={16} />Item</Button>
      </section>;
    })}
    {erro && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{erro}</p>}
    {aviso && <p role="status" className="rounded-lg border border-success/40 p-3 text-sm text-success">{aviso}</p>}
    <div className="flex flex-wrap justify-between gap-2">
      <Button variant="outline" onClick={() => setNotas((ns) => [...ns, novaNota()])}><Plus size={16} />Outra nota</Button>
      <Button disabled={ocupado} onClick={() => { void lancar(); }}>Lançar {notas.length} nota(s) no estoque</Button>
    </div>
  </div>;
}
