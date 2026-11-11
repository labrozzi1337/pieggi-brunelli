// Passo "Serviços": tudo por chips e valores herdados do evento; o cardápio vem sugerido pelo motor e só se troca item a item.
import { Minus, Plus, RefreshCw, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  LINHAS, NOMES_LINHA, novoServico, PERIODOS, quantidadeTexto, RESTRICOES, type Linha, type Restricoes, type ServicoForm, type ServicoSugerido, type Sugestao
} from "@/lib/eventos";
import { Campo, Chip } from "./comum";
import { campo, rotulo } from "./util";

const TIER_PREFERIDO = ["EXECUTIVE", "STANDARD", "MASTER"];
const dataCurta = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

export function ServicosEditor({ servicos, alterar, sugestao, base, dias }: {
  servicos: ServicoForm[]; alterar: (s: ServicoForm[]) => void; sugestao: Sugestao | null;
  base: { data: string; inicio: string; fim: string; pax: number }; dias: string[];
}) {
  const [linha, setLinha] = useState<Linha | null>(null);
  const tiers = (l: Linha) => sugestao?.opcoes.linhas.find((x) => x.linha === l)?.tiers ?? TIER_PREFERIDO;
  const mudar = (i: number, patch: Partial<ServicoForm>) => alterar(servicos.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const adicionar = (l: Linha, tier: string) => { alterar([...servicos, novoServico(base, l, tier)]); setLinha(null); };

  return <div className="space-y-4">
    {servicos.map((s, i) => <CartaoServico key={s.uid} s={s} sug={sugestao?.servicos.find((x) => x.id === `s${i + 1}`)} sugestao={sugestao} dias={dias} tiers={tiers(s.linha)}
      mudar={(patch) => mudar(i, patch)} remover={() => alterar(servicos.filter((_, k) => k !== i))} />)}

    <section className="rounded-xl border border-dashed bg-muted/20 p-4" aria-label="Adicionar serviço">
      <p className="text-sm font-semibold">{servicos.length ? "Adicionar outro serviço" : "Que serviço foi contratado?"}</p>
      <div className="mt-3 flex flex-wrap gap-2">{LINHAS.map((l) => <Chip key={l} ativo={linha === l} onClick={() => setLinha(linha === l ? null : l)}>{NOMES_LINHA[l]}</Chip>)}</div>
      {linha && <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">Nível:</span>
        {tiers(linha).map((t) => <Chip key={t} onClick={() => adicionar(linha, t)}>{rotulo(t)}</Chip>)}</div>}
    </section>
  </div>;
}

function CartaoServico({ s, sug, sugestao, dias, tiers, mudar, remover }: {
  s: ServicoForm; sug?: ServicoSugerido; sugestao: Sugestao | null; dias: string[]; tiers: string[]; mudar: (p: Partial<ServicoForm>) => void; remover: () => void;
}) {
  const travado = sugestao?.opcoes.travado ?? false;
  const bebidas = sugestao?.opcoes.bebidas ?? [];
  const ativas = s.bebidas ?? sug?.bebidas ?? [];
  const comida = (sug?.itens ?? []).filter((i) => !i.bebida);
  /** A troca é sempre do item que o motor sugeriu: se o atual já é troca, atualiza a mesma chave. */
  const trocar = (atual: string, novo: string) => {
    const origem = Object.entries(s.trocas).find(([, v]) => v === atual)?.[0] ?? atual;
    const trocas = { ...s.trocas };
    if (origem === novo) delete trocas[origem]; else trocas[origem] = novo;
    mudar({ trocas });
  };
  return <article className="rounded-xl border bg-card p-4 shadow-sm">
    <header className="flex items-start justify-between gap-3">
      <div><h4 className="font-semibold">{sug?.nome ?? NOMES_LINHA[s.linha]} · {rotulo(s.tier)}</h4>
        <p className="text-xs text-muted-foreground">{s.pax} pax · {s.horarioInicio}–{s.horarioFim}{sug?.comReposicao ? " · com reposição (pela duração)" : ""}{dias.length > 1 ? ` · ${dataCurta(s.data)}` : ""}</p></div>
      <Button variant="ghost" size="icon" aria-label="Remover serviço" onClick={remover}><Trash2 className="h-4 w-4" /></Button>
    </header>

    <div className="mt-3 flex flex-wrap gap-2">{tiers.map((t) => <Chip key={t} ativo={s.tier === t} onClick={() => mudar({ tier: t, trocas: {} })}>{rotulo(t)}</Chip>)}</div>
    <div className="mt-2 flex flex-wrap gap-2">{PERIODOS.map(([p, nome]) => <Chip key={p} ativo={s.periodo === p} onClick={() => mudar({ periodo: p })}>{nome}</Chip>)}</div>
    {dias.length > 1 && <div className="mt-2 flex flex-wrap gap-2">{dias.map((d) => <Chip key={d} ativo={s.data === d} onClick={() => mudar({ data: d })}>{dataCurta(d)}</Chip>)}</div>}

    <div className="mt-3 grid grid-cols-3 gap-2">
      <Campo label="Início"><input type="time" required className={campo} value={s.horarioInicio} onChange={(e) => mudar({ horarioInicio: e.target.value })} /></Campo>
      <Campo label="Fim"><input type="time" required className={campo} value={s.horarioFim} onChange={(e) => mudar({ horarioFim: e.target.value })} /></Campo>
      <Campo label="Pax"><input type="number" min={1} inputMode="numeric" required className={campo} value={s.pax} onChange={(e) => mudar({ pax: Math.max(1, Number(e.target.value) || 1) })} /></Campo>
    </div>

    {s.linha === "AUDITORIO" && <div className="mt-3"><Chip ativo={!!s.cortesia} onClick={() => mudar({ cortesia: !s.cortesia })}>Cortesia (café e água na refresqueira)</Chip></div>}

    {s.almoco && <fieldset className="mt-3 grid gap-2 sm:grid-cols-2"><legend className="mb-1 text-xs font-semibold text-muted-foreground">Buffet (separe por vírgula)</legend>
      {([["proteinas", "Proteínas"], ["acompanhamentos", "Acompanhamentos"], ["massa", "Massa (se houver)"], ["vegetariano", "Prato vegetariano (se houver)"], ["sobremesas", "Sobremesas"]] as const).map(([k, nome]) =>
        <Campo key={k} label={nome}><input className={campo} value={s.almoco![k]} onChange={(e) => mudar({ almoco: { ...s.almoco!, [k]: e.target.value } })} /></Campo>)}
    </fieldset>}

    <section className="mt-4" aria-label="Cardápio sugerido">
      <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Sugerido pelo sistema{travado ? " · cardápio travado" : ""}</p>
        {!!Object.keys(s.trocas).length && <button type="button" className="inline-flex items-center gap-1 text-xs text-primary" onClick={() => mudar({ trocas: {} })}><Undo2 className="h-3 w-3" />Desfazer trocas</button>}</div>
      {!sug ? <p className="mt-2 text-xs text-muted-foreground">Calculando…</p> : <ul className="mt-2 divide-y rounded-lg border">
        {comida.map((i, k) => {
          const opcoes = i.cardapioItemId && !travado ? sug.alternativas[i.item] ?? [] : [];
          return <li key={k} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <span className="w-20 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{quantidadeTexto(i)}</span>
            <span className="min-w-0 flex-1">{i.receita}{i.selo && <span className="ml-1 text-[10px] uppercase text-emerald-700">{i.selo.toLowerCase()}</span>}</span>
            {opcoes.length > 1 && <label className="flex items-center gap-1 text-xs text-primary"><RefreshCw className="h-3 w-3" /><span className="sr-only">Trocar {i.receita}</span>
              <select className="max-w-40 rounded border bg-background px-1 py-1 text-xs" value={i.cardapioItemId!} onChange={(e) => trocar(i.cardapioItemId!, e.target.value)}>
                {opcoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select></label>}
          </li>;
        })}
        {!comida.length && <li className="px-3 py-2 text-xs text-muted-foreground">Sem itens de comida nesta linha.</li>}
      </ul>}
    </section>

    {!!bebidas.length && <div className="mt-3"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Bebidas</p>
      <div className="mt-2 flex flex-wrap gap-2">{bebidas.map((b) => <Chip key={b} ativo={ativas.includes(b)} onClick={() => mudar({ bebidas: ativas.includes(b) ? ativas.filter((x) => x !== b) : [...ativas, b] })}>{b}</Chip>)}</div></div>}

    <details className="mt-3"><summary className="cursor-pointer text-xs text-muted-foreground">Redação no orçamento (opcional)</summary>
      <input className={`${campo} mt-2`} maxLength={200} placeholder="Como o cliente chama este serviço (ex.: Coffee III)" value={s.descritivo} onChange={(e) => mudar({ descritivo: e.target.value })} />
    </details>
  </article>;
}

/** Gate 2 (§5): restrições como contadores rápidos. */
export function RestricoesEditor({ valor, alterar }: { valor: Restricoes; alterar: (r: Restricoes) => void }) {
  const qtd = (tipo: string) => valor.itens.find((i) => i.tipo === tipo)?.quantidade ?? 0;
  const definir = (tipo: Restricoes["itens"][number]["tipo"], n: number) =>
    alterar({ ...valor, itens: [...valor.itens.filter((i) => i.tipo !== tipo), ...(n > 0 ? [{ tipo, quantidade: n }] : [])] });
  const total = valor.itens.reduce((a, i) => a + i.quantidade, 0);
  return <section className="rounded-xl border bg-card p-4" aria-label="Restrições alimentares">
    <p className="text-sm font-semibold">Restrições alimentares <span className="font-normal text-muted-foreground">{total ? `· ${total} pessoa(s)` : "· nenhuma"}</span></p>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">{RESTRICOES.map(([tipo, nome]) => <div key={tipo} className="flex items-center justify-between rounded-lg border px-3 py-1.5">
      <span className="text-sm">{nome}</span>
      <span className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Menos ${nome}`} disabled={!qtd(tipo)} onClick={() => definir(tipo, qtd(tipo) - 1)}><Minus className="h-3.5 w-3.5" /></Button>
        <span className="w-6 text-center text-sm font-semibold tabular-nums">{qtd(tipo)}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Mais ${nome}`} onClick={() => definir(tipo, qtd(tipo) + 1)}><Plus className="h-3.5 w-3.5" /></Button>
      </span>
    </div>)}</div>
    {total > 0 && <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">Cobrança:</span>
      <Chip ativo={valor.cobranca === "CORTESIA"} onClick={() => alterar({ ...valor, cobranca: "CORTESIA" })}>Cortesia</Chip>
      <Chip ativo={valor.cobranca === "PAGO"} onClick={() => alterar({ ...valor, cobranca: "PAGO" })}>Incluída no valor</Chip></div>}
  </section>;
}
