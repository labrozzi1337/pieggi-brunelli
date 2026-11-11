import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAoMudar } from "@/lib/aovivo";
import { Link } from "react-router-dom";
import { AlertTriangle, FileDown, FileSpreadsheet, Pencil, RefreshCw, ShoppingCart } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { api, baixarArquivo } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { campoOperacao } from "@/components/operacao/ProgramacaoEditor";
import { CotacaoTabela } from "@/components/compras/CotacaoTabela";
import { FichaTecnicaEditor } from "@/components/compras/FichaTecnicaEditor";
import { comandar, dataBr, hojeSaoPaulo, mensagem, moeda, num, semanaDe, SETORES, UNIDADES, type Fornecedor, type Insumo } from "@/components/compras/comum";

interface LinhaPedido { insumoId: string | null; descricao: string; unidade: string; necessidade: number; estoque: number; emPedido: number; quantidade: number; embalagens: number | null; embalagem: string; precoEstimado: number | null; eventos: string[] }
interface GrupoFornecedor { fornecedorId: string | null; fornecedor: string; prazoPagamentoDias: number | null; pedidoMinimo: number; total: number; atendeMinimo: boolean; linhas: LinhaPedido[] }
interface Pedido { id: string; fornecedor: string; semana: string; status: string; itens: number; total: number | null }
interface Semana {
  semana: string; fornecedores: GrupoFornecedor[]; pedidos: Pedido[];
  pendencias: Array<{ id: string; eventoId: string; evento: string; versao: number; item: string; pendencia: string }>;
  canceladasEmPedido: Array<{ evento: string; item_nome: string; fornecedor: string; pedido_id: string }>;
}
interface Cadastros { fornecedores: Fornecedor[]; insumos: Insumo[]; rendimentos: Record<string, number> }

const ABAS = [["SEMANA", "Compras da semana"], ["COTACAO", "Cotação"], ["FICHAS", "Fichas técnicas"], ["CADASTROS", "Insumos e fornecedores"]] as const;
const STATUS: Record<string, string> = { ABERTO: "Aberto", ENVIADO: "Enviado", RECEBIDO: "Recebido", CANCELADO: "Cancelado" };

