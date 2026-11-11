import { FileSpreadsheet, Upload } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/auth";
import { api } from "@/lib/api";

interface Situacao { ativos: number; pendentes: number; inativos: number; arquivo: string | null; atualizado_em: string | null }
interface Resultado { arquivo: string; produtos: number; novos: number; atualizados: number; inativados: string[]; ignorados: Array<{ aba: string; linha: number; produto: string; motivo: string }> }

export function ConfiguracoesPage() {
  const { usuario } = useAuth();
  const empresaId = usuario?.empresas[0];
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(() => {
    if (!empresaId) return Promise.resolve();
    return api<Situacao>(`/api/v1/fiscal/produtos/importar?empresaId=${empresaId}`).then(setSituacao).catch((e: unknown) => setErro(e instanceof Error ? e.message : "Falha ao consultar o catálogo."));
  }, [empresaId]);
  useEffect(() => { void carregar(); }, [carregar]);

  async function importar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!empresaId) return;
    const elemento = e.currentTarget; // currentTarget some depois do await
    const form = new FormData(elemento);
    form.set("empresaId", empresaId);
    setEnviando(true); setErro(""); setResultado(null);
    try { setResultado(await api<Resultado>("/api/v1/fiscal/produtos/importar", { method: "POST", body: form })); elemento.reset(); await carregar(); }
    catch (falha) { setErro(falha instanceof Error ? falha.message : "Falha na importação."); }
    finally { setEnviando(false); }
  }

  if (!empresaId) return <p role="alert" className="p-8">Seu acesso não possui uma empresa vinculada.</p>;
  return <div className="space-y-6 p-4 sm:p-6 lg:p-8">
    <header><p className="eyebrow">Configurações</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Catálogo fiscal</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Os produtos da NF-e (NCM, CFOP, CST, alíquotas e preço) vêm da planilha revisada pela contabilidade. Para atualizar, envie a nova versão: itens são atualizados pelo código, novos entram e os que saíram ficam inativos (notas já emitidas não mudam).</p></header>

    <section className="grid gap-4 sm:grid-cols-3">{[
      ["Produtos ativos", situacao?.ativos ?? "—"], ["Pendentes de revisão", situacao?.pendentes ?? "—"],
      ["Última planilha", situacao?.arquivo ? `${situacao.arquivo}${situacao.atualizado_em ? ` · ${new Date(situacao.atualizado_em).toLocaleString("pt-BR")}` : ""}` : "—"]
    ].map(([nome, valor]) => <article key={nome} className="rounded-xl border bg-card p-5"><p className="text-xs text-muted-foreground">{nome}</p><p className="mt-2 break-words text-lg font-semibold">{valor}</p></article>)}</section>

    <form onSubmit={(e) => void importar(e)} className="space-y-4 rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-2 font-semibold"><FileSpreadsheet className="h-5 w-5 text-primary" />Atualizar planilha da contabilidade</h2>
      <label className="block text-sm">Planilha (.xlsx, até 5 MB)
        <input name="arquivo" type="file" required accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-2 file:text-sm" />
      </label>
      <p className="text-xs text-muted-foreground">Cada aba precisa das colunas #, PRODUTO, GRUPO, NCM, CFOP, CST ICMS, ALÍQ. ICMS, CST/ALÍQ. PIS, CST/ALÍQ. COFINS, ORIGEM e, se houver, CUSTO e PREÇO DE VENDA. Itens de serviço/locação (ISS) ficam fora da NF-e de produto.</p>
      <Button type="submit" disabled={enviando}><Upload className="h-4 w-4" />{enviando ? "Importando…" : "Importar planilha"}</Button>
    </form>

    {erro && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{erro}</p>}
    {resultado && <section role="status" className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm">
      <h2 className="font-semibold">Planilha importada: {resultado.arquivo}</h2>
      <p>{resultado.produtos} produtos · {resultado.novos} novos · {resultado.atualizados} atualizados · {resultado.inativados.length} inativados</p>
      {!!resultado.inativados.length && <p className="text-xs">Inativados (saíram da planilha): {resultado.inativados.join(", ")}</p>}
      {!!resultado.ignorados.length && <details><summary className="cursor-pointer font-medium">{resultado.ignorados.length} linha(s) fora da NF-e de produto</summary>
        <ul className="mt-2 space-y-1 text-xs">{resultado.ignorados.map((i) => <li key={`${i.aba}${i.linha}`}>{i.aba}, linha {i.linha} · {i.produto} — {i.motivo}</li>)}</ul></details>}
    </section>}
  </div>;
}
