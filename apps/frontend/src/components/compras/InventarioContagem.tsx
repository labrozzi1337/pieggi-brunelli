import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { campoOperacao } from "@/components/operacao/ProgramacaoEditor";
import { comandar, mensagem, moeda, num, SETORES, type Insumo } from "./comum";

const numero = (t: string) => Number(t.replace(",", "."));

/** Contagem física por setor (pensada para o celular): saldo do sistema × contado, justificativa obrigatória na divergência. */
export function InventarioContagem({ empresa, insumos, aoRegistrar }: { empresa: string; insumos: Insumo[]; aoRegistrar: () => void }) {
  const [setor, setSetor] = useState("");
  const [contagem, setContagem] = useState<Record<string, { contado: string; justificativa: string }>>({});
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const lista = insumos.filter((i) => i.ativo && i.setor === setor);
  const mudar = (id: string, campo: "contado" | "justificativa", valor: string) => setContagem((c) => ({ ...c, [id]: { contado: "", justificativa: "", ...c[id], [campo]: valor } }));

  async function registrar() {
    const contagens = lista.filter((i) => contagem[i.id]?.contado.trim()).map((i) => ({ insumoId: i.id, contado: numero(contagem[i.id]!.contado), justificativa: contagem[i.id]!.justificativa.trim() || undefined }));
    if (!contagens.length) return setErro("Conte ao menos um insumo.");
    setOcupado(true); setErro(""); setAviso("");
    try {
      const r = await comandar<{ ajustes: unknown[]; perda: number }>("estoque", empresa, "INVENTARIO", { setor, contagens });
      setAviso(`Inventário registrado: ${r.ajustes.length} ajuste(s), perda de ${moeda(-r.perda)}.`);
      setContagem({}); aoRegistrar();
    } catch (e) { setErro(mensagem(e, "Falha ao registrar o inventário.")); }
    finally { setOcupado(false); }
  }

  return <div className="mx-auto max-w-xl space-y-4">
    <label className="block text-sm">Setor a contar<select className={`${campoOperacao} text-base`} value={setor} onChange={(e) => { setSetor(e.target.value); setContagem({}); }}>
      <option value="">Selecione</option>{Object.entries(SETORES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
    {lista.map((i) => {
      const c = contagem[i.id];
      const diferenca = c?.contado.trim() ? numero(c.contado) - i.saldo : 0;
      return <div key={i.id} className={`space-y-2 rounded-xl border bg-card p-4 ${diferenca ? "border-warning" : ""}`}>
        <div className="flex items-baseline justify-between gap-2"><p className="font-medium">{i.nome}</p><p className="text-xs text-muted-foreground">sistema: {num(i.saldo)} {i.unidade}</p></div>
        <input inputMode="decimal" aria-label={`Contagem de ${i.nome}`} placeholder={`Contado (${i.unidade})`} className={`${campoOperacao} py-3 text-lg`} value={c?.contado ?? ""} onChange={(e) => mudar(i.id, "contado", e.target.value)} />
        {!!diferenca && <>
          <p className={`text-sm ${diferenca < 0 ? "text-destructive" : ""}`}>Diferença {diferenca > 0 ? "+" : ""}{num(diferenca)} {i.unidade} ({moeda(diferenca * i.custo_medio)})</p>
          <input aria-label={`Justificativa de ${i.nome}`} placeholder="Justificativa (obrigatória)" maxLength={500} className={campoOperacao} value={c?.justificativa ?? ""} onChange={(e) => mudar(i.id, "justificativa", e.target.value)} />
        </>}
      </div>;
    })}
    {setor && !lista.length && <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Nenhum insumo neste setor.</p>}
    {erro && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{erro}</p>}
    {aviso && <p role="status" className="rounded-lg border border-success/40 p-3 text-sm text-success">{aviso}</p>}
    {!!lista.length && <Button className="h-12 w-full text-base" disabled={ocupado} onClick={() => { void registrar(); }}>Registrar contagem e ajustes</Button>}
  </div>;
}