export function ComprasPage() {
  const { usuario } = useAuth();
  const empresa = usuario?.empresas[0];
  const papeis = usuario?.papeis ?? [];
  const compras = papeis.includes("ADMIN") || papeis.includes("EXPEDICAO_COMPRAS");
  const fichas = compras || papeis.includes("PRODUCAO");
  const [aba, setAba] = useState<(typeof ABAS)[number][0]>("SEMANA");
  const [[inicio, fim], setPeriodo] = useState(() => semanaDe(hojeSaoPaulo()));
  const [semana, setSemana] = useState<Semana | null>(null);
  const [cadastros, setCadastros] = useState<Cadastros | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [editInsumo, setEditInsumo] = useState<Insumo | null>(null);
  const [editFornecedor, setEditFornecedor] = useState<Fornecedor | null>(null);

  const carregar = useCallback(async () => {
    if (!empresa) return;
    try {
      const [s, c] = await Promise.all([
        api<Semana>(`/api/v1/compras?empresaId=${empresa}&visao=semana&inicio=${inicio}&fim=${fim}`),
        api<Cadastros>(`/api/v1/compras?empresaId=${empresa}&visao=cadastros`)
      ]);
      setSemana(s); setCadastros(c); setErro("");
    } catch (e) { setErro(mensagem(e, "Não foi possível carregar compras.")); }
  }, [empresa, inicio, fim]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);
  useAoMudar(carregar);

  async function agir(acao: string, dados: unknown, sucesso?: (r: never) => string) {
    if (!empresa) return false;
    setOcupado(true); setErro(""); setAviso("");
    try { const r = await comandar<never>("compras", empresa, acao, dados); if (sucesso) setAviso(sucesso(r)); await carregar(); return true; }
    catch (e) { setErro(mensagem(e, "Operação não concluída.")); return false; }
    finally { setOcupado(false); }
  }

  async function salvarInsumo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const v = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const ok = await agir("INSUMO_SALVAR", {
      ...(editInsumo ? { id: editInsumo.id } : {}), nome: v.nome, marca: v.marca ?? "", setor: v.setor, unidade: v.unidade, unidadeCompra: v.unidadeCompra ?? "",
      fatorCompra: Number(v.fatorCompra), estoqueMinimo: Number(v.estoqueMinimo || 0), perecivel: v.perecivel === "on", rendimentoChave: v.rendimentoChave || null, ativo: editInsumo ? v.ativo === "on" : true
    });
    if (ok) { form.reset(); setEditInsumo(null); }
  }
  async function salvarFornecedor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const v = Object.fromEntries(fd) as Record<string, string>;
    const ok = await agir("FORNECEDOR_SALVAR", {
      ...(editFornecedor ? { id: editFornecedor.id } : {}), nome: v.nome, contato: v.contato ?? "", codigo: v.codigo?.trim() || null, categorias: fd.getAll("categorias"),
      prazoPagamentoDias: Number(v.prazo || 0), pedidoMinimo: Number(v.minimo || 0), ativo: v.ativo === "on"
    });
    if (ok) { form.reset(); setEditFornecedor(null); }
  }
  const exportar = (p: Pedido, formato: "pdf" | "xlsx") => baixarArquivo(`/api/v1/compras/pedidos/${p.id}?empresaId=${empresa}&formato=${formato}`, `pedido.${formato}`).catch((e: unknown) => setErro(mensagem(e, "Falha ao exportar.")));

  const aComprar = semana?.fornecedores.filter((f) => f.fornecedorId && f.linhas.some((l) => l.quantidade > 0)).length ?? 0;
  return <div className="space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap justify-between gap-4">
      <div><p className="text-xs uppercase tracking-widest text-primary">Da comanda ao fornecedor</p><h1 className="mt-2 text-3xl font-semibold">Compras</h1>
        <p className="mt-2 text-sm text-muted-foreground">Necessidade corrigida pelo rendimento, menos estoque e pedidos em aberto — um pedido por fornecedor na semana.</p></div>
      <Button variant="outline" disabled={ocupado} onClick={() => { void carregar(); }}><RefreshCw size={16} />Atualizar</Button>
    </header>
    <nav className="flex flex-wrap gap-2">{ABAS.map(([id, nome]) => <Button key={id} variant={aba === id ? "default" : "outline"} onClick={() => setAba(id)}>{nome}</Button>)}</nav>
    {erro && <p role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{erro}</p>}
    {aviso && <p role="status" className="rounded-lg border border-success/40 p-4 text-sm text-success">{aviso}</p>}

    {aba === "SEMANA" && <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <label className="text-sm">Semana de<input type="date" className={campoOperacao} value={inicio} onChange={(e) => e.target.value && setPeriodo(semanaDe(e.target.value))} /></label>
        <p className="pb-3 text-sm text-muted-foreground">{dataBr(inicio)} a {dataBr(fim)}</p>
        {compras && <div className="ml-auto flex flex-wrap gap-2">
          {!!semana?.pendencias.length && <Button variant="outline" disabled={ocupado} onClick={() => { void agir("PENDENCIAS_REPROCESSAR", { inicio, fim }, (r: { reprocessados: number; restantes: number }) => `${r.reprocessados - r.restantes} pendência(s) resolvida(s).`); }}>Reprocessar pendências</Button>}
          <Button disabled={ocupado || !aComprar} onClick={() => { void agir("PEDIDOS_GERAR", { inicio, fim }, (r: { pedidos: string[]; semFornecedor: string[] }) => `${r.pedidos.length} pedido(s) gerado(s).${r.semFornecedor.length ? ` Sem fornecedor cotado: ${r.semFornecedor.join(", ")}.` : ""}`); }}><ShoppingCart size={16} />Gerar pedidos da semana ({aComprar})</Button>
        </div>}
      </div>
      {!!semana?.canceladasEmPedido.length && <section className="rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm"><h2 className="flex items-center gap-2 font-semibold"><AlertTriangle size={18} />Pedidos com itens de programação substituída</h2>
        <p className="mt-1">Confira reaproveitamento ou cancelamento com o fornecedor.</p>{semana.canceladasEmPedido.map((c, i) => <p key={i} className="mt-1">{c.evento} · {c.item_nome} · {c.fornecedor}</p>)}</section>}
      {!!semana?.pendencias.length && <details className="rounded-xl border border-warning/40 bg-card p-4"><summary className="cursor-pointer font-semibold">Itens sem como comprar ({semana.pendencias.length})</summary>
        <ul className="mt-3 space-y-2 text-sm">{semana.pendencias.map((p) => <li key={p.id}><strong>{p.item}</strong> · {p.evento} v{p.versao} — {p.pendencia} <Link className="text-primary underline" to={`/operacao?evento=${p.eventoId}&aba=programacao`}>programação</Link></li>)}</ul>
        <p className="mt-3 text-xs text-muted-foreground">Cadastre a ficha técnica em “Fichas técnicas” e use “Reprocessar pendências”.</p></details>}
      <div className="grid gap-4 xl:grid-cols-2">{semana?.fornecedores.map((f) => <article key={f.fornecedorId ?? "sem"} className={`overflow-x-auto rounded-xl border bg-card p-4 ${f.fornecedorId ? "" : "border-destructive/40"}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-semibold">{f.fornecedor}</h2>
          <p className="text-sm">{moeda(f.total)}{f.prazoPagamentoDias !== null && ` · ${f.prazoPagamentoDias ? `${f.prazoPagamentoDias} dias` : "à vista"}`}{f.pedidoMinimo > 0 && <span className={f.atendeMinimo ? "" : " text-destructive"}> · mínimo {moeda(f.pedidoMinimo)}</span>}</p></div>
        {!f.fornecedorId && <p className="text-sm text-destructive">Cadastre um preço de fornecedor na Cotação para estes insumos.</p>}
        <table className="mt-3 w-full min-w-[560px] text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Item</th><th className="text-right">Precisa</th><th className="text-right">Estoque</th><th className="text-right">Em pedido</th><th className="text-right">Comprar</th><th className="text-right">Embalagens</th></tr></thead>
          <tbody>{f.linhas.map((l, i) => <tr key={i} className={`border-t ${l.quantidade > 0 ? "" : "text-muted-foreground"}`} title={l.eventos.join(" · ")}>
            <td className="py-1.5">{l.descricao}<span className="block text-xs text-muted-foreground">{l.eventos.join(" · ")}</span></td>
            <td className="text-right">{num(l.necessidade)} {l.unidade}</td><td className="text-right">{l.insumoId ? num(l.estoque) : "—"}</td><td className="text-right">{l.insumoId ? num(l.emPedido) : "—"}</td>
            <td className="text-right font-semibold">{num(l.quantidade)} {l.unidade}</td><td className="text-right">{l.embalagens === null ? "—" : `${l.embalagens} ${l.embalagem}`}</td>
          </tr>)}</tbody></table>
      </article>)}</div>
      {semana && !semana.fornecedores.length && <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">Nenhuma programação aprovada com saída nesta semana.</p>}
      {!!semana?.pedidos.length && <section className="rounded-xl border bg-card p-4"><h2 className="font-semibold">Pedidos da semana</h2>
        <ul className="mt-3 divide-y">{semana.pedidos.map((p) => <li key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
          <span className="min-w-40 flex-1 font-medium">{p.fornecedor}</span><span>{p.itens} item(ns) · {moeda(p.total)}</span><span className="rounded-full border px-2 py-0.5 text-xs">{STATUS[p.status] ?? p.status}</span>
          <Button variant="ghost" size="icon" aria-label="Baixar PDF" onClick={() => { void exportar(p, "pdf"); }}><FileDown size={16} /></Button>
          <Button variant="ghost" size="icon" aria-label="Baixar planilha" onClick={() => { void exportar(p, "xlsx"); }}><FileSpreadsheet size={16} /></Button>
          {compras && p.status === "ABERTO" && <Button variant="outline" disabled={ocupado} onClick={() => { void agir("PEDIDO_STATUS", { id: p.id, status: "ENVIADO" }); }}>Marcar enviado</Button>}
          {compras && ["ABERTO", "ENVIADO"].includes(p.status) && <Button variant="ghost" disabled={ocupado} onClick={() => { if (window.confirm("Cancelar este pedido? Os itens voltam para a lista da semana.")) void agir("PEDIDO_STATUS", { id: p.id, status: "CANCELADO" }); }}>Cancelar</Button>}
        </li>)}</ul><p className="mt-2 text-xs text-muted-foreground">O recebimento é registrado em Estoque → Entrada de notas, vinculando o pedido.</p></section>}
    </div>}

    {aba === "COTACAO" && empresa && cadastros && <CotacaoTabela empresa={empresa} insumos={cadastros.insumos} fornecedores={cadastros.fornecedores} podeEditar={compras} />}
    {aba === "FICHAS" && empresa && <FichaTecnicaEditor empresa={empresa} podeEditar={fichas} />}

    {aba === "CADASTROS" && cadastros && <div className="grid gap-5 xl:grid-cols-2">
      <section className="space-y-4">
        {compras && <form key={editInsumo?.id ?? "novo"} onSubmit={(e) => { void salvarInsumo(e); }} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">{editInsumo ? `Editar ${editInsumo.nome}` : "Novo insumo"}</h2>
          <label className="text-sm">Nome<input name="nome" required minLength={2} maxLength={200} defaultValue={editInsumo?.nome} className={campoOperacao} /></label>
          <label className="text-sm">Marca<input name="marca" maxLength={100} defaultValue={editInsumo?.marca} className={campoOperacao} /></label>
          <label className="text-sm">Setor<select name="setor" defaultValue={editInsumo?.setor ?? "MERCEARIA"} className={campoOperacao}>{Object.entries(SETORES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-sm">Unidade de uso (estoque e custo)<select name="unidade" defaultValue={editInsumo?.unidade ?? "KG"} className={campoOperacao}>{UNIDADES.map((u) => <option key={u}>{u}</option>)}</select></label>
          <label className="text-sm">Unidade de compra<input name="unidadeCompra" maxLength={100} placeholder="caixa 10 kg" defaultValue={editInsumo?.unidade_compra} className={campoOperacao} /></label>
          <label className="text-sm">Fator (unid. de uso por unid. de compra)<input name="fatorCompra" required type="number" min="0.000001" step="any" defaultValue={editInsumo?.fator_compra ?? 1} className={campoOperacao} /></label>
          <label className="text-sm">Estoque mínimo<input name="estoqueMinimo" type="number" min="0" step="any" defaultValue={editInsumo?.estoque_minimo ?? 0} className={campoOperacao} /></label>
          <label className="text-sm">Rendimento oficial<select name="rendimentoChave" defaultValue={editInsumo?.rendimento_chave ?? ""} className={campoOperacao}><option value="">Sem correção (1:1)</option>{Object.entries(cadastros.rendimentos).map(([k, v]) => <option key={k} value={k}>{k} ({String(v).replace(".", ",")})</option>)}</select></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="perecivel" defaultChecked={editInsumo?.perecivel} />Perecível (controla validade e lote)</label>
          {editInsumo && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ativo" defaultChecked={editInsumo.ativo} />Ativo</label>}
          <div className="flex gap-2 sm:col-span-2">{editInsumo && <Button variant="outline" onClick={() => setEditInsumo(null)}>Cancelar</Button>}<Button type="submit" disabled={ocupado}>Salvar insumo</Button></div>
        </form>}
        {Object.entries(SETORES).map(([setor, nome]) => {
          const lista = cadastros.insumos.filter((i) => i.setor === setor);
          return !!lista.length && <details key={setor} open className="rounded-xl border bg-card p-4"><summary className="cursor-pointer font-semibold">{nome} ({lista.length})</summary>
            <ul className="mt-2 divide-y text-sm">{lista.map((i) => <li key={i.id} className={`flex items-center gap-2 py-2 ${i.ativo ? "" : "opacity-50"}`}>
              <span className="flex-1">{i.nome}{i.marca && ` · ${i.marca}`}<span className="block text-xs text-muted-foreground">{i.unidade} · compra {i.unidade_compra || "—"} (×{num(i.fator_compra)}) · mín. {num(i.estoque_minimo)}{i.rendimento_chave ? ` · rendimento ${i.rendimento_chave}` : ""}</span></span>
              {compras && <Button variant="ghost" size="icon" aria-label={`Editar ${i.nome}`} onClick={() => setEditInsumo(i)}><Pencil size={16} /></Button>}
            </li>)}</ul></details>;
        })}
      </section>
      <section className="space-y-4">
        {compras && <form key={editFornecedor?.id ?? "novo"} onSubmit={(e) => { void salvarFornecedor(e); }} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">{editFornecedor ? `Editar ${editFornecedor.nome}` : "Novo fornecedor"}</h2>
          <label className="text-sm">Nome<input name="nome" required minLength={2} maxLength={200} defaultValue={editFornecedor?.nome} className={campoOperacao} /></label>
          <label className="text-sm">Contato<input name="contato" maxLength={300} defaultValue={editFornecedor?.contato} className={campoOperacao} /></label>
          <label className="text-sm">Código de roteamento<input name="codigo" maxLength={40} placeholder="PAD_LETICIA" defaultValue={editFornecedor?.codigo ?? ""} className={campoOperacao} /></label>
          <label className="text-sm">Prazo de pagamento (dias)<input name="prazo" type="number" min="0" max="365" defaultValue={editFornecedor?.prazo_pagamento_dias ?? 0} className={campoOperacao} /></label>
          <label className="text-sm">Pedido mínimo (R$)<input name="minimo" type="number" min="0" step="0.01" defaultValue={editFornecedor?.pedido_minimo ?? 0} className={campoOperacao} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ativo" defaultChecked={editFornecedor?.ativo ?? true} />Ativo</label>
          <fieldset className="flex flex-wrap gap-3 text-sm sm:col-span-2"><legend className="mb-1">Categorias</legend>{Object.entries(SETORES).map(([k, v]) => <label key={k} className="flex items-center gap-1"><input type="checkbox" name="categorias" value={k} defaultChecked={editFornecedor?.categorias?.includes(k)} />{v}</label>)}</fieldset>
          <div className="flex gap-2 sm:col-span-2">{editFornecedor && <Button variant="outline" onClick={() => setEditFornecedor(null)}>Cancelar</Button>}<Button type="submit" disabled={ocupado}>Salvar fornecedor</Button></div>
        </form>}
        <ul className="divide-y rounded-xl border bg-card text-sm">{cadastros.fornecedores.map((f) => <li key={f.id} className={`flex items-center gap-2 p-3 ${f.ativo ? "" : "opacity-50"}`}>
          <span className="flex-1"><strong>{f.nome}</strong>{f.codigo && <span className="text-xs text-muted-foreground"> · {f.codigo}</span>}
            <span className="block text-xs text-muted-foreground">{(f.categorias ?? []).map((c) => SETORES[c] ?? c).join(", ") || "Sem categoria"} · {f.prazo_pagamento_dias ? `${f.prazo_pagamento_dias} dias` : "à vista"} · mínimo {moeda(f.pedido_minimo ?? 0)}</span></span>
          {compras && <Button variant="ghost" size="icon" aria-label={`Editar ${f.nome}`} onClick={() => setEditFornecedor(f)}><Pencil size={16} /></Button>}
        </li>)}</ul>
      </section>
    </div>}
  </div>;
}
