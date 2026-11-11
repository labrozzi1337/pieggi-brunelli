import { CalendarDays, Check, CheckCircle2, ChevronRight, CircleDollarSign, Download, FileText, LockKeyhole, Sparkles, Users, Wand2, X } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/auth";
import { api, atualizarEvento, baixarArquivo, type Evento } from "@/lib/api";
import { doApi, gerarProgramacao, pendenciasCriticas, urlDocumento, type ServicoForm, type TipoDocumento } from "@/lib/eventos";
import { Aviso, Bloco, Campo, ResumoItem, Secao } from "./comum";
import { buscarCep, buscarCnpj, mascaraCep, mascaraCpfCnpj, mascaraTelefone } from "@/lib/mascaras";
import { useAutoBusca } from "@/lib/useAutoBusca";
import { area, camposPendentes, campo, corEtapa, formatarData, mensagem, PAPEIS_COMERCIAIS, PAPEIS_VALORES, rotulo, tem, temEnderecoFixo } from "./util";

type Formulario = Record<"clienteNome" | "documento" | "email" | "telefone" | "titulo" | "tabelaPreco" | "pax" | "dataEvento" | "horarioInicio" | "horarioFim" | "logradouro" | "numeroEndereco" | "complemento" | "bairro" | "cidade" | "uf" | "cep" | "contatoLocalNome" | "contatoLocalTelefone" | "observacoes", string>;
const formularioDoEvento = (e: Evento): Formulario => ({
  clienteNome: e.clienteNome, documento: mascaraCpfCnpj(e.clienteDocumento ?? ""), email: e.clienteEmail ?? "", telefone: e.clienteTelefone ?? "", titulo: e.titulo,
  tabelaPreco: e.tabelaPreco ?? "", pax: e.pax?.toString() ?? "", dataEvento: e.dataEvento ?? "", horarioInicio: e.horarioInicio?.slice(0, 5) ?? "", horarioFim: e.horarioFim?.slice(0, 5) ?? "",
  logradouro: e.logradouro ?? "", numeroEndereco: e.numeroEndereco ?? "", complemento: e.complemento ?? "", bairro: e.bairro ?? "", cidade: e.cidade ?? "", uf: e.uf ?? "SP", cep: e.cep ?? "",
  contatoLocalNome: e.contatoLocalNome ?? "", contatoLocalTelefone: e.contatoLocalTelefone ?? "", observacoes: e.observacoes ?? ""
});
const opcional = (v: string) => v.trim() || null;

