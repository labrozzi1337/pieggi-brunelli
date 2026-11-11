import { CircleAlert, CopyPlus, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, criarDocumento, emitirDocumento, listarProdutos, validarDocumento, type DocumentoFiscal, type ProdutoFiscal } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { buscarCep, buscarCnpj, mascaraCep, mascaraCpfCnpj, type Endereco } from "@/lib/mascaras";
import { useAutoBusca } from "@/lib/useAutoBusca";

interface ItemFormulario {
  produtoId: string; sku: string; descricao: string; ncm: string; cfop: string; unidade: string; quantidade: number;
  valorUnitario: number; desconto: number; origem: string; cst: string; aliquotaIcms: number; cBenef: string;
  cstPis: string; aliquotaPis: number; cstCofins: string; aliquotaCofins: number; cClassTrib: string;
}

const itemVazio = (): ItemFormulario => ({ produtoId: "", sku: "", descricao: "", ncm: "", cfop: "5102", unidade: "UN", quantidade: 1, valorUnitario: 0, desconto: 0, origem: "0", cst: "90", aliquotaIcms: 4, cBenef: "", cstPis: "01", aliquotaPis: 0.65, cstCofins: "01", aliquotaCofins: 3, cClassTrib: "000001" });

/** Tributação vem do catálogo fiscal (planilha da contabilidade). */
const itemDoProduto = (item: ItemFormulario, p: ProdutoFiscal): ItemFormulario => ({ ...item, produtoId: p.id, sku: p.codigo, descricao: p.descricao, ncm: p.ncm, cfop: p.cfop, unidade: p.unidade,
  valorUnitario: p.precoVenda ?? 0, origem: p.origem, cst: p.cstIcms ?? "90", aliquotaIcms: p.aliquotaIcms ?? 0, cBenef: p.cBenef ?? "", cstPis: p.cstPis ?? "99",
  aliquotaPis: p.aliquotaPis ?? 0, cstCofins: p.cstCofins ?? "99", aliquotaCofins: p.aliquotaCofins ?? 0 });

interface NotaDoEvento { destinatario: { cpfCnpj: string; nome: string }; informacoes: string; itens: Array<{ produtoId: string; quantidade: number }>; semProduto: string[]; programacaoVersao: number | null; valorProposta: number | null }

