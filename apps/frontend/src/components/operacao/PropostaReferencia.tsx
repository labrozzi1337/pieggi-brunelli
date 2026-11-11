import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Referencia = { versao: number; escopo: string; restricoes: string; restritos: number; itens: { nome: string; servico: string; quantidade: number; unidade: string }[] };
export function PropostaReferencia({ eventoId }: { eventoId: string }) {
  const [referencia, setReferencia] = useState<Referencia | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void api<Referencia | null>(`/api/v1/propostas?eventoId=${eventoId}&operacional=true`, { signal: controller.signal }).then(setReferencia).catch(e => { if (!controller.signal.aborted) setErro(e instanceof Error ? e.message : "Falha ao consultar referência comercial."); });
    return () => controller.abort();
  }, [eventoId]);
  if (erro) return <p role="alert" className="rounded-xl bg-warning/10 p-4 text-sm">{erro}</p>;
  if (!referencia) return null;
  return <section className="space-y-3 rounded-xl border bg-card p-5"><h3 className="font-semibold">Escopo comercial aprovado · proposta v{referencia.versao}</h3><p className="whitespace-pre-wrap text-sm">{referencia.escopo}</p><p className="text-sm text-muted-foreground">Restrições: {referencia.restritos} pessoa(s). {referencia.restricoes}</p><div className="grid gap-3 md:grid-cols-2">{referencia.itens.map((i, n) => <div key={n} className="rounded-lg bg-muted p-3"><p className="text-xs text-primary">{i.servico}</p><p className="mt-1 text-sm">{i.nome} · {i.quantidade} {i.unidade} comerciais</p></div>)}</div><p className="text-xs text-warning">Referência sem preços. Defina rendimentos, receitas e quantidades físicas na programação; PAX não equivale a unidades de alimento.</p></section>;
}