export function PainelEvento({ evento, onFechar, onAtualizado, onRecarregar, onFluxo }: {
  evento: Evento; onFechar: () => void; onAtualizado: (e: Evento) => void; onRecarregar: () => Promise<void>; onFluxo: (e: Evento, servicos: ServicoForm[]) => void;
}) {
  const { usuario } = useAuth();
  const podeEditar = tem(usuario?.papeis, PAPEIS_COMERCIAIS);
  const [editando, setEditando] = useState(false);
  const [dados, setDados] = useState(() => formularioDoEvento(evento));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true); setErro("");
    try {
      const fixo = temEnderecoFixo(evento);
      const atualizado = await atualizarEvento(evento.id, {
        empresaId: evento.empresaId, atualizadoEm: evento.atualizadoEm, titulo: dados.titulo.trim(), tabelaPreco: opcional(dados.tabelaPreco),
        pax: dados.pax ? Number(dados.pax) : null, dataEvento: opcional(dados.dataEvento), horarioInicio: opcional(dados.horarioInicio), horarioFim: opcional(dados.horarioFim),
        complemento: opcional(dados.complemento), contatoLocalNome: opcional(dados.contatoLocalNome), contatoLocalTelefone: opcional(dados.contatoLocalTelefone), observacoes: opcional(dados.observacoes),
        ...(fixo ? {} : { logradouro: opcional(dados.logradouro), numeroEndereco: opcional(dados.numeroEndereco), bairro: opcional(dados.bairro), cidade: opcional(dados.cidade), uf: opcional(dados.uf), cep: opcional(dados.cep) }),
        cliente: { tipo: evento.clienteTipo, nome: dados.clienteNome.trim(), documento: opcional(dados.documento), email: opcional(dados.email), telefone: opcional(dados.telefone) }
      });
      onAtualizado(atualizado);
      setEditando(false);
    } catch (falha) { setErro(mensagem(falha)); } finally { setSalvando(false); }
  }

  return <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
    <aside role="dialog" aria-modal="true" aria-labelledby="evento-titulo" className="ml-auto flex h-full w-full max-w-2xl flex-col border-l bg-card text-foreground shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b p-4 sm:p-6">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${corEtapa(evento.etapaComercial)}`}>{rotulo(evento.etapaComercial)}</span>
            {evento.etapaOperacao === "BLOQUEADO" && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase text-amber-700"><LockKeyhole className="h-3 w-3" />Operação bloqueada</span>}
          </div>
          <h2 id="evento-titulo" className="truncate text-2xl font-semibold">{evento.titulo}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{evento.clienteNome}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onFechar} aria-label="Fechar"><X className="h-5 w-5" /></Button>
      </header>
      <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
        {erro && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
        {editando
          ? <form id="editar-evento" onSubmit={(e) => void salvar(e)}><FormularioEvento dados={dados} alterar={(k, v) => setDados((d) => ({ ...d, [k]: v }))} enderecoFixo={temEnderecoFixo(evento)} /></form>
          : <><AcoesEvento evento={evento} onRecarregar={onRecarregar} onFluxo={onFluxo} /><Resumo evento={evento} /></>}
      </div>
      <footer className="flex flex-wrap justify-between gap-3 border-t bg-card p-4 sm:p-5">
        <div className="flex flex-wrap gap-4">
          <Link className="inline-flex items-center gap-1 text-sm font-medium text-primary" to={`/propostas?evento=${evento.id}`}><ChevronRight size={16} />Revisões da proposta</Link>
          <Link className="inline-flex items-center gap-1 text-sm font-medium text-primary" to={`/operacao?evento=${evento.id}`}><ChevronRight size={16} />Operação completa</Link>
        </div>
        {podeEditar && <div className="flex gap-2">
          {editando && <Button variant="outline" onClick={() => { setDados(formularioDoEvento(evento)); setEditando(false); }}>Cancelar</Button>}
          <Button type={editando ? "submit" : "button"} form={editando ? "editar-evento" : undefined} disabled={salvando} onClick={() => { if (!editando) { setDados(formularioDoEvento(evento)); setEditando(true); } }}>
            {editando ? (salvando ? "Salvando…" : "Salvar alterações") : "Editar dados"}
          </Button>
        </div>}
      </footer>
    </aside>
  </div>;
}

const DOCUMENTOS: Array<{ tipo: TipoDocumento; nome: string; ext: string; papeis: string[] }> = [
  { tipo: "proposta", nome: "Proposta", ext: "pptx", papeis: PAPEIS_VALORES },
  { tipo: "programacao", nome: "Programação", ext: "docx", papeis: ["PROGRAMACAO"] },
  { tipo: "comanda", nome: "Comanda", ext: "docx", papeis: ["PROGRAMACAO", "PRODUCAO", "EXPEDICAO_COMPRAS"] },
  { tipo: "plaquinha", nome: "Plaquinha", ext: "pdf", papeis: ["PROGRAMACAO"] }
];

/** Próximos passos do evento em botões grandes; cada bloqueio diz o motivo. */
function AcoesEvento({ evento, onRecarregar, onFluxo }: { evento: Evento; onRecarregar: () => Promise<void>; onFluxo: (e: Evento, servicos: ServicoForm[]) => void }) {
  const { usuario } = useAuth();
  const papeis = usuario?.papeis;
  const [ocupado, setOcupado] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const programacao = evento.artefatos?.programacao ?? "PENDENTE";
  const temProgramacao = programacao === "RASCUNHO" || programacao === "APROVADA";
  const contrato = !!evento.contratoAssinadoEm || evento.etapaOperacao !== "BLOQUEADO";
  const proposta = ["QUENTE", "CONTRATO_ENVIADO", "CONTRATO_ASSINADO"].includes(evento.etapaComercial);
  const faltas = pendenciasCriticas(evento, temEnderecoFixo(evento));

  async function executar(chave: string, acao: () => Promise<unknown>, sucesso: string) {
    setOcupado(chave); setErro(""); setOk("");
    try { await acao(); setOk(sucesso); await onRecarregar(); } catch (e) { setErro(mensagem(e)); } finally { setOcupado(""); }
  }
  async function abrirFluxo() {
    setOcupado("fluxo"); setErro("");
    try {
      const r = await api<{ propostas: Array<{ briefing?: { servicos?: Array<Record<string, unknown>> } }> }>(`/api/v1/propostas?eventoId=${evento.id}`);
      onFluxo(evento, doApi(r.propostas[0]?.briefing?.servicos ?? []));
    } catch (e) { setErro(mensagem(e)); } finally { setOcupado(""); }
  }
  const motivo = (tipo: TipoDocumento) => tipo === "proposta" ? (proposta ? "" : "Gere a proposta primeiro.")
    : tipo === "programacao" ? (temProgramacao ? "" : "Gere a programação primeiro.") : programacao === "APROVADA" ? "" : "Aprove a programação primeiro.";

  return <section className="space-y-3" aria-label="Próximos passos">
    {tem(papeis, PAPEIS_COMERCIAIS) && <Grande icone={<Sparkles />} titulo={proposta ? "Revisar cardápio e gerar nova proposta" : "Montar cardápio e gerar proposta"}
      detalhe={faltas.length ? `Falta: ${faltas.join(", ")} (preencha no assistente)` : "O sistema sugere o cardápio, calcula preço e CMV."} disabled={!!ocupado} onClick={() => void abrirFluxo()} />}
    {tem(papeis, ["PROGRAMACAO"]) && <>
      <Grande icone={<Wand2 />} titulo={temProgramacao ? "Gerar programação de novo" : "Gerar programação"}
        detalhe={!proposta ? "Bloqueado: aprove a proposta antes." : !contrato ? "Bloqueado: registre o contrato assinado na Operação." : "Quantidades pelas regras da data do evento, a partir da proposta aprovada."}
        disabled={!!ocupado || !proposta || !contrato} onClick={() => void executar("programacao", () => gerarProgramacao(evento.id, evento.revisao ?? 1), "Programação gerada em rascunho. Confira e aprove.")} />
      {programacao === "RASCUNHO" && <Grande icone={<CheckCircle2 />} titulo="Aprovar programação" detalhe="Libera comanda, plaquinha, compras e produção."
        disabled={!!ocupado} onClick={() => void executar("aprovar", () => api(`/api/v1/eventos/${evento.id}/operacao`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revisao: evento.revisao, comando: { acao: "PROGRAMACAO_APROVAR", dados: {} } }) }), "Programação aprovada.")} />}
      {!contrato && <Link to={`/operacao?evento=${evento.id}&aba=contrato`} className="inline-flex items-center gap-1 text-sm text-primary"><Check className="h-4 w-4" />Registrar contrato assinado</Link>}
    </>}
    {tem(papeis, ["FINANCEIRO"]) && evento.contratoAssinadoEm && <Link to={`/notas-fiscais/nova?evento=${evento.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary">
      <FileText className="h-4 w-4" />Emitir NF-e deste evento (destinatário já preenchido)</Link>}
    <div className="grid grid-cols-2 gap-2">
      {DOCUMENTOS.filter((d) => tem(papeis, d.papeis)).map((d) => {
        const bloqueio = motivo(d.tipo);
        return <div key={d.tipo}>
          <Button variant="outline" className="h-14 w-full flex-col gap-0.5" disabled={!!ocupado || !!bloqueio} title={bloqueio || undefined}
            onClick={() => void executar(d.tipo, () => baixarArquivo(urlDocumento(evento.id, d.tipo), `${d.nome}.${d.ext}`), `${d.nome} baixada.`)}>
            <span className="flex items-center gap-2"><Download className="h-4 w-4" />{d.nome}</span><span className="text-[10px] text-muted-foreground">.{d.ext}</span>
          </Button>
          {bloqueio && <p className="mt-1 text-[11px] text-muted-foreground">{bloqueio}</p>}
        </div>;
      })}
    </div>
    {ocupado && <p role="status" className="text-xs text-muted-foreground">Processando e conferindo pelas regras da data do evento…</p>}
    {erro && <Aviso tom="bloqueio" titulo="Não foi possível concluir" itens={erro.split(" · ")} />}
    {ok && <Aviso tom="ok" titulo={ok} />}
  </section>;
}