/** Cria, valida e transmite uma NF-e real no ambiente de homologação. */
export function NovaNotaFiscalPage() {
  const { usuario } = useAuth();
  const empresaId = usuario?.empresas[0];
  const podeEmitir = usuario?.papeis.some((papel) => ["ADMIN", "FINANCEIRO"].includes(papel));
  const [produtos, setProdutos] = useState<ProdutoFiscal[]>([]);
  const [itens, setItens] = useState<ItemFormulario[]>([itemVazio()]);
  const [destinatario, setDestinatario] = useState({ cpfCnpj: "", nome: "", indicadorIe: "9", ie: "", logradouro: "", numero: "", bairro: "", codigoMunicipioIbge: "3550308", municipio: "São Paulo", uf: "SP", cep: "" });
  const [informacoes, setInformacoes] = useState("NF-e emitida em ambiente de homologação.");
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [resultado, setResultado] = useState<DocumentoFiscal | null>(null);
  const total = useMemo(() => itens.reduce((soma, item) => soma + item.quantidade * item.valorUnitario - item.desconto, 0), [itens]);

  // Vindo de um evento (?evento=): destinatário do cadastro do cliente (o CNPJ completa o endereço) e itens da
  // programação aprovada já ligados ao catálogo fiscal da planilha da contabilidade.
  const [busca] = useSearchParams();
  const eventoId = busca.get("evento");
  const [doEvento, setDoEvento] = useState<NotaDoEvento | null>(null);
  useEffect(() => {
    if (!empresaId || !podeEmitir) return;
    let vigente = true;
    Promise.all([listarProdutos(empresaId), eventoId ? api<NotaDoEvento>(`/api/v1/eventos/${eventoId}/nota-fiscal`) : Promise.resolve(null)]).then(([catalogo, nota]) => {
      if (!vigente) return;
      setProdutos(catalogo);
      if (!nota) return;
      setDoEvento(nota);
      setDestinatario((d) => ({ ...d, cpfCnpj: mascaraCpfCnpj(nota.destinatario.cpfCnpj), nome: nota.destinatario.nome }));
      setInformacoes(nota.informacoes);
      const sugeridos = nota.itens.flatMap(({ produtoId, quantidade }) => { const p = catalogo.find((x) => x.id === produtoId); return p ? [{ ...itemDoProduto(itemVazio(), p), quantidade }] : []; });
      if (sugeridos.length) setItens(sugeridos);
    }).catch((erro: Error) => { if (vigente) setMensagem(erro.message); });
    return () => { vigente = false; };
  }, [empresaId, podeEmitir, eventoId]);
  const comEndereco = (en: Endereco) => setDestinatario((d) => ({ ...d, cep: en.cep || d.cep, logradouro: en.logradouro || d.logradouro, numero: en.numero || d.numero, bairro: en.bairro || d.bairro,
    municipio: en.cidade || d.municipio, uf: en.uf || d.uf, codigoMunicipioIbge: en.ibge || d.codigoMunicipioIbge }));
  const consultaCnpj = useAutoBusca(destinatario.cpfCnpj, 14, buscarCnpj, (emp) => { comEndereco(emp.endereco); setDestinatario((d) => ({ ...d, nome: d.nome.trim() || emp.razaoSocial })); });
  const consultaCep = useAutoBusca(destinatario.cep, 8, buscarCep, comEndereco);
  const statusConsulta = [consultaCnpj.buscando && "Consultando CNPJ…", consultaCep.buscando && "Buscando CEP…", consultaCnpj.erro, consultaCep.erro].filter(Boolean).join(" · ");

  const atualizarItem = (indice: number, campo: keyof ItemFormulario, valor: string) => setItens((atuais) => atuais.map((item, posicao) => posicao === indice ? { ...item, [campo]: ["produtoId", "sku", "descricao", "ncm", "cfop", "unidade", "origem", "cst", "cBenef", "cstPis", "cstCofins", "cClassTrib"].includes(campo) ? valor : Number(valor) } : item));
  const selecionarProduto = (indice: number, produtoId: string) => {
    const produto = produtos.find((atual) => atual.id === produtoId);
    if (!produto) return atualizarItem(indice, "produtoId", produtoId);
    setItens((atuais) => atuais.map((item, posicao) => posicao === indice ? itemDoProduto(item, produto) : item));
  };

  const enviar = async (evento: FormEvent) => {
    if (!empresaId || !podeEmitir) { evento.preventDefault(); return; }
    evento.preventDefault(); setProcessando(true); setMensagem(""); setResultado(null);
    try {
      const documento = await criarDocumento({ empresaId: empresaId, ambiente: "HOMOLOGACAO", serie: 1, naturezaOperacao: "VENDA DE MERCADORIA", destinoOperacao: "1", consumidorFinal: destinatario.indicadorIe === "9" ? "1" : "0", indicadorPresenca: "1", destinatario: { ...destinatario, indicadorIe: Number(destinatario.indicadorIe) }, itens: itens.map(({ produtoId, aliquotaIcms, cBenef, cstPis, aliquotaPis, cstCofins, aliquotaCofins, cClassTrib, ...item }) => ({ ...item, produtoId, icms: { aliquota: aliquotaIcms, ...(cBenef ? { cBenef } : {}) }, pis: { cst: cstPis, aliquota: aliquotaPis }, cofins: { cst: cstCofins, aliquota: aliquotaCofins }, cClassTrib, ibs: { cst: "000", aliquotaUf: 0.1, aliquotaMunicipio: 0 }, cbs: { aliquota: 0.9 } })), transporte: { modFrete: 9 }, pagamento: { tPag: "01", vPag: Number(total.toFixed(2)) }, informacoesAdicionais: informacoes });
      const validacao = await validarDocumento(documento.id);
      const erros = validacao.resultados.filter((item) => item.nivel === "ERRO");
      if (erros.length) throw new Error(erros.map((item) => item.mensagem).join(" "));
      const emitido = await emitirDocumento(documento.id);
      setResultado(emitido);
      setMensagem(emitido.mensagemSefaz ?? `NF-e ${emitido.status.toLowerCase()}.`);
    } catch (erro) { setMensagem(erro instanceof Error ? erro.message : "Falha ao emitir a NF-e."); }
    finally { setProcessando(false); }
  };

  if (!empresaId || !podeEmitir) return <div role="alert" className="p-8">Emissão restrita ao administrador e financeiro com empresa vinculada. <Link to="/notas-fiscais" className="underline">Voltar para notas</Link></div>;

  return <div className="min-h-full p-4 sm:p-6 lg:p-8"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Fiscal · Homologação</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Nova NF-e modelo 55</h1><p className="mt-2 text-sm text-muted-foreground">Salva, valida, assina e transmite para a SEFAZ-SP.</p></div><Link to="/notas-fiscais" className="h-10 rounded-md border px-4 py-3 text-xs font-semibold hover:bg-muted">Voltar para notas</Link></header>
    <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_300px]"><form id="nfe-form" onSubmit={(evento) => { void enviar(evento); }} className="space-y-4"><Secao titulo="Operação"><div className="grid gap-3 sm:grid-cols-2"><Campo rotulo="Empresa fiscal" valor={empresaId} somenteLeitura /><Campo rotulo="Natureza da operação" valor="Venda de mercadoria" somenteLeitura /><Campo rotulo="Ambiente" valor="Homologação" somenteLeitura /><Campo rotulo="Série" valor="1" somenteLeitura /></div></Secao>
      <Secao titulo="Destinatário"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Campo rotulo="CPF/CNPJ" valor={destinatario.cpfCnpj} onChange={(valor) => setDestinatario({ ...destinatario, cpfCnpj: mascaraCpfCnpj(valor) })} obrigatorio /><Campo rotulo="Nome / razão social" valor={destinatario.nome} onChange={(valor) => setDestinatario({ ...destinatario, nome: valor })} obrigatorio /><Selecao rotulo="Contribuinte de ICMS" valor={destinatario.indicadorIe} onChange={(valor) => setDestinatario({ ...destinatario, indicadorIe: valor })} opcoes={[{ valor: "1", texto: "Contribuinte" }, { valor: "2", texto: "Isento" }, { valor: "9", texto: "Não contribuinte" }]} /><Campo rotulo="Inscrição estadual" valor={destinatario.ie} onChange={(valor) => setDestinatario({ ...destinatario, ie: valor })} /><Campo rotulo="Logradouro" valor={destinatario.logradouro} onChange={(valor) => setDestinatario({ ...destinatario, logradouro: valor })} obrigatorio /><Campo rotulo="Número" valor={destinatario.numero} onChange={(valor) => setDestinatario({ ...destinatario, numero: valor })} obrigatorio /><Campo rotulo="Bairro" valor={destinatario.bairro} onChange={(valor) => setDestinatario({ ...destinatario, bairro: valor })} obrigatorio /><Campo rotulo="Município" valor={destinatario.municipio} onChange={(valor) => setDestinatario({ ...destinatario, municipio: valor })} obrigatorio /><Campo rotulo="Código IBGE" valor={destinatario.codigoMunicipioIbge} onChange={(valor) => setDestinatario({ ...destinatario, codigoMunicipioIbge: valor })} obrigatorio /><Campo rotulo="UF" valor={destinatario.uf} onChange={(valor) => setDestinatario({ ...destinatario, uf: valor.toUpperCase() })} obrigatorio /><Campo rotulo="CEP" valor={destinatario.cep} onChange={(valor) => setDestinatario({ ...destinatario, cep: mascaraCep(valor) })} obrigatorio /></div>
        <p role="status" className="mt-3 text-[11px] text-muted-foreground">{statusConsulta || "Digite o CNPJ (ou o CEP): nome, endereço e código IBGE são preenchidos sozinhos."}</p></Secao>
      <Secao titulo="Produtos" acao={<button type="button" onClick={() => setItens((atuais) => [...atuais, itemVazio()])} className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Plus className="h-4 w-4" />Adicionar item</button>}><div className="space-y-3">{itens.map((item, indice) => <div key={indice} className="rounded-lg border p-3"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="grid gap-1.5 text-[11px] font-medium text-muted-foreground sm:col-span-2"><span>Produto do catálogo</span><select required value={item.produtoId} onChange={(evento) => selecionarProduto(indice, evento.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm text-foreground"><option value="">Selecione…</option>{produtos.map((produto) => <option key={produto.id} value={produto.id}>{produto.codigo} · {produto.descricao}</option>)}</select></label><Campo rotulo="Quantidade" tipo="number" passo="0.0001" valor={String(item.quantidade)} onChange={(valor) => atualizarItem(indice, "quantidade", valor)} obrigatorio /><Campo rotulo="Valor unitário" tipo="number" passo="0.01" valor={String(item.valorUnitario)} onChange={(valor) => atualizarItem(indice, "valorUnitario", valor)} obrigatorio /></div><details className="mt-3 rounded-md bg-muted/40 p-3"><summary className="cursor-pointer text-xs font-semibold">Dados fiscais</summary><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Campo rotulo="NCM" valor={item.ncm} onChange={(valor) => atualizarItem(indice, "ncm", valor)} obrigatorio /><Campo rotulo="CFOP" valor={item.cfop} onChange={(valor) => atualizarItem(indice, "cfop", valor)} obrigatorio /><Campo rotulo="CST ICMS" valor={item.cst} onChange={(valor) => atualizarItem(indice, "cst", valor)} obrigatorio /><Campo rotulo="Alíquota ICMS (%)" tipo="number" passo="0.0001" valor={String(item.aliquotaIcms)} onChange={(valor) => atualizarItem(indice, "aliquotaIcms", valor)} obrigatorio /><Campo rotulo="cBenef" valor={item.cBenef} onChange={(valor) => atualizarItem(indice, "cBenef", valor)} /><Campo rotulo="cClassTrib IBS/CBS" valor={item.cClassTrib} onChange={(valor) => atualizarItem(indice, "cClassTrib", valor)} obrigatorio /></div></details><div className="mt-3 flex justify-end gap-3"><button type="button" onClick={() => setItens((atuais) => [...atuais, { ...item, produtoId: "" }])} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"><CopyPlus className="h-3.5 w-3.5" />Duplicar</button><button type="button" disabled={itens.length === 1} onClick={() => setItens((atuais) => atuais.filter((_, posicao) => posicao !== indice))} className="inline-flex items-center gap-1 text-[11px] text-destructive disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" />Remover</button></div></div>)}</div></Secao>
      <Secao titulo="Informações adicionais"><textarea value={informacoes} onChange={(evento) => setInformacoes(evento.target.value)} className="min-h-24 w-full rounded-md border bg-background p-3 text-sm" maxLength={5000} /></Secao></form>
      <aside className="h-fit space-y-3 rounded-[14px] border bg-card p-4 xl:sticky xl:top-4"><p className="eyebrow">Resumo</p><div className="flex justify-between border-b py-3 text-sm"><span className="text-muted-foreground">Produtos</span><strong>R$ {total.toFixed(2)}</strong></div><div className="flex justify-between py-3 text-base"><span>Total da NF-e</span><strong>R$ {total.toFixed(2)}</strong></div>{doEvento && <div className="space-y-2 rounded-md bg-muted/50 p-3 text-[11px] leading-5">
        <p>{doEvento.programacaoVersao ? `Itens da programação aprovada v${doEvento.programacaoVersao}, com preço e tributação da planilha da contabilidade.` : "Evento sem programação aprovada: selecione os itens."}</p>
        {doEvento.valorProposta !== null && <p className="flex justify-between"><span>Valor da proposta</span><strong>R$ {doEvento.valorProposta.toFixed(2)}</strong></p>}
        {!!doEvento.semProduto.length && <details><summary className="cursor-pointer font-semibold text-amber-700 dark:text-warning">{doEvento.semProduto.length} item(ns) sem produto fiscal</summary><ul className="mt-1 list-disc pl-4">{doEvento.semProduto.map((s, i) => <li key={i}>{s}</li>)}</ul></details>}
      </div>}<div className="rounded-md bg-warning/10 p-3 text-[11px] leading-5 text-amber-800 dark:text-warning"><CircleAlert className="mr-1 inline h-4 w-4" />Teste real no ambiente de homologação; sem valor fiscal.</div>{mensagem && <div role="status" className={`rounded-md p-3 text-xs leading-5 ${resultado?.status === "AUTORIZADO" ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive"}`}><strong>{resultado?.status}</strong>{resultado?.numero ? ` · NF-e ${resultado.numero}` : ""}<br />{mensagem}{resultado?.chaveAcesso && <><br /><span className="break-all">Chave: {resultado.chaveAcesso}</span></>}</div>}<button form="nfe-form" type="submit" disabled={processando || total <= 0} className="h-10 w-full rounded-md bg-primary text-xs font-semibold text-primary-foreground disabled:opacity-50">{processando ? "Transmitindo…" : "Salvar, validar e emitir teste"}</button></aside></div></div>;
}

function Secao({ titulo, children, acao }: { titulo: string; children: ReactNode; acao?: ReactNode }) { return <section className="rounded-[14px] border bg-card p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">{titulo}</h2>{acao}</div>{children}</section>; }
function Campo({ rotulo, valor, onChange, tipo = "text", passo, obrigatorio, somenteLeitura }: { rotulo: string; valor: string; onChange?: (valor: string) => void; tipo?: "text" | "number"; passo?: string; obrigatorio?: boolean; somenteLeitura?: boolean }) { return <label className="grid gap-1.5 text-[11px] font-medium text-muted-foreground"><span>{rotulo}</span><input required={obrigatorio} readOnly={somenteLeitura} type={tipo} step={passo} value={valor} onChange={(evento) => onChange?.(evento.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm text-foreground outline-none read-only:bg-muted focus:ring-2 focus:ring-ring" /></label>; }
function Selecao({ rotulo, valor, onChange, opcoes }: { rotulo: string; valor: string; onChange: (valor: string) => void; opcoes: Array<{ valor: string; texto: string }> }) { return <label className="grid gap-1.5 text-[11px] font-medium text-muted-foreground"><span>{rotulo}</span><select value={valor} onChange={(evento) => onChange(evento.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm text-foreground">{opcoes.map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.texto}</option>)}</select></label>; }
