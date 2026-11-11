// Fluxo guiado (§2/§5): 1 Cliente → 2 Evento → 3 Serviços → 4 Resumo e "Confirmar e gerar proposta".
// Só se pergunta o que o sistema não sabe: cliente de regra própria preenche endereço, contato e tabela sozinho.
import { Check, ChevronLeft, ChevronRight, Download, MapPin, Search, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/auth";
import { atualizarEvento, baixarArquivo, criarEvento, type Evento } from "@/lib/api";
import {
  chaveDoNome, gerarProposta, impedimentos, listarClientes, pendenciasCriticas, reais, sugerir, urlDocumento,
  type ClienteResumo, type Clientes, type FixosCliente, type Restricoes, type ServicoForm, type Sugestao
} from "@/lib/eventos";
import { Aviso, Campo, Secao } from "./comum";
import { RestricoesEditor, ServicosEditor } from "./ServicosEditor";
import { campo, mensagem, PAPEIS_VALORES, tem, temEnderecoFixo } from "./util";
import { buscarCep, buscarCnpj, digitos, mascaraCep, mascaraCpfCnpj, mascaraTelefone, type Endereco } from "@/lib/mascaras";
import { useAutoBusca } from "@/lib/useAutoBusca";

interface Dados {
  clienteId: string | null; clienteNome: string; clienteDocumento: string; clienteEmail: string; clienteTelefone: string; enderecoEmpresa: Endereco | null;
  contatoNome: string; contatoTelefone: string;
  titulo: string; dataEvento: string; dataFim: string; pax: string; inicio: string; fim: string;
  cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string;
}
const vazio: Dados = { clienteId: null, clienteNome: "", clienteDocumento: "", clienteEmail: "", clienteTelefone: "", enderecoEmpresa: null,contatoNome: "", contatoTelefone: "", titulo: "", dataEvento: "", dataFim: "", pax: "", inicio: "", fim: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "SP" };
const PASSOS = ["Cliente", "Evento", "Serviços", "Resumo"];

function dadosDoEvento(e: Evento): Dados {
  return {
    clienteId: e.clienteId, clienteNome: e.clienteNome, clienteDocumento: mascaraCpfCnpj(e.clienteDocumento ?? ""), clienteEmail: e.clienteEmail ?? "",
    clienteTelefone: e.clienteTelefone ?? "", enderecoEmpresa: null, contatoNome: e.contatoLocalNome ?? "", contatoTelefone: e.contatoLocalTelefone ?? "", titulo: e.titulo,
    dataEvento: e.dataEvento ?? "", dataFim: "", pax: e.pax ? String(e.pax) : "", inicio: e.horarioInicio?.slice(0, 5) ?? "", fim: e.horarioFim?.slice(0, 5) ?? "",
    cep: e.cep ?? "", logradouro: temEnderecoFixo(e) ? "" : e.logradouro ?? "", numero: e.numeroEndereco ?? "", complemento: e.complemento ?? "",
    bairro: e.bairro ?? "", cidade: e.cidade ?? "", uf: e.uf ?? "SP"
  };
}
const diasEntre = (inicio: string, fim: string) => {
  if (!inicio) return [];
  const dias = [inicio];
  for (let d = inicio; fim && d < fim && dias.length < 15;) { d = new Date(Date.parse(`${d}T12:00:00Z`) + 86400000).toISOString().slice(0, 10); dias.push(d); }
  return dias;
};

export function NovoEvento({ empresaId, inicial, onFechar, onConcluido }: {
  empresaId: string; inicial?: { evento: Evento; servicos: ServicoForm[] }; onFechar: () => void; onConcluido: (eventoId: string) => void;
}) {
  const { usuario } = useAuth();
  const veValores = tem(usuario?.papeis, PAPEIS_VALORES);
  const admin = usuario?.papeis.includes("ADMIN") ?? false;
  const [passo, setPasso] = useState(inicial ? 3 : 1);
  const [dados, setDados] = useState<Dados>(() => (inicial ? dadosDoEvento(inicial.evento) : vazio));
  const [evento, setEvento] = useState<Evento | null>(inicial?.evento ?? null);
  const [clientes, setClientes] = useState<Clientes | null>(null);
  const [servicos, setServicos] = useState<ServicoForm[]>(inicial?.servicos ?? []);
  const [restricoes, setRestricoes] = useState<Restricoes>({ itens: [], cobranca: "CORTESIA" });
  const [sugestao, setSugestao] = useState<Sugestao | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [gerada, setGerada] = useState<{ totalCentavos: number } | null>(null);
  const alterar = (patch: Partial<Dados>) => setDados((d) => ({ ...d, ...patch }));

  useEffect(() => { listarClientes(empresaId).then(setClientes).catch((e: unknown) => setErro(mensagem(e))); }, [empresaId]);

  const fixos: FixosCliente = useMemo(() => {
    if (!clientes) return { chave: null };
    const existente = clientes.clientes.find((c) => c.id === dados.clienteId);
    const chave = existente?.chaveRegras ?? chaveDoNome(dados.clienteNome, clientes.fixos.map((f) => f.chave ?? ""));
    return clientes.fixos.find((f) => f.chave === chave) ?? { ...clientes.padrao, chave: null };
  }, [clientes, dados.clienteId, dados.clienteNome]);
  const enderecoFixo = !!fixos.endereco;
  const dias = useMemo(() => diasEntre(dados.dataEvento, dados.dataFim), [dados.dataEvento, dados.dataFim]);
  const base = { data: dados.dataEvento, inicio: dados.inicio, fim: dados.fim, pax: Number(dados.pax) || 1 };

  // Prévia do motor a cada mudança (sem salvar nada); respostas atrasadas são descartadas.
  const pedido = useRef(0);
  useEffect(() => {
    if (passo < 3 || !evento || !servicos.length) return;
    const n = ++pedido.current;
    const t = setTimeout(() => {
      setCalculando(true);
      sugerir(evento.id, servicos, restricoes)
        .then((s) => { if (n === pedido.current) { setSugestao(s); setErro(""); } })
        .catch((e: unknown) => { if (n === pedido.current) setErro(mensagem(e)); })
        .finally(() => { if (n === pedido.current) setCalculando(false); });
    }, 350);
    return () => clearTimeout(t);
  }, [passo, evento, servicos, restricoes]);

  const faltasEvento = pendenciasCriticas({
    pax: Number(dados.pax) || null, dataEvento: dados.dataEvento, horarioInicio: dados.inicio, horarioFim: dados.fim,
    logradouro: dados.logradouro, numeroEndereco: dados.numero, bairro: dados.bairro, cidade: dados.cidade, uf: dados.uf, cep: dados.cep, contatoLocalNome: dados.contatoNome || fixos.contato
  }, enderecoFixo);
  const bloqueios = sugestao ? impedimentos(sugestao) : [];
  const podeGerar = !!sugestao && !calculando && servicos.length > 0 && confirmado && !sugestao.regrasFaltando.length && (admin || !sugestao.bloqueios.length);

  async function salvarEvento() {
    const campos = {
      empresaId, titulo: dados.titulo.trim() || dados.clienteNome.trim(), pax: Number(dados.pax), dataEvento: dados.dataEvento, horarioInicio: dados.inicio, horarioFim: dados.fim,
      contatoLocalNome: dados.contatoNome.trim() || null, contatoLocalTelefone: dados.contatoTelefone.trim() || null,
      ...(enderecoFixo ? { complemento: dados.complemento.trim() || null } : {
        cep: dados.cep.trim(), logradouro: dados.logradouro.trim(), numeroEndereco: dados.numero.trim(), complemento: dados.complemento.trim() || null,
        bairro: dados.bairro.trim(), cidade: dados.cidade.trim(), uf: dados.uf.trim()
      })
    };
    const salvo = evento
      ? await atualizarEvento(evento.id, { ...campos, atualizadoEm: evento.atualizadoEm })
      : await criarEvento({ ...campos, ...(dados.clienteId ? { clienteId: dados.clienteId } : { cliente: {
        tipo: digitos(dados.clienteDocumento).length === 11 ? "PF" : "PJ", nome: dados.clienteNome.trim(),
        documento: digitos(dados.clienteDocumento) || null, email: dados.clienteEmail.trim() || null, telefone: dados.clienteTelefone.trim() || null } }) });
    setEvento(salvo);
    if (!servicos.length) return;
    // Datas, horário e pax do evento mudaram: serviços que herdavam os valores antigos acompanham.
    setServicos((lista) => lista.map((s) => ({ ...s, data: dias.includes(s.data) ? s.data : dados.dataEvento })));
  }

  async function avancar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    if (passo === 1) {
      if (dados.clienteNome.trim().length < 2) return setErro("Escolha um cliente ou digite o nome do novo cliente.");
      if (!dados.contatoNome && fixos.contato) alterar({ contatoNome: fixos.contato });
      if (!dados.titulo) alterar({ titulo: dados.clienteNome.trim() });
      return setPasso(2);
    }
    if (passo === 2) {
      if (faltasEvento.length) return setErro(`Falta: ${faltasEvento.join(", ")}.`);
      setSalvando(true);
      try { await salvarEvento(); setPasso(3); } catch (falha) { setErro(mensagem(falha)); } finally { setSalvando(false); }
      return;
    }
    if (passo === 3) {
      if (!servicos.length) return setErro("Adicione ao menos um serviço.");
      return setPasso(4);
    }
    if (!evento || !podeGerar) return;
    setSalvando(true);
    try {
      const r = await gerarProposta(evento.id, evento.revisao ?? 1, servicos, restricoes);
      setGerada({ totalCentavos: r.totalCentavos });
    } catch (falha) { setErro(mensagem(falha)); } finally { setSalvando(false); }
  }

  return <div className="fixed inset-0 z-50 grid place-items-stretch bg-black/65 backdrop-blur-sm sm:place-items-center sm:p-6">
    <form onSubmit={(e) => void avancar(e)} role="dialog" aria-modal="true" aria-labelledby="fluxo-titulo"
      className="flex h-full w-full flex-col overflow-hidden bg-card text-foreground shadow-2xl sm:h-auto sm:max-h-[94vh] sm:max-w-3xl sm:rounded-2xl sm:border">
      <header className="flex items-start justify-between gap-4 border-b p-4 sm:p-5">
        <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">{evento ? evento.titulo : "Novo evento"} · passo {passo} de 4</p>
          <h2 id="fluxo-titulo" className="mt-1 text-xl font-semibold sm:text-2xl">{PASSOS[passo - 1]}</h2></div>
        <Button variant="ghost" size="icon" onClick={onFechar} aria-label="Fechar"><X className="h-5 w-5" /></Button>
      </header>
      <nav className="grid grid-cols-4 border-b bg-muted/30 px-2" aria-label="Etapas">
        {PASSOS.map((t, i) => <button type="button" key={t} disabled={i + 1 > passo || (i + 1 < 3 && !!gerada)} onClick={() => setPasso(i + 1)}
          className={`relative flex items-center justify-center gap-2 py-3 text-[10px] font-bold uppercase sm:text-xs ${i + 1 === passo ? "text-primary" : i + 1 < passo ? "text-foreground" : "text-muted-foreground"}`}>
          <span className={`grid h-6 w-6 place-items-center rounded-full text-[10px] ${i + 1 <= passo ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{i + 1 < passo ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
          <span className="hidden sm:inline">{t}</span>{i + 1 === passo && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
        </button>)}
      </nav>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {erro && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
        {passo === 1 && <PassoCliente dados={dados} alterar={alterar} clientes={clientes?.clientes ?? []} fixos={fixos} />}
        {passo === 2 && <PassoEvento dados={dados} alterar={alterar} fixos={fixos} />}
        {passo === 3 && <>
          <ServicosEditor servicos={servicos} alterar={setServicos} sugestao={sugestao} base={base} dias={dias.length ? dias : [...new Set(servicos.map((s) => s.data))]} />
          <RestricoesEditor valor={restricoes} alterar={setRestricoes} />
          {calculando && <p role="status" className="text-xs text-muted-foreground">Recalculando pelas regras da data do evento…</p>}
          {sugestao && !!bloqueios.length && <Aviso tom="bloqueio" titulo="Precisa de ajuste antes da proposta" itens={bloqueios} />}
        </>}
        {passo === 4 && (gerada
          ? <Concluido evento={evento!} total={veValores ? gerada.totalCentavos : null} onVer={() => onConcluido(evento!.id)} />
          : <Resumo dados={dados} fixos={fixos} sugestao={sugestao} servicos={servicos} restricoes={restricoes} veValores={veValores} admin={admin} confirmado={confirmado} setConfirmado={setConfirmado} />)}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t bg-card p-3 sm:px-6">
        <Button variant="outline" onClick={() => (passo === 1 || gerada ? (gerada ? onConcluido(evento!.id) : onFechar()) : setPasso(passo - 1))}>
          {passo === 1 || gerada ? (gerada ? "Fechar" : "Cancelar") : <><ChevronLeft className="h-4 w-4" />Voltar</>}
        </Button>
        {!gerada && <Button type="submit" disabled={salvando || (passo === 4 && !podeGerar)} className="min-w-40">
          {passo === 4 ? (salvando ? "Gerando…" : <><Sparkles className="h-4 w-4" />Confirmar e gerar proposta</>) : salvando ? "Salvando…" : <>Continuar <ChevronRight className="h-4 w-4" /></>}
        </Button>}
      </footer>
    </form>
  </div>;
}

function PassoCliente({ dados, alterar, clientes, fixos }: { dados: Dados; alterar: (p: Partial<Dados>) => void; clientes: ClienteResumo[]; fixos: FixosCliente }) {
  const termo = dados.clienteNome.trim().toLocaleLowerCase("pt-BR");
  const sugeridos = termo && !dados.clienteId ? clientes.filter((c) => c.nome.toLocaleLowerCase("pt-BR").includes(termo)).slice(0, 6) : [];
  const doCliente = (c: ClienteResumo): Partial<Dados> => ({ clienteId: c.id, clienteNome: c.nome, clienteDocumento: mascaraCpfCnpj(c.documento ?? ""), clienteEmail: c.email ?? "", clienteTelefone: c.telefone ?? "" });
  const porDocumento = (d: string) => (d.length >= 11 ? clientes.find((c) => c.documento && digitos(c.documento) === d) : undefined);
  // CNPJ completo: cliente já cadastrado é escolhido; senão a base pública preenche nome, e-mail, telefone e guarda o endereço da empresa.
  const consulta = useAutoBusca(dados.clienteDocumento, 14, buscarCnpj, (emp) => {
    const existente = porDocumento(emp.cnpj);
    alterar({
      ...(existente ? doCliente(existente) : dados.clienteId ? {} : { clienteNome: dados.clienteNome.trim() || emp.nomeFantasia || emp.razaoSocial }),
      clienteEmail: dados.clienteEmail || existente?.email || emp.email, clienteTelefone: dados.clienteTelefone || existente?.telefone || emp.telefone,
      enderecoEmpresa: emp.endereco.logradouro ? emp.endereco : null
    });
  });
  return <div className="space-y-4">
    <Secao titulo="Para quem é o evento?" descricao="Busque pelo nome ou digite o CNPJ: razão social, e-mail, telefone e endereço vêm sozinhos." />
    <div className="grid gap-3 sm:grid-cols-[1fr_15rem]">
      <Campo label="Cliente" critico>
        <span className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <input autoFocus className={`${campo} pl-9`} value={dados.clienteNome} placeholder="Ex.: StartSe, Inteli, Acme…" autoComplete="organization"
            onChange={(e) => alterar({ clienteNome: e.target.value, clienteId: null })} /></span>
      </Campo>
      <Campo label="CNPJ / CPF">
        <input className={campo} inputMode="numeric" autoComplete="off" placeholder="00.000.000/0000-00" value={dados.clienteDocumento}
          onChange={(e) => {
            const v = mascaraCpfCnpj(e.target.value), existente = porDocumento(digitos(v));
            alterar(existente ? doCliente(existente) : { clienteDocumento: v, ...(dados.clienteId ? { clienteId: null, clienteNome: "", enderecoEmpresa: null } : {}) });
          }} />
      </Campo>
    </div>
    {consulta.buscando && <p role="status" className="text-xs text-muted-foreground">Consultando CNPJ na base pública…</p>}
    {consulta.erro && <p role="alert" className="text-xs text-destructive">{consulta.erro}</p>}
    {!!sugeridos.length && <ul className="divide-y rounded-lg border" aria-label="Clientes encontrados">{sugeridos.map((c) =>
      <li key={c.id}><button type="button" className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-muted/50" onClick={() => alterar(doCliente(c))}>
        <span>{c.nome}{c.documento && <span className="ml-2 text-xs text-muted-foreground">{mascaraCpfCnpj(c.documento)}</span>}</span>{c.chaveRegras && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">{c.chaveRegras}</span>}</button></li>)}</ul>}
    {dados.clienteId ? <Aviso tom="ok" titulo={`Cliente cadastrado: ${dados.clienteNome}`} /> : dados.clienteNome.trim().length >= 2 && <Aviso tom="info" titulo={`Novo cliente: ${dados.clienteNome.trim()}`}
      itens={[dados.clienteEmail, dados.clienteTelefone, dados.enderecoEmpresa && `${dados.enderecoEmpresa.logradouro}, ${dados.enderecoEmpresa.numero} — ${dados.enderecoEmpresa.cidade}/${dados.enderecoEmpresa.uf}`].filter((x): x is string => !!x)} />}
    {!dados.clienteId && dados.clienteNome.trim().length >= 2 && <div className="grid gap-3 sm:grid-cols-2">
      <Campo label="E-mail do cliente (opcional)"><input type="email" autoComplete="email" className={campo} value={dados.clienteEmail} onChange={(e) => alterar({ clienteEmail: e.target.value })} /></Campo>
      <Campo label="Telefone do cliente (opcional)"><input type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 90000-0000" className={campo} value={dados.clienteTelefone} onChange={(e) => alterar({ clienteTelefone: mascaraTelefone(e.target.value) })} /></Campo>
    </div>}
    {fixos.chave && <Aviso tom="ok" titulo={`Regras de ${fixos.chave} aplicadas automaticamente`} itens={[
      ...(fixos.endereco ? [`Endereço fixo: ${fixos.endereco}`] : []), ...(fixos.tabela ? [`Tabela de preço: ${fixos.tabela}`] : []), ...(fixos.contato ? [`Contato: ${fixos.contato}`] : [])
    ]} />}
    {!fixos.contato && !dados.clienteId && dados.clienteNome.trim().length >= 2 && <div className="grid gap-3 sm:grid-cols-2">
      <Campo label="Contato no evento (opcional)"><input className={campo} autoComplete="name" value={dados.contatoNome} onChange={(e) => alterar({ contatoNome: e.target.value })} /></Campo>
      <Campo label="Telefone do contato (opcional)"><input type="tel" className={campo} inputMode="tel" autoComplete="tel" placeholder="(11) 90000-0000" value={dados.contatoTelefone} onChange={(e) => alterar({ contatoTelefone: mascaraTelefone(e.target.value) })} /></Campo>
    </div>}
  </div>;
}

function PassoEvento({ dados, alterar, fixos }: { dados: Dados; alterar: (p: Partial<Dados>) => void; fixos: FixosCliente }) {
  const [pedirContato] = useState(() => !dados.contatoNome); // já informado no passo 1 → não pergunta de novo
  // CEP define rua, bairro, cidade e UF; número e complemento continuam com quem digita.
  const cep = useAutoBusca(dados.cep, 8, buscarCep, (r) => alterar({ logradouro: r.logradouro || dados.logradouro, bairro: r.bairro || dados.bairro, cidade: r.cidade, uf: r.uf }));
  const emp = dados.enderecoEmpresa;
  return <div className="space-y-4">
    <Secao titulo="Quando, quantos e onde" descricao="Pax, horário e endereço nunca são deduzidos: confira com o cliente." />
    <Campo label="Nome do evento"><input className={campo} value={dados.titulo} onChange={(e) => alterar({ titulo: e.target.value })} /></Campo>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Campo label="Data" critico className="col-span-2 sm:col-span-1"><input type="date" required className={campo} value={dados.dataEvento} onChange={(e) => alterar({ dataEvento: e.target.value })} /></Campo>
      <Campo label="Pax exato" critico className="col-span-2 sm:col-span-1"><input type="number" min={1} inputMode="numeric" required className={campo} value={dados.pax} onChange={(e) => alterar({ pax: e.target.value })} /></Campo>
      <Campo label="Início" critico><input type="time" required className={campo} value={dados.inicio} onChange={(e) => alterar({ inicio: e.target.value })} /></Campo>
      <Campo label="Fim" critico><input type="time" required className={campo} value={dados.fim} onChange={(e) => alterar({ fim: e.target.value })} /></Campo>
    </div>
    <details open={!!dados.dataFim}><summary className="cursor-pointer text-xs text-muted-foreground">Evento de mais de um dia?</summary>
      <Campo label="Último dia" className="mt-2 max-w-48"><input type="date" min={dados.dataEvento} className={campo} value={dados.dataFim} onChange={(e) => alterar({ dataFim: e.target.value })} /></Campo>
    </details>
    {fixos.endereco
      ? <div className="space-y-2"><Aviso tom="ok" titulo="Endereço fixo do cliente — preenchido pelo sistema" itens={[fixos.endereco]} />
          <Campo label="Sala / andar (opcional)"><input className={campo} value={dados.complemento} onChange={(e) => alterar({ complemento: e.target.value })} /></Campo></div>
      : <fieldset className="space-y-3"><legend className="flex items-center gap-1 text-sm font-semibold"><MapPin className="h-4 w-4" />Endereço completo
          <span className="ml-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-800 dark:text-amber-300">obrigatório</span></legend>
          {emp && <Button variant="outline" className="h-auto w-full justify-start whitespace-normal py-2 text-left text-xs" onClick={() => alterar({ cep: emp.cep, logradouro: emp.logradouro, numero: emp.numero, complemento: emp.complemento, bairro: emp.bairro, cidade: emp.cidade, uf: emp.uf })}>
            <MapPin className="h-4 w-4 shrink-0" />O evento é na empresa? Usar {emp.logradouro}, {emp.numero} — {emp.bairro}, {emp.cidade}/{emp.uf}</Button>}
          <div className="grid grid-cols-6 gap-3">
            <Campo label="CEP" className="col-span-3 sm:col-span-2"><input inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" className={campo} value={dados.cep} onChange={(e) => alterar({ cep: mascaraCep(e.target.value) })} /></Campo>
            <p className="col-span-3 self-end pb-3 text-[11px] text-muted-foreground sm:col-span-4" role={cep.erro ? "alert" : "status"}>{cep.buscando ? "Buscando endereço…" : cep.erro || "Digite o CEP: rua, bairro e cidade vêm sozinhos."}</p>
            <Campo label="Rua / avenida" className="col-span-6 sm:col-span-4"><input autoComplete="address-line1" className={campo} value={dados.logradouro} onChange={(e) => alterar({ logradouro: e.target.value })} /></Campo>
            <Campo label="Número" className="col-span-2"><input className={campo} value={dados.numero} onChange={(e) => alterar({ numero: e.target.value })} /></Campo>
            <Campo label="Complemento (sala, andar)" className="col-span-4 sm:col-span-2"><input autoComplete="address-line2" className={campo} value={dados.complemento} onChange={(e) => alterar({ complemento: e.target.value })} /></Campo>
            <Campo label="Bairro" className="col-span-6 sm:col-span-2"><input className={campo} value={dados.bairro} onChange={(e) => alterar({ bairro: e.target.value })} /></Campo>
            <Campo label="Cidade" className="col-span-4 sm:col-span-1"><input autoComplete="address-level2" className={campo} value={dados.cidade} onChange={(e) => alterar({ cidade: e.target.value })} /></Campo>
            <Campo label="UF" className="col-span-2 sm:col-span-1"><input maxLength={2} autoComplete="address-level1" className={campo} value={dados.uf} onChange={(e) => alterar({ uf: e.target.value.toUpperCase() })} /></Campo>
          </div></fieldset>}
    {!pedirContato || fixos.contato
      ? <p className="text-xs text-muted-foreground">Contato: {dados.contatoNome || fixos.contato}{fixos.contato ? " (regra do cliente)" : ""}</p>
      : <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Contato do evento" critico><input className={campo} value={dados.contatoNome} onChange={(e) => alterar({ contatoNome: e.target.value })} /></Campo>
          <Campo label="Telefone (opcional)"><input type="tel" className={campo} inputMode="tel" autoComplete="tel" placeholder="(11) 90000-0000" value={dados.contatoTelefone} onChange={(e) => alterar({ contatoTelefone: mascaraTelefone(e.target.value) })} /></Campo>
        </div>}
  </div>;
}

function Resumo({ dados, fixos, sugestao, servicos, restricoes, veValores, admin, confirmado, setConfirmado }: {
  dados: Dados; fixos: FixosCliente; sugestao: Sugestao | null; servicos: ServicoForm[]; restricoes: Restricoes; veValores: boolean; admin: boolean;
  confirmado: boolean; setConfirmado: (v: boolean) => void;
}) {
  if (!sugestao) return <p role="status" className="text-sm text-muted-foreground">Calculando o resumo…</p>;
  const o = sugestao.orcamento;
  const bloqueios = impedimentos(sugestao);
  const restritos = restricoes.itens.reduce((a, i) => a + i.quantidade, 0);
  return <div className="space-y-4">
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      {([["Cliente", dados.clienteNome], ["Pax", dados.pax], ["Data e horário", `${dados.dataEvento.split("-").reverse().join("/")}${dados.dataFim ? ` a ${dados.dataFim.split("-").reverse().join("/")}` : ""} · ${dados.inicio}–${dados.fim}`],
        ["Endereço", sugestao.cabecalho.endereco], ["Contato", sugestao.cabecalho.contato], ["Restrições", restritos ? `${restritos} (${restricoes.cobranca === "PAGO" ? "incluídas no valor" : "cortesia"})` : "Nenhuma"],
        ...(fixos.tabela || sugestao.cabecalho.tabela ? [["Tabela", sugestao.cabecalho.tabela || fixos.tabela!]] : [])] as Array<[string, string]>).map(([n, v]) =>
        <div key={n} className="rounded-lg bg-muted/40 p-3"><dt className="text-[10px] font-bold uppercase text-muted-foreground">{n}</dt><dd className="mt-1 font-medium">{v}</dd></div>)}
    </dl>
    <section><h3 className="text-sm font-semibold">Cardápio</h3>
      {sugestao.servicos.map((s, i) => <details key={s.id} className="mt-2 rounded-lg border p-3" open={sugestao.servicos.length === 1}>
        <summary className="cursor-pointer text-sm font-medium">{servicos[i]?.descritivo || s.nome} · {servicos[i]?.pax} pax · {servicos[i]?.horarioInicio}–{servicos[i]?.horarioFim}{s.comReposicao ? " · com reposição" : ""}</summary>
        <ul className="mt-2 space-y-1 text-xs">{s.itens.map((it, k) => <li key={k}>{it.receita} — {it.quantidadeTexto ?? `${it.quantidade.toLocaleString("pt-BR")} ${it.unidade.toLowerCase()}`}</li>)}</ul>
      </details>)}
    </section>
    {veValores && o && <section className="rounded-xl border p-3"><h3 className="text-sm font-semibold">Valores</h3>
      <table className="mt-2 w-full text-sm"><tbody>{o.linhas.map((l, k) => <tr key={k} className="border-b last:border-0"><td className="py-1.5">{l.descritivo}</td><td className="text-right text-xs text-muted-foreground">{l.pax ?? ""}</td><td className="py-1.5 text-right tabular-nums">{l.valorCentavos === null ? "—" : reais(l.valorCentavos)}</td></tr>)}</tbody></table>
      <p className="mt-2 flex justify-between border-t pt-2 font-semibold"><span>Total</span><span>{reais(o.totalCentavos)}</span></p>
      {o.cmv !== null && <p className="mt-1 text-xs text-muted-foreground">CMV estimado {(o.cmv * 100).toFixed(1)}% (interno — nunca vai para o cliente)</p>}
    </section>}
    {!!bloqueios.length && <Aviso tom="bloqueio" titulo={admin && !sugestao.regrasFaltando.length ? "Bloqueios — como diretoria, você pode liberar confirmando" : "Não é possível gerar a proposta"} itens={bloqueios} />}
    {!!sugestao.avisos.length && <Aviso tom="atencao" titulo="Atenção" itens={sugestao.avisos} />}
    {!!sugestao.regrasPendentes.length && <Aviso tom="info" titulo="Regras com decisão pendente" itens={sugestao.regrasPendentes.map((p) => p.titulo)} />}
    <label className="flex items-start gap-3 rounded-xl border-2 border-primary/30 bg-primary/5 p-4 text-sm">
      <input type="checkbox" className="mt-0.5 h-5 w-5" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />
      <span>Conferi <strong>pax, horário, endereço, cardápio e valores</strong> com o cliente.</span>
    </label>
  </div>;
}

function Concluido({ evento, total, onVer }: { evento: Evento; total: number | null; onVer: () => void }) {
  const [erro, setErro] = useState("");
  return <div className="space-y-4 text-center">
    <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-700"><Check className="h-7 w-7" /></span>
    <h3 className="text-lg font-semibold">Proposta gerada e aprovada</h3>
    {total !== null && <p className="text-sm text-muted-foreground">Total {reais(total)}</p>}
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
      <Button className="h-12" onClick={() => { baixarArquivo(urlDocumento(evento.id, "proposta"), "proposta.pptx").catch((e: unknown) => setErro(mensagem(e))); }}><Download className="h-4 w-4" />Baixar proposta (.pptx)</Button>
      <Button variant="outline" className="h-12" onClick={onVer}>Ver o evento</Button>
    </div>
    <p className="text-xs text-muted-foreground">Próximo passo: registrado o contrato, a programação é gerada sozinha; aprovada, libera comanda, plaquinha e compras.{" "}
      <Link className="font-semibold text-primary underline" to={`/operacao?evento=${evento.id}&aba=contrato`}>Registrar contrato assinado</Link></p>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
  </div>;
}
