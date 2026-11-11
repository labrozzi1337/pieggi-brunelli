import { useState } from "react";
import { Download, FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { baixarArquivo } from "@/lib/api";
import { urlDocumento } from "@/lib/eventos";
import { type Programacao } from "@/lib/operacao";

const DOCUMENTOS = [
  { tipo: "programacao", nome: "Programação", ext: "docx" },
  { tipo: "comanda", nome: "Comanda (6 páginas por dia)", ext: "docx" },
  { tipo: "plaquinha", nome: "Plaquinhas PT / EN / ES", ext: "pdf" }
] as const;

/** Arquivos gerados pelo motor a partir da versão aprovada: traduções, selos e roteamento vêm do cadastro. */
export function Documentos({ eventoId, programacao: p }: { eventoId: string; programacao?: Programacao }) {
  const [erro, setErro] = useState(""); const [ocupado, setOcupado] = useState("");
  async function baixar(tipo: (typeof DOCUMENTOS)[number]["tipo"], nome: string, ext: string) {
    setErro(""); setOcupado(tipo);
    try { await baixarArquivo(urlDocumento(eventoId, tipo), `${nome}.${ext}`); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível gerar o documento."); }
    finally { setOcupado(""); }
  }
  return <section className="space-y-5 rounded-xl border bg-card p-5">
    <div className="flex items-start gap-3"><FileText className="text-primary" size={24} /><div><h3 className="text-lg font-semibold">Documentos da operação</h3><p className="mt-1 text-sm text-muted-foreground">Gerados automaticamente da versão aprovada, sem valores financeiros.</p></div></div>
    {p?.status !== "APROVADA" ? <p className="rounded-lg border border-warning/40 p-4 text-sm">Aprove a programação para liberar comanda e plaquinhas.</p> : <>
      <p className="flex items-center gap-2 text-sm text-success"><ShieldCheck size={16} />Versão {p.versao} aprovada · saída {new Date(p.saida_em).toLocaleString("pt-BR")}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {DOCUMENTOS.map((d) => <Button key={d.tipo} variant="outline" disabled={!!ocupado} onClick={() => void baixar(d.tipo, d.nome, d.ext)}><Download size={16} />{d.nome}</Button>)}
      </div>
    </>}
    {ocupado && <p role="status" className="text-sm text-muted-foreground">Gerando e conferindo pelas regras da data do evento…</p>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
  </section>;
}
