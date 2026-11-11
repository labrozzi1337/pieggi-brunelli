import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAoMudar } from "@/lib/aovivo";
import { AlertTriangle, History, Pencil, RefreshCw, Search } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { api } from "@/lib/api";
import { moeda } from "@/lib/operacao";
import { campoTexto, formatarValor, hojeSaoPaulo, PERCENTUAL, type RegraApi } from "@/lib/regras";
import { Button } from "@/components/ui/Button";
import { campoOperacao } from "@/components/operacao/ProgramacaoEditor";

interface ClienteRegra { id: string; nome: string; chaveRegras: string | null }
interface ItemCardapio {
  id: string; grupo: string; categoria: string; tier: string; nome: string; ingredientes: string; unidade: string;
  nomeEn: string | null; nomeEs: string | null; selo: string | null; estacao: string | null; fornecedor: string | null; ativo: boolean; custo: number | null;
}
interface Grupo { chave: string; versoes: RegraApi[]; vigente?: RegraApi; agendada?: RegraApi }

const dataBr = (d: string) => d.split("-").reverse().join("/");
const SECOES: Array<[string, RegExp]> = [
  ["Preços", /^preco\./], ["Taxas, CMV e reposição", /^(taxa_servico|logistica|isencao|repasse|copeira|pedido_minimo|louca_premium|acrescimo|desconto|imposto|cmv|reposicao|verba)\./],
  ["Limites de duração", /^duracao\./], ["Quantidades de coffee", /^qtd\./], ["Almoço, jantar e rendimentos", /^(almoco\.|rendimento$)/], ["Listas travadas", /^(lista_negra|vocabulario_travado)$/]
];
const secao = (codigo: string) => SECOES.find(([, r]) => r.test(codigo))?.[0] ?? "Outras";

function agrupar(regras: RegraApi[]): Grupo[] {
  const hoje = hojeSaoPaulo();
  const mapa = new Map<string, RegraApi[]>();
  for (const r of regras) {
    const chave = `${r.codigo}|${r.escopoTipo}|${r.escopoChave}`;
    mapa.set(chave, [...(mapa.get(chave) ?? []), r]);
  }
  return [...mapa].map(([chave, lista]) => {
    const versoes = lista.sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde) || b.versao - a.versao);
    return { chave, versoes, vigente: versoes.find((v) => v.vigenteDesde <= hoje), agendada: versoes.find((v) => v.vigenteDesde > hoje) };
  }).sort((a, b) => a.chave.localeCompare(b.chave));
}

function lerValor(texto: string, anterior: unknown): unknown {
  if (typeof anterior === "number") {
    const n = Number(texto.replace(",", "."));
    if (!Number.isFinite(n)) throw new Error("Informe um número.");
    return n;
  }
  if (typeof anterior === "boolean") return texto === "true";
  if (typeof anterior === "string") return texto.trim();
  const valor: unknown = JSON.parse(texto);
  if (Array.isArray(valor) !== Array.isArray(anterior) || typeof valor !== "object" || valor === null) throw new Error("Mantenha o mesmo formato do valor anterior.");
  return valor;
}

