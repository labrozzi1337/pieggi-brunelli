import { Download, FileDown, FilePlus2, ReceiptText } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { baixarArquivoFiscal, listarDocumentos, type DocumentoFiscal } from "@/lib/api";
import { useAuth } from "@/contexts/auth";

/** Lista os documentos reais registrados pelo módulo fiscal. */
export function NotasFiscaisPage() {
  const { usuario } = useAuth();
  const empresaId = usuario?.empresas[0];
  const podeEmitir = usuario?.papeis.some((papel) => ["ADMIN", "FINANCEIRO"].includes(papel));
  const [documentos, setDocumentos] = useState<DocumentoFiscal[]>([]);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [baixando, setBaixando] = useState("");

  useEffect(() => {
    if (!empresaId) return;
    let vigente = true;
    listarDocumentos(empresaId, pagina)
      .then((resultado) => { if (vigente) { setDocumentos(resultado.documentos); setTotal(resultado.total); setErro(""); } })
      .catch((falha: Error) => { if (vigente) { setDocumentos([]); setErro(falha.message); } })
      .finally(() => { if (vigente) setCarregando(false); });
    return () => { vigente = false; };
  }, [empresaId, pagina]);

  async function baixar(documento: DocumentoFiscal, tipo: "xml" | "pdf") {
    const chave = `${documento.id}-${tipo}`;
    setErro("");
    setBaixando(chave);
    try {
      await baixarArquivoFiscal(documento.id, tipo);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível baixar o arquivo fiscal.");
    } finally {
      setBaixando("");
    }
  }

  return <div className="min-h-full p-4 sm:p-6 lg:p-8">
    <header className="rounded-[14px] bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-6 text-white sm:p-8">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-100/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.16em] text-cyan-100"><ReceiptText className="h-3.5 w-3.5" />Fiscal · NF-e modelo 55</span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">Notas fiscais de produto</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Documentos transmitidos, rejeitados e em preparação.</p>
        </div>
        {podeEmitir && <Link to="/notas-fiscais/nova" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-xs font-bold text-slate-950"><FilePlus2 className="h-4 w-4" />Nova NF-e</Link>}
      </div>
    </header>

    {erro && <p role="alert" className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
    {!empresaId && <p role="alert" className="mt-4 text-destructive">Usuário sem empresa vinculada.</p>}

    <section className="mt-4 overflow-hidden rounded-[14px] border bg-card">
      {carregando && empresaId ? <p role="status" className="p-8 text-center text-muted-foreground">Carregando notas fiscais…</p> : documentos.length === 0
        ? <div className="grid min-h-64 place-items-center p-8 text-center"><div><ReceiptText className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 font-semibold">Nenhuma NF-e para exibir</h2></div></div>
        : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-4 py-3">Número</th><th className="px-4 py-3">Destinatário</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Retorno SEFAZ</th><th className="px-4 py-3 text-right">Arquivos</th></tr></thead>
          <tbody>{documentos.map((documento) => {
            const autorizado = documento.status === "AUTORIZADO";
            return <tr key={documento.id} className="border-t">
              <td className="px-4 py-3 font-medium">{documento.numero ?? "Rascunho"}</td>
              <td className="px-4 py-3">{nomeDestinatario(documento)}</td>
              <td className="px-4 py-3">R$ {documento.totais.notaFiscal.toFixed(2)}</td>
              <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${autorizado ? "bg-emerald-500/10 text-emerald-700" : documento.status === "REJEITADO" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{documento.status}</span></td>
              <td className="max-w-sm px-4 py-3 text-xs text-muted-foreground">{documento.codigoStatusSefaz ? `${documento.codigoStatusSefaz} · ` : ""}{documento.mensagemSefaz ?? "—"}</td>
              <td className="px-4 py-3"><div className="flex justify-end gap-2">
                <button type="button" disabled={!autorizado || Boolean(baixando)} onClick={() => void baixar(documento, "xml")} className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40" title={autorizado ? "Baixar XML autorizado" : "Disponível após autorização da SEFAZ"}><Download className="h-3.5 w-3.5" />{baixando === `${documento.id}-xml` ? "Baixando…" : "XML"}</button>
                <button type="button" disabled={!autorizado || Boolean(baixando)} onClick={() => void baixar(documento, "pdf")} className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40" title={autorizado ? "Baixar DANFE em PDF" : "Disponível após autorização da SEFAZ"}><FileDown className="h-3.5 w-3.5" />{baixando === `${documento.id}-pdf` ? "Baixando…" : "PDF"}</button>
              </div></td>
            </tr>;
          })}</tbody>
        </table></div>}
    </section>
    <nav aria-label="Paginação das notas fiscais" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <span>{total} documentos · Página {pagina} de {Math.max(1, Math.ceil(total / 50))}</span>
      <div className="flex gap-2"><button type="button" disabled={carregando || pagina === 1} className="rounded-md border px-3 py-2 disabled:opacity-40" onClick={() => { setCarregando(true); setPagina(pagina - 1); }}>Anterior</button><button type="button" disabled={carregando || pagina * 50 >= total} className="rounded-md border px-3 py-2 disabled:opacity-40" onClick={() => { setCarregando(true); setPagina(pagina + 1); }}>Próxima</button></div>
    </nav>
  </div>;
}

function nomeDestinatario(documento: DocumentoFiscal): string {
  const nome = documento.destinatario.nome ?? documento.destinatario.razaoSocial;
  return typeof nome === "string" ? nome : "—";
}
