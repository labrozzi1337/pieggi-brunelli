import { useCallback, useEffect, useState } from "react";
import { Download, FileSpreadsheet, FileText, Lock, Paperclip, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { campoOperacao } from "@/components/operacao/ProgramacaoEditor";
import { api, baixarArquivo } from "@/lib/api";
import { dataBr, enviar, hoje, reais, rotuloFuncao, type DadosFreelancers } from "./comum";
import { periodo } from "./periodo";

interface Linha { freelancerId: string; nome: string; cnpj: string; pix: string; funcao: string; diarias: number; valorDiariaCentavos: number; totalCentavos: number; status: "PENDENTE" | "PAGO"; pagamentoId: string | null; pagoEm: string | null; comprovante: string | null }
interface Detalhe { id: string; freelancerId: string; evento: string; data: string; local: string; funcao: string; valorCentavos: number; status: string }
interface Relatorio {
  linhas: Linha[]; detalhes: Detalhe[];
  totais: { diarias: number; geralCentavos: number; pendenteCentavos: number; pagoCentavos: number; porFuncao: { funcao: string; diarias: number; totalCentavos: number }[]; porEvento: { eventoId: string; evento: string; diarias: number; totalCentavos: number }[] };
}
type Tipo = "SEMANA" | "QUINZENA" | "MES" | "PERSONALIZADO";

export function PagamentosFreelancers({ empresa, dados }: { empresa: string; dados: DadosFreelancers }) {
  const [tipo, setTipo] = useState<Tipo>("QUINZENA");
  const [[inicio, fim], setIntervalo] = useState<[string, string]>(() => periodo("QUINZENA", hoje()));
  const [eventoId, setEventoId] = useState(""); const [situacao, setSituacao] = useState("TODAS");
  const [eventos, setEventos] = useState<{ id: string; titulo: string; data_evento: string | null }[]>([]);
  const [rel, setRel] = useState<Relatorio | null>(null); const [erro, setErro] = useState(""); const [ocupado, setOcupado] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);

  const query = `empresaId=${empresa}&inicio=${inicio}&fim=${fim}&situacao=${situacao}${eventoId ? `&eventoId=${eventoId}` : ""}`;
  const carregar = useCallback(async () => {
    try { setRel(await api<Relatorio>(`/api/v1/freelancers/pagamentos?${query}`)); setErro(""); }
    catch (e) { setErro(e instanceof Error ? e.message : "Falha no relatório."); }
  }, [query]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { void api<{ eventos: typeof eventos }>(`/api/v1/freelancers/escala?empresaId=${empresa}`).then((r) => setEventos(r.eventos)).catch(() => undefined); }, [empresa]);

  function escolher(t: Tipo, referencia = inicio) { setTipo(t); if (t !== "PERSONALIZADO") setIntervalo(periodo(t, referencia)); }
  async function baixar(formato: "xlsx" | "pdf" | "pix") {
    setErro("");
    try { await baixarArquivo(`/api/v1/freelancers/pagamentos?${query}&formato=${formato}`, `freelancers.${formato === "pix" ? "csv" : formato}`); }
    catch (e) { setErro(e instanceof Error ? e.message : "Falha ao exportar."); }
  }
  async function agir(acao: string, valores: unknown) {
    setOcupado(true); setErro("");
    try { await enviar("/api/v1/freelancers/pagamentos", { empresaId: empresa, comando: { acao, dados: valores } }); await carregar(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível concluir."); }
    finally { setOcupado(false); }
  }
  function fechar() {
    if (!rel?.totais.pendenteCentavos) return;
    const pagoEm = window.prompt(`Fechar ${dataBr(inicio)} a ${dataBr(fim)}${eventoId ? " (só o evento filtrado)" : ""}: ${reais(rel.totais.pendenteCentavos)} pendentes viram PAGO e ficam travados. Data do pagamento (AAAA-MM-DD):`, hoje());
    if (pagoEm) void agir("FECHAR", { inicio, fim, pagoEm, ...(eventoId ? { eventoId } : {}) });
  }
  function comprovante(l: Linha) {
    const path = window.prompt(`Caminho do comprovante de ${l.nome}:`, l.comprovante ?? "");
    if (path && l.pagamentoId) void agir("COMPROVANTE", { pagamentoId: l.pagamentoId, comprovantePath: path });
  }

  return <section className="space-y-5">
    <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">{([["SEMANA", "Semana"], ["QUINZENA", "Quinzena"], ["MES", "Mês"], ["PERSONALIZADO", "Personalizado"]] as const).map(([id, nome]) =>
        <Button key={id} variant={tipo === id ? "default" : "outline"} onClick={() => escolher(id)}>{nome}</Button>)}</div>
      <label className="text-sm">De<input type="date" className={campoOperacao} value={inicio} onChange={(e) => { const v = e.target.value; if (tipo === "PERSONALIZADO") setIntervalo([v, fim < v ? v : fim]); else escolher(tipo, v); }} /></label>
      <label className="text-sm">Até<input type="date" className={campoOperacao} min={inicio} value={fim} disabled={tipo !== "PERSONALIZADO"} onChange={(e) => setIntervalo([inicio, e.target.value])} /></label>
      <label className="text-sm">Evento<select className={campoOperacao} value={eventoId} onChange={(e) => setEventoId(e.target.value)}><option value="">Todos</option>{eventos.map((e) => <option key={e.id} value={e.id}>{dataBr(e.data_evento)} · {e.titulo}</option>)}</select></label>
      <label className="text-sm">Situação<select className={campoOperacao} value={situacao} onChange={(e) => setSituacao(e.target.value)}><option value="TODAS">Todas</option><option value="PENDENTE">Pendentes</option><option value="PAGO">Pagas</option></select></label>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => { void carregar(); }}><RefreshCw size={16} />Atualizar</Button>
      <Button variant="outline" disabled={!rel?.linhas.length} onClick={() => { void baixar("xlsx"); }}><FileSpreadsheet size={16} />Planilha</Button>
      <Button variant="outline" disabled={!rel?.linhas.length} onClick={() => { void baixar("pdf"); }}><FileText size={16} />PDF</Button>
      <Button variant="outline" disabled={!rel?.totais.pendenteCentavos} onClick={() => { void baixar("pix"); }}><Download size={16} />Lote PIX (CSV)</Button>
      {dados.podePagar && <Button disabled={ocupado || !rel?.totais.pendenteCentavos} onClick={fechar}><Lock size={16} />Fechar período e marcar pago</Button>}
    </div>
    {erro && <p role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{erro}</p>}

    {rel && <>
      <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-4">
        <div><p className="text-xs text-muted-foreground">Total do período</p><p className="mt-1 text-xl font-semibold">{reais(rel.totais.geralCentavos)}</p></div>
        <div><p className="text-xs text-muted-foreground">Diárias</p><p className="mt-1 text-xl font-semibold">{rel.totais.diarias}</p></div>
        <div><p className="text-xs text-muted-foreground">Pendente</p><p className="mt-1 text-xl font-semibold">{reais(rel.totais.pendenteCentavos)}</p></div>
        <div><p className="text-xs text-muted-foreground">Pago</p><p className="mt-1 text-xl font-semibold">{reais(rel.totais.pagoCentavos)}</p></div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full min-w-[760px] text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr>{["Freelancer", "CNPJ", "Chave PIX", "Função", "Diárias", "Valor da diária", "Total a pagar", "Status"].map((c) => <th key={c} className="px-3 py-2">{c}</th>)}</tr></thead>
        <tbody>{rel.linhas.map((l) => { const chave = `${l.freelancerId}|${l.funcao}|${l.valorDiariaCentavos}|${l.status}|${l.pagamentoId}`; return [
          <tr key={chave} className="cursor-pointer border-t hover:bg-muted/30" onClick={() => setAberto(aberto === chave ? null : chave)}>
            <td className="px-3 py-2 font-medium">{l.nome}</td><td className="px-3 py-2">{l.cnpj}</td><td className="break-all px-3 py-2">{l.pix}</td><td className="px-3 py-2">{rotuloFuncao(l.funcao)}</td>
            <td className="px-3 py-2 text-right">{l.diarias}</td><td className="px-3 py-2 text-right">{reais(l.valorDiariaCentavos)}</td><td className="px-3 py-2 text-right font-semibold">{reais(l.totalCentavos)}</td>
            <td className="px-3 py-2">{l.status === "PAGO" ? <span>Pago {dataBr(l.pagoEm)}{dados.podePagar && <button type="button" className="ml-2 inline-flex items-center gap-1 text-primary underline" onClick={(e) => { e.stopPropagation(); comprovante(l); }}><Paperclip size={13} />{l.comprovante ? "comprovante" : "anexar"}</button>}</span> : "Pendente"}</td>
          </tr>,
          aberto === chave && <tr key={`${chave}-d`} className="bg-muted/20"><td colSpan={8} className="px-3 py-2">{rel.detalhes.filter((d) => d.freelancerId === l.freelancerId && d.funcao === l.funcao && d.valorCentavos === l.valorDiariaCentavos && d.status === l.status).map((d) =>
            <p key={d.id}>{dataBr(d.data)} · {d.evento}{d.local ? ` · ${d.local}` : ""}</p>)}</td></tr>
        ]; })}</tbody>
        {!!rel.linhas.length && <tfoot className="border-t font-semibold"><tr><td className="px-3 py-2" colSpan={4}>Total do período</td><td className="px-3 py-2 text-right">{rel.totais.diarias}</td><td /><td className="px-3 py-2 text-right">{reais(rel.totais.geralCentavos)}</td><td /></tr></tfoot>}
      </table>{!rel.linhas.length && <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma diária neste período.</p>}</div>
      {!!rel.linhas.length && <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4"><h3 className="font-semibold">Por função</h3>{rel.totais.porFuncao.map((f) => <p key={f.funcao} className="mt-2 flex justify-between text-sm"><span>{rotuloFuncao(f.funcao)} · {f.diarias} diária(s)</span><span>{reais(f.totalCentavos)}</span></p>)}</div>
        <div className="rounded-xl border bg-card p-4"><h3 className="font-semibold">Por evento</h3>{rel.totais.porEvento.map((e) => <p key={e.eventoId} className="mt-2 flex justify-between gap-2 text-sm"><span>{e.evento} · {e.diarias} diária(s)</span><span>{reais(e.totalCentavos)}</span></p>)}</div>
      </div>}
      <p className="text-xs text-muted-foreground">O lote PIX é um CSV genérico (nome; documento; chave PIX; valor; identificador) com o saldo pendente de cada pessoa. Layout de banco (CNAB) não é gerado.</p>
    </>}
  </section>;
}