export function RegrasPage() {
  const { usuario } = useAuth();
  const empresa = usuario?.empresas[0];
  const admin = usuario?.papeis.includes("ADMIN") ?? false;
  const [aba, setAba] = useState<"REGRAS" | "CARDAPIO" | "CLIENTES">("REGRAS");
  const [regras, setRegras] = useState<RegraApi[]>([]);
  const [clientes, setClientes] = useState<ClienteRegra[]>([]);
  const [cardapio, setCardapio] = useState<ItemCardapio[]>([]);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [edicao, setEdicao] = useState<{ base: RegraApi; escopoTipo: string; escopoChave: string; nova: boolean } | null>(null);
  const [historico, setHistorico] = useState<string | null>(null);
  const [itemEdicao, setItemEdicao] = useState<ItemCardapio | null>(null);

  const carregar = useCallback(async () => {
    if (!empresa) return;
    try {
      const [r, c] = await Promise.all([api<{ regras: RegraApi[]; clientes: ClienteRegra[] }>(`/api/v1/regras?empresaId=${empresa}`), api<ItemCardapio[]>("/api/v1/cardapio")]);
      setRegras(r.regras); setClientes(r.clientes); setCardapio(c); setErro("");
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível carregar as regras."); }
  }, [empresa]);
  // Consulta remota ao abrir a tela.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);
  useAoMudar(carregar);

  async function enviar(caminho: string, metodo: "POST" | "PATCH", corpo: unknown) {
    setOcupado(true); setErro("");
    try { await api(caminho, { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }); await carregar(); return true; }
    catch (e) { setErro(e instanceof Error ? e.message : "Falha ao salvar."); return false; }
    finally { setOcupado(false); }
  }

  const grupos = useMemo(() => agrupar(regras), [regras]);
  const termo = busca.toLowerCase();
  const filtrados = grupos.filter((g) => `${g.chave} ${g.vigente?.titulo ?? g.versoes[0]?.titulo}`.toLowerCase().includes(termo));
  const pendentes = grupos.filter((g) => g.vigente?.status === "PENDENTE");
  const divisor = grupos.find((g) => g.chave === "cmv.divisor_preco|GLOBAL|")?.vigente?.valor;
  const historicoGrupo = grupos.find((g) => g.chave === historico);

  async function salvarRegra(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!edicao) return;
    const f = new FormData(e.currentTarget);
    let valor: unknown;
    try { valor = lerValor(campoTexto(f, "valor"), edicao.base.valor); } catch (falha) { setErro(falha instanceof Error ? falha.message : "Valor inválido."); return; }
    const campo = (nome: string) => f.has(nome) ? campoTexto(f, nome) : undefined;
    const escopoTipo = campo("escopoTipo") ?? edicao.escopoTipo;
    const ok = await enviar("/api/v1/regras", "POST", {
      acao: "ALTERAR", codigo: edicao.base.codigo, escopoTipo, escopoChave: escopoTipo === "GLOBAL" ? "" : (campo("escopoChave") ?? edicao.escopoChave).toUpperCase(),
      valor, vigenteDesde: campo("vigenteDesde"), justificativa: campo("justificativa"), titulo: campo("titulo") || undefined
    });
    if (ok) setEdicao(null);
  }

  return <div className="space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap justify-between gap-4">
      <div><p className="text-xs uppercase tracking-widest text-primary">Fonte única das regras</p><h1 className="mt-2 text-3xl font-semibold">Regras e cardápio</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Toda mudança cria uma nova versão com data de vigência. Eventos usam a regra vigente na data do evento — mudar hoje não altera evento já calculado.</p></div>
      <Button variant="outline" disabled={ocupado} onClick={() => { void carregar(); }}><RefreshCw size={16} />Atualizar</Button>
    </header>
    {erro && <p role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{erro}</p>}
    {!!pendentes.length && aba === "REGRAS" && <section className="rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm">
      <h2 className="flex items-center gap-2 font-semibold"><AlertTriangle size={18} />{pendentes.length} regra(s) aguardando decisão da diretoria</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">{pendentes.map((g) => <li key={g.chave}>{g.vigente?.titulo}</li>)}</ul>
      <p className="mt-2 text-muted-foreground">O motor usa o valor provisório e avisa em cada cálculo. Salvar uma nova versão aprova a regra.</p>
    </section>}
    <div className="flex flex-wrap gap-2">{([["REGRAS", `Regras (${grupos.length})`], ["CARDAPIO", `Cardápio (${cardapio.length})`], ["CLIENTES", "Clientes com regra própria"]] as const).map(([id, nome]) => <Button key={id} variant={aba === id ? "default" : "outline"} onClick={() => setAba(id)}>{nome}</Button>)}</div>
    {aba !== "CLIENTES" && <label className="relative block"><Search size={16} className="absolute left-3 top-3 text-muted-foreground" /><input aria-label="Buscar" className={`${campoOperacao} pl-9`} placeholder={aba === "REGRAS" ? "Buscar regra, cliente ou tabela" : "Buscar item, grupo ou tier"} value={busca} onChange={(e) => setBusca(e.target.value)} /></label>}

    {aba === "REGRAS" && SECOES.map(([nome]) => nome).concat("Outras").map((nome) => {
      const lista = filtrados.filter((g) => secao(g.versoes[0]?.codigo ?? "") === nome);
      if (!lista.length) return null;
      return <section key={nome} className="space-y-2"><h2 className="text-lg font-semibold">{nome}</h2>
        <div className="divide-y rounded-xl border bg-card">{lista.map((g) => {
          const atual = g.vigente ?? g.versoes[0];
          if (!atual) return null;
          return <article key={g.chave} className="flex flex-wrap items-start gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{atual.titulo}{atual.status === "PENDENTE" && <span className="ml-2 rounded bg-warning/20 px-2 py-0.5 text-xs">pendente</span>}</p>
              <p className="mt-1 break-words text-sm">{formatarValor(atual.codigo, atual.valor)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{atual.codigo}{atual.escopoTipo !== "GLOBAL" && ` · ${atual.escopoTipo.toLowerCase()} ${atual.escopoChave}`} · vigente desde {dataBr(atual.vigenteDesde)} · v{atual.versao}</p>
              {g.agendada && <p className="mt-1 text-xs text-primary">Agendada para {dataBr(g.agendada.vigenteDesde)}: {formatarValor(g.agendada.codigo, g.agendada.valor)}</p>}
            </div>
            <div className="flex gap-1">
              {g.versoes.length > 1 && <Button variant="ghost" onClick={() => setHistorico(g.chave)}><History size={16} />Histórico</Button>}
              {admin && <Button variant="outline" onClick={() => setEdicao({ base: atual, escopoTipo: atual.escopoTipo, escopoChave: atual.escopoChave, nova: false })}><Pencil size={16} />Alterar</Button>}
              {admin && <Button variant="ghost" title="Criar valor específico para cliente, linha, região ou item" onClick={() => setEdicao({ base: atual, escopoTipo: "CLIENTE", escopoChave: "", nova: true })}>+ Escopo</Button>}
            </div>
          </article>;
        })}</div></section>;
    })}

    {aba === "CARDAPIO" && <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-sm">
      <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Item</th><th className="p-3">Grupo / tier</th><th className="p-3">Unidade</th><th className="p-3">Custo</th><th className="p-3">Preço sugerido</th><th className="p-3">EN / ES</th><th className="p-3">Estação</th><th className="p-3" /></tr></thead>
      <tbody className="divide-y">{cardapio.filter((i) => `${i.nome} ${i.grupo} ${i.tier}`.toLowerCase().includes(termo)).map((i) => <tr key={i.id} className={i.ativo ? "" : "opacity-50"}>
        <td className="p-3"><p className="font-medium">{i.nome}</p><p className="text-xs text-muted-foreground">{i.ingredientes}</p></td>
        <td className="p-3">{i.categoria}<br /><span className="text-xs text-muted-foreground">{i.tier}</span></td><td className="p-3">{i.unidade}</td>
        <td className="p-3">{i.custo === null ? "—" : moeda(i.custo)}</td>
        <td className="p-3">{i.custo !== null && typeof divisor === "number" ? moeda(Math.ceil(Number((i.custo / divisor / 0.5).toFixed(6))) * 0.5) : "—"}</td>
        <td className="p-3">{i.nomeEn && i.nomeEs ? `${i.nomeEn} / ${i.nomeEs}` : <span className="text-warning">tradução pendente</span>}</td>
        <td className="p-3">{i.estacao?.toLowerCase().replaceAll("_", " ") ?? <span className="text-warning">a definir</span>}</td>
        <td className="p-3">{admin && <Button variant="ghost" size="icon" aria-label={`Editar ${i.nome}`} onClick={() => setItemEdicao(i)}><Pencil size={16} /></Button>}</td>
      </tr>)}</tbody></table></div>}

    {aba === "CLIENTES" && <div className="space-y-3"><p className="text-sm text-muted-foreground">A chave liga o cliente às regras com escopo de cliente (isenções, reposição fixa, bebidas, pão de queijo…). A regra segue o cliente, não o endereço.</p>
      <div className="divide-y rounded-xl border bg-card">{clientes.map((c) => <form key={c.id} className="flex flex-wrap items-center gap-3 p-3" onSubmit={(e) => { e.preventDefault(); void enviar("/api/v1/regras", "POST", { acao: "CHAVE_CLIENTE", clienteId: c.id, chave: campoTexto(new FormData(e.currentTarget), "chave") }); }}>
        <span className="min-w-[200px] flex-1">{c.nome}</span>
        <input name="chave" aria-label={`Chave de regras de ${c.nome}`} defaultValue={c.chaveRegras ?? ""} placeholder="Sem regra própria" pattern="[A-Za-z0-9_]{2,40}" className={`${campoOperacao} max-w-[220px] uppercase`} disabled={!admin} />
        {admin && <Button type="submit" variant="outline" disabled={ocupado}>Salvar</Button>}
      </form>)}{!clientes.length && <p className="p-4 text-sm text-muted-foreground">Nenhum cliente cadastrado.</p>}</div></div>}

    {edicao && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><section role="dialog" aria-modal="true" aria-labelledby="editar-regra" className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-xl border bg-card p-6">
      <h2 id="editar-regra" className="text-xl font-semibold">{edicao.nova ? "Novo valor por escopo" : "Nova versão da regra"}</h2>
      <p className="text-sm text-muted-foreground">{edicao.base.titulo} · atual: {formatarValor(edicao.base.codigo, edicao.base.valor)}</p>
      <form className="space-y-4" onSubmit={(e) => { void salvarRegra(e); }}>
        {edicao.nova && <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Escopo<select name="escopoTipo" defaultValue="CLIENTE" className={campoOperacao}>{["CLIENTE", "LINHA", "REGIAO", "ITEM"].map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="text-sm">Chave<input name="escopoChave" required pattern="[A-Za-z0-9_]{1,60}" placeholder="INTELI, COFFEE_BREAK…" className={`${campoOperacao} uppercase`} /></label>
          <label className="text-sm sm:col-span-2">Título<input name="titulo" required minLength={3} maxLength={200} defaultValue={edicao.base.titulo} className={campoOperacao} /></label>
        </div>}
        <label className="block text-sm">Valor
          {typeof edicao.base.valor === "boolean"
            ? <select name="valor" defaultValue={edicao.base.valor ? "true" : "false"} className={campoOperacao}><option value="true">Sim</option><option value="false">Não</option></select>
            : typeof edicao.base.valor === "object"
              ? <textarea name="valor" required rows={8} defaultValue={JSON.stringify(edicao.base.valor, null, 2)} className={`${campoOperacao} font-mono text-xs`} />
              : <input name="valor" required defaultValue={typeof edicao.base.valor === "number" || typeof edicao.base.valor === "string" ? String(edicao.base.valor) : ""} className={campoOperacao} />}
        </label>
        {PERCENTUAL.test(edicao.base.codigo) && <p className="text-xs text-muted-foreground">Percentuais em fração: 0,05 = 5%.</p>}
        <label className="block text-sm">Vale a partir de<input type="date" name="vigenteDesde" required min={hojeSaoPaulo()} defaultValue={hojeSaoPaulo()} className={campoOperacao} /></label>
        <label className="block text-sm">Justificativa<textarea name="justificativa" required minLength={5} maxLength={1000} rows={2} className={campoOperacao} placeholder="Por que a regra mudou" /></label>
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={ocupado} onClick={() => setEdicao(null)}>Cancelar</Button><Button type="submit" disabled={ocupado}>Salvar versão</Button></div>
      </form></section></div>}

    {historicoGrupo && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><section role="dialog" aria-modal="true" aria-labelledby="historico-regra" className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-xl border bg-card p-6">
      <h2 id="historico-regra" className="text-xl font-semibold">Histórico</h2>
      <ol className="space-y-3">{historicoGrupo.versoes.map((v) => <li key={v.id} className="rounded-lg border p-3 text-sm"><p className="font-medium">{formatarValor(v.codigo, v.valor)}</p><p className="text-xs text-muted-foreground">v{v.versao} · vigente desde {dataBr(v.vigenteDesde)} · {v.origem}{v.justificativa ? ` · ${v.justificativa}` : ""}</p></li>)}</ol>
      <div className="flex justify-end"><Button variant="outline" onClick={() => setHistorico(null)}>Fechar</Button></div>
    </section></div>}

    {itemEdicao && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><section role="dialog" aria-modal="true" aria-labelledby="editar-item" className="w-full max-w-xl space-y-4 rounded-xl border bg-card p-6">
      <h2 id="editar-item" className="text-xl font-semibold">{itemEdicao.nome}</h2>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
        e.preventDefault(); const f = new FormData(e.currentTarget);
        void enviar("/api/v1/cardapio", "PATCH", { id: itemEdicao.id, dados: { nomeEn: campoTexto(f, "nomeEn"), nomeEs: campoTexto(f, "nomeEs"), selo: campoTexto(f, "selo"), estacao: campoTexto(f, "estacao"), fornecedor: campoTexto(f, "fornecedor"), ativo: f.get("ativo") === "on", ...(itemEdicao.custo !== null ? { custo: Number(f.get("custo")) } : {}) } }).then((ok) => { if (ok) setItemEdicao(null); });
      }}>
        <label className="text-sm">Nome em inglês<input name="nomeEn" defaultValue={itemEdicao.nomeEn ?? ""} maxLength={200} className={campoOperacao} /></label>
        <label className="text-sm">Nome em espanhol<input name="nomeEs" defaultValue={itemEdicao.nomeEs ?? ""} maxLength={200} className={campoOperacao} /></label>
        <label className="text-sm">Selo<select name="selo" defaultValue={itemEdicao.selo ?? ""} className={campoOperacao}><option value="">Sem selo</option><option value="VEGETARIANO">Vegetariano</option><option value="VEGANO">Vegano</option></select></label>
        <label className="text-sm">Estação<select name="estacao" defaultValue={itemEdicao.estacao ?? ""} className={campoOperacao}><option value="">A definir</option>{["COZINHA_QUENTE", "COZINHA_FRIA", "CONFEITARIA", "BEBIDAS", "ESTRUTURA", "FORNECEDOR"].map((s) => <option key={s} value={s}>{s.toLowerCase().replaceAll("_", " ")}</option>)}</select></label>
        <label className="text-sm">Fornecedor externo<input name="fornecedor" defaultValue={itemEdicao.fornecedor ?? ""} maxLength={200} className={campoOperacao} /></label>
        {itemEdicao.custo !== null && <label className="text-sm">Custo (R$)<input name="custo" type="number" min="0" step="0.0001" required defaultValue={itemEdicao.custo} className={campoOperacao} /></label>}
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="ativo" defaultChecked={itemEdicao.ativo} />Ativo no cardápio</label>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button variant="outline" disabled={ocupado} onClick={() => setItemEdicao(null)}>Cancelar</Button><Button type="submit" disabled={ocupado}>Salvar</Button></div>
      </form></section></div>}
  </div>;
}
