import { useState, type FormEvent } from "react";
import { History, MessageCircle, Pencil, Plus, Search, ShieldOff, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { campoOperacao } from "@/components/operacao/ProgramacaoEditor";
import { api } from "@/lib/api";
import { buscarCnpj, digitos, mascaraCnpj, mascaraTelefone } from "@/lib/mascaras";
import { dataBr, enviar, reais, rotuloFuncao, type DadosFreelancers, type Freelancer } from "./comum";

interface Historico { diarias: { id: string; evento: string; data: string; funcao: string; local: string; valorCentavos: number; status: string; pago_em: string | null }[] }

export function CadastroFreelancers({ empresa, dados, recarregar }: { empresa: string; dados: DadosFreelancers; recarregar: () => Promise<void> }) {
  const [editor, setEditor] = useState<Freelancer | "novo" | null>(null);
  const [busca, setBusca] = useState(""); const [inativos, setInativos] = useState(false);
  const [erro, setErro] = useState(""); const [ocupado, setOcupado] = useState(false);
  const [historico, setHistorico] = useState<{ id: string; dados?: Historico } | null>(null);
  const editado = editor && editor !== "novo" ? editor : null;

  async function agir(acao: string, valores: unknown) {
    setOcupado(true); setErro("");
    try { await enviar("/api/v1/freelancers", { empresaId: empresa, comando: { acao, dados: valores } }); await recarregar(); return true; }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar."); return false; }
    finally { setOcupado(false); }
  }
  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const valor = (f.get("valorDiaria") as string | null ?? "").replace(",", ".");
    const corpo = {
      nome: f.get("nome"), cnpj: f.get("cnpj"), celular: f.get("celular"), pix: f.get("pix"), funcoes: f.getAll("funcoes"),
      valorDiaria: valor ? Number(valor) : null, documentosPath: (f.get("documentosPath") as string | null ?? "").trim() || null
    };
    if (!corpo.funcoes.length) { setErro("Marque ao menos uma função."); return; }
    if (await agir(editado ? "EDITAR" : "CRIAR", editado ? { ...corpo, id: editado.id } : corpo)) setEditor(null);
  }
  function situacao(f: Freelancer, acao: "INATIVAR" | "REATIVAR" | "ANONIMIZAR") {
    const texto = acao === "ANONIMIZAR" ? "Anonimizar apaga nome, CNPJ, celular, PIX e documentos (LGPD). Diárias e pagamentos ficam no histórico. Não pode ser desfeito. Motivo:" : "Motivo:";
    const motivo = window.prompt(texto);
    if (motivo && motivo.trim().length >= 5) void agir(acao, { id: f.id, motivo });
    else if (motivo !== null) setErro("Informe o motivo com pelo menos 5 caracteres.");
  }
  async function verHistorico(id: string) {
    if (historico?.id === id) { setHistorico(null); return; }
    setHistorico({ id });
    try { setHistorico({ id, dados: await api<Historico>(`/api/v1/freelancers/${id}`) }); }
    catch (e) { setErro(e instanceof Error ? e.message : "Falha no histórico."); setHistorico(null); }
  }

  /** Nome vazio + CNPJ completo: a base pública traz o nome (a razão social do MEI termina com o CPF, que é descartado). */
  function preencherNome(cnpj: HTMLInputElement) {
    const nome = cnpj.form?.elements.namedItem("nome");
    if (!(nome instanceof HTMLInputElement) || nome.value.trim() || digitos(cnpj.value).length !== 14) return;
    buscarCnpj(cnpj.value).then((emp) => { if (!nome.value.trim()) nome.value = emp.razaoSocial.replace(/[\s\d.-]+$/, ""); }).catch((e: unknown) => setErro(e instanceof Error ? e.message : "Falha na consulta do CNPJ."));
  }

  const termo = busca.toLocaleLowerCase("pt-BR");
  const lista = dados.freelancers.filter((f) => (inativos || f.ativo) && `${f.nome} ${f.funcoes.map(rotuloFuncao).join(" ")} ${f.cnpj}`.toLocaleLowerCase("pt-BR").includes(termo));
  const faixa = dados.tabela.faixa;

  return <section className="space-y-5">
    {erro && <p role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{erro}</p>}
    <div className="flex flex-wrap items-center gap-3">
      <label className="relative min-w-0 flex-1"><Search size={16} className="absolute left-3 top-3 text-muted-foreground" /><input aria-label="Buscar freelancer" className={`${campoOperacao} pl-9`} placeholder="Buscar por nome, função ou CNPJ" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={inativos} onChange={(e) => setInativos(e.target.checked)} />Mostrar inativos</label>
      {dados.podeEditar && <Button disabled={ocupado || !!editor} onClick={() => setEditor("novo")}><Plus size={16} />Novo freelancer</Button>}
    </div>

    {editor && <form key={editado?.id ?? "novo"} className="grid gap-4 rounded-xl border border-primary/40 bg-card p-5 sm:grid-cols-2" onSubmit={(e) => { void salvar(e); }}>
      <h2 className="font-semibold sm:col-span-2">{editado ? "Editar cadastro" : "Novo freelancer"}</h2>
      <label className="text-sm sm:col-span-2">Nome completo<input name="nome" required minLength={2} maxLength={200} autoComplete="off" defaultValue={editado?.nome} className={campoOperacao} /></label>
      <label className="text-sm">CNPJ (MEI)<input name="cnpj" required inputMode="numeric" autoComplete="off" placeholder="00.000.000/0000-00" defaultValue={editado?.cnpj} className={campoOperacao}
        onInput={(e) => { e.currentTarget.value = mascaraCnpj(e.currentTarget.value); }} onBlur={(e) => preencherNome(e.currentTarget)} /></label>
      <label className="text-sm">Celular / WhatsApp<input name="celular" required type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 90000-0000" defaultValue={editado?.celular ? mascaraTelefone(editado.celular) : ""} className={campoOperacao}
        onInput={(e) => { e.currentTarget.value = mascaraTelefone(e.currentTarget.value); }} /></label>
      <label className="text-sm">Chave PIX<input name="pix" required minLength={3} maxLength={140} defaultValue={editado?.pix} className={campoOperacao} /></label>
      <label className="text-sm">Diária individual (opcional)<input name="valorDiaria" inputMode="decimal" placeholder={faixa ? `Padrão da função · faixa R$ ${faixa.min} a R$ ${faixa.max}` : "Padrão da função"} defaultValue={editado?.valorDiaria ?? ""} className={campoOperacao} /></label>
      <fieldset className="text-sm sm:col-span-2"><legend>Funções</legend><div className="mt-2 flex flex-wrap gap-2">{dados.tabela.funcoes.map((t) =>
        <label key={t.funcao} className="flex items-center gap-2 rounded-lg border px-3 py-2"><input type="checkbox" name="funcoes" value={t.funcao} defaultChecked={editado?.funcoes.includes(t.funcao)} />{rotuloFuncao(t.funcao)}<span className="text-xs text-muted-foreground">{t.valorCentavos === null ? "sem valor" : reais(t.valorCentavos)}{t.pendente ? " · provisório" : ""}</span></label>)}</div></fieldset>
      <label className="text-sm sm:col-span-2">Documentos (caminho no armazenamento, opcional)<input name="documentosPath" maxLength={500} defaultValue={editado?.documentosPath ?? ""} className={campoOperacao} /></label>
      <p className="text-xs text-muted-foreground sm:col-span-2">CNPJ, celular e PIX são dados pessoais: ficam cifrados e só aparecem para logística, financeiro e admin.</p>
      <div className="flex flex-wrap justify-end gap-2 sm:col-span-2"><Button variant="ghost" disabled={ocupado} onClick={() => setEditor(null)}>Cancelar</Button><Button type="submit" disabled={ocupado}>Salvar</Button></div>
    </form>}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{lista.map((f) => <article key={f.id} className={`space-y-2 rounded-xl border bg-card p-5 ${f.ativo ? "" : "opacity-70"}`}>
      <div className="flex items-start justify-between gap-2"><h3 className="text-lg font-semibold">{f.nome}</h3>{!f.ativo && <span className="text-xs font-semibold uppercase text-muted-foreground">{f.anonimizado ? "Anonimizado" : "Inativo"}</span>}</div>
      <p className="text-sm text-primary">{f.funcoes.map(rotuloFuncao).join(" · ")}{f.valorDiaria ? ` · diária individual ${reais(Math.round(f.valorDiaria * 100))}` : ""}</p>
      {!f.anonimizado && <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm"><dt className="text-muted-foreground">CNPJ</dt><dd>{f.cnpj}</dd><dt className="text-muted-foreground">PIX</dt><dd className="break-all">{f.pix}</dd><dt className="text-muted-foreground">Celular</dt><dd><a className="inline-flex items-center gap-1 text-primary underline" href={`https://wa.me/55${f.celular}`} target="_blank" rel="noreferrer"><MessageCircle size={14} />{f.celular}</a></dd></dl>}
      <p className="text-xs text-muted-foreground">{f.eventos} evento(s) trabalhados{f.ultimaDiaria ? ` · última diária ${dataBr(f.ultimaDiaria)}` : ""} · cadastro {dataBr(f.criadoEm)}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="outline" onClick={() => { void verHistorico(f.id); }}><History size={15} />Histórico</Button>
        {dados.podeEditar && !f.anonimizado && <>
          <Button variant="outline" disabled={ocupado || !!editor} onClick={() => setEditor(f)}><Pencil size={15} />Editar</Button>
          <Button variant="ghost" disabled={ocupado} onClick={() => situacao(f, f.ativo ? "INATIVAR" : "REATIVAR")}>{f.ativo ? <><UserX size={15} />Inativar</> : <><UserCheck size={15} />Reativar</>}</Button>
        </>}
        {dados.podeAnonimizar && !f.anonimizado && <Button variant="ghost" disabled={ocupado} onClick={() => situacao(f, "ANONIMIZAR")}><ShieldOff size={15} />Anonimizar</Button>}
      </div>
      {historico?.id === f.id && <div className="space-y-1 border-t pt-2 text-sm">{!historico.dados ? <p role="status">Carregando…</p> : historico.dados.diarias.length ? historico.dados.diarias.map((d) =>
        <p key={d.id} className={d.status === "CANCELADA" ? "line-through opacity-60" : ""}>{dataBr(d.data)} · {d.evento} · {rotuloFuncao(d.funcao)} · {reais(d.valorCentavos)} · {d.status === "PAGO" ? `pago ${dataBr(d.pago_em)}` : d.status.toLowerCase()}</p>) : <p className="text-muted-foreground">Nenhuma diária ainda.</p>}</div>}
    </article>)}</div>
    {!lista.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum freelancer encontrado.</p>}
  </section>;
}