function Grande({ icone, titulo, detalhe, disabled, onClick }: { icone: ReactNode; titulo: string; detalhe: string; disabled?: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="flex w-full items-center gap-3 rounded-xl border bg-primary/5 p-4 text-left transition hover:border-primary/50 disabled:opacity-50">
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground [&>svg]:h-5 [&>svg]:w-5">{icone}</span>
    <span><span className="block font-semibold">{titulo}</span><span className="block text-xs text-muted-foreground">{detalhe}</span></span>
  </button>;
}

function Resumo({ evento }: { evento: Evento }) {
  const pendencias = camposPendentes(evento);
  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-3">
      <Bloco icone={<CalendarDays />} titulo="Data e horário" valor={formatarData(evento.dataEvento)} detalhe={evento.horarioInicio ? `${evento.horarioInicio.slice(0, 5)}–${evento.horarioFim?.slice(0, 5) ?? "?"}` : "Horário pendente"} />
      <Bloco icone={<Users />} titulo="Público" valor={evento.pax ? `${evento.pax} pessoas` : "Pendente"} detalhe={evento.tabelaPreco || "Tabela pendente"} />
      <Bloco icone={<CircleDollarSign />} titulo="Financeiro" valor={rotulo(evento.etapaFinanceiro)} detalhe="Valores restritos ao financeiro" />
    </div>
    <section><Secao titulo="Local e contato" /><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
      <ResumoItem nome="Endereço" valor={[evento.endereco, evento.complemento].filter(Boolean).join(" — ")} />
      <ResumoItem nome="Contato" valor={[evento.contatoLocalNome, evento.contatoLocalTelefone].filter(Boolean).join(" · ")} />
    </div></section>
    {pendencias.length ? <Aviso tom="atencao" titulo={`Falta para fechar: ${pendencias.join(", ")}`} /> : <Aviso tom="ok" titulo="Cadastro completo para formalização." />}
    {evento.observacoes && <section><Secao titulo="Observações" /><p className="mt-3 whitespace-pre-wrap rounded-xl bg-muted/50 p-4 text-sm leading-6">{evento.observacoes}</p></section>}
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><FileText className="h-3.5 w-3.5" />Cliente: {evento.clienteNome}{evento.clienteDocumento ? ` · ${evento.clienteDocumento}` : ""}</p>
  </div>;
}

const MASCARAS: Partial<Record<keyof Formulario, (v: string) => string>> = {
  uf: (v) => v.toUpperCase(), cep: mascaraCep, documento: mascaraCpfCnpj, telefone: mascaraTelefone, contatoLocalTelefone: mascaraTelefone
};
const ATRIBUTOS: Partial<Record<keyof Formulario, Record<string, unknown>>> = {
  cep: { inputMode: "numeric", autoComplete: "postal-code", placeholder: "00000-000" }, documento: { inputMode: "numeric", placeholder: "00.000.000/0000-00" },
  telefone: { type: "tel", autoComplete: "tel" }, contatoLocalTelefone: { type: "tel", autoComplete: "tel" }, email: { type: "email", autoComplete: "email" },
  clienteNome: { autoComplete: "organization" }, logradouro: { autoComplete: "address-line1" }, cidade: { autoComplete: "address-level2" }
};

function FormularioEvento({ dados, alterar, enderecoFixo }: { dados: Formulario; alterar: (k: keyof Formulario, v: string) => void; enderecoFixo: boolean }) {
  const input = (k: keyof Formulario, label: string, extra: Record<string, unknown> = {}) =>
    <Campo label={label}><input className={campo} value={dados[k]} onChange={(e) => alterar(k, MASCARAS[k]?.(e.target.value) ?? e.target.value)} {...ATRIBUTOS[k]} {...extra} /></Campo>;
  // Autopreenchimento: CEP traz o endereço; CNPJ completa e-mail e telefone do cliente que estiverem vazios.
  const cep = useAutoBusca(dados.cep, 8, buscarCep, (r) => { for (const [k, v] of [["logradouro", r.logradouro], ["bairro", r.bairro], ["cidade", r.cidade], ["uf", r.uf]] as const) if (v) alterar(k, v); });
  const cnpj = useAutoBusca(dados.documento, 14, buscarCnpj, (emp) => {
    if (!dados.email && emp.email) alterar("email", emp.email);
    if (!dados.telefone && emp.telefone) alterar("telefone", emp.telefone);
    if (!dados.clienteNome.trim()) alterar("clienteNome", emp.razaoSocial);
  });
  const status = [cep.buscando && "Buscando CEP…", cnpj.buscando && "Consultando CNPJ…", cep.erro, cnpj.erro].filter(Boolean).join(" · ");
  return <div className="space-y-6">
    <div><Secao titulo="Evento" /><div className="mt-3 grid gap-3 sm:grid-cols-2">
      {input("titulo", "Nome")}{input("tabelaPreco", "Tabela de preço")}{input("dataEvento", "Data", { type: "date" })}{input("pax", "Pax exato", { type: "number", min: 1 })}
      {input("horarioInicio", "Início", { type: "time" })}{input("horarioFim", "Fim", { type: "time" })}
    </div></div>
    <div><Secao titulo="Local e contato" /><div className="mt-3 grid gap-3 sm:grid-cols-2">
      {enderecoFixo ? <p className="text-xs text-muted-foreground sm:col-span-2">Endereço fixo do cliente (regra): {dados.logradouro}</p>
        : <>{input("cep", "CEP")}{input("logradouro", "Rua / avenida")}{input("numeroEndereco", "Número")}{input("bairro", "Bairro")}{input("cidade", "Cidade")}{input("uf", "UF", { maxLength: 2 })}</>}
      {input("complemento", "Complemento (sala, andar)")}{input("contatoLocalNome", "Contato")}{input("contatoLocalTelefone", "Telefone do contato")}
      <div className="sm:col-span-2"><Campo label="Observações"><textarea className={area} value={dados.observacoes} onChange={(e) => alterar("observacoes", e.target.value)} /></Campo></div>
    </div></div>
    <div><Secao titulo="Cliente" /><div className="mt-3 grid gap-3 sm:grid-cols-2">
      {input("documento", "CPF / CNPJ")}{input("clienteNome", "Nome / razão social")}{input("telefone", "Telefone")}{input("email", "E-mail")}
    </div></div>
    {status && <p role="status" className="text-xs text-muted-foreground">{status}</p>}
  </div>;
}
