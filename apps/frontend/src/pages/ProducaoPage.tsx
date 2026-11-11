import { useCallback, useEffect, useRef, useState } from "react";
import { useAoMudar } from "@/lib/aovivo";
import { useSearchParams } from "react-router-dom";
import { Check, ChefHat, Expand, RefreshCw, Search, Timer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/auth";
import { api } from "@/lib/api";
import { campoOperacao } from "@/components/operacao/ProgramacaoEditor";
import { rotulo, setores } from "@/lib/operacao";

interface Linha { id:string; evento_id:string; programacao_id:string; setor:string; titulo:string; descricao:string; quantidade:number; unidade:string; estado:string; atualizado_em:string; programacoes:{versao:number; status:string; saida_em:string}; eventos:{titulo:string; revisao:number; etapa_operacao:string} }
const diaSP=(data:string)=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(data));
export function ProducaoPage() {
  const {usuario}=useAuth(); const empresa=usuario?.empresas[0]; const [params,setParams]=useSearchParams();
  const [linhas,setLinhas]=useState<Linha[]>([]); const [erro,setErro]=useState(""); const [carregando,setCarregando]=useState(true);
  const [ocupado,setOcupado]=useState(false); const [busca,setBusca]=useState(""); const [pendentes,setPendentes]=useState(true); const [agora,setAgora]=useState(()=>Date.now());
  const [atualizado,setAtualizado]=useState(0); const [mudancas,setMudancas]=useState<string[]>([]); const versoes=useRef(new Map<string,string>()); const emCurso=useRef(false);
  const setor=params.get("setor") ?? "COZINHA_QUENTE"; const periodo=params.get("dia") ?? "HOJE";
  const carregar=useCallback(async()=>{
    if(!empresa) { setErro("Seu acesso não possui empresa vinculada."); setCarregando(false); return; }
    if(emCurso.current) return; emCurso.current=true;
    try {
      const lista=await api<Linha[]>(`/api/v1/operacao/producao?empresaId=${empresa}`);
      const mapa=new Map(lista.map(l=>[l.evento_id,l.programacao_id]));
      const alterados=[...mapa].filter(([evento,versao])=>versoes.current.has(evento) && versoes.current.get(evento)!==versao).map(([id])=>id);
      setMudancas(anteriores=>[...new Set([...anteriores,...alterados])]);
      for (const [id,versao] of mapa) versoes.current.set(id,versao);
      setLinhas(lista); setAtualizado(Date.now()); setErro("");
    } catch(e) { setErro(e instanceof Error?e.message:"Não foi possível carregar a produção."); }
    finally { emCurso.current=false; setCarregando(false); }
  },[empresa]);
  // Remote read and periodic clock update for unattended kitchen screens.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{void carregar();},[carregar]);
  useEffect(()=>{const timer=window.setInterval(()=>setAgora(Date.now()),15000);return()=>clearInterval(timer);},[]);
  useAoMudar(carregar, ocupado);
  async function avancar(linha:Linha) {
    setOcupado(true); setErro("");
    try { await api(`/api/v1/eventos/${linha.evento_id}/operacao`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({revisao:linha.eventos.revisao,comando:{acao:"TAREFA_ATUALIZAR",dados:{id:linha.id,estado:linha.estado==="PENDENTE"?"EM_ANDAMENTO":"PRONTO"}}})}); await carregar(); }
    catch(e) { await carregar(); setErro(e instanceof Error?e.message:"Não foi possível registrar a produção."); }
    finally {setOcupado(false);}
  }
  const hoje=diaSP(new Date(agora).toISOString()); const amanha=diaSP(new Date(agora+86400000).toISOString());
  const dia=periodo==="AMANHA"?amanha:hoje;
  const visiveis=linhas.filter(l=>l.setor===setor && (periodo==="TODOS" || diaSP(l.programacoes.saida_em)===dia) && (!pendentes || l.estado!=="PRONTO") && `${l.titulo} ${l.eventos.titulo} ${l.descricao}`.toLowerCase().includes(busca.toLowerCase())).sort((a,b)=>a.programacoes.saida_em.localeCompare(b.programacoes.saida_em)||a.titulo.localeCompare(b.titulo));
  const permitido=usuario?.papeis.some(p=>["ADMIN","PRODUCAO"].includes(p));
  return <div className="space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-primary">Estação de produção</p><h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold"><ChefHat size={30}/>{rotulo(setor)}</h1><p className="mt-2 text-sm text-muted-foreground">Receitas da versão aprovada, na ordem de saída.</p></div><div className="flex gap-2"><Button variant="outline" onClick={()=>{void carregar();}} disabled={ocupado}><RefreshCw size={16}/>Atualizar</Button><Button variant="outline" onClick={()=>{void (document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()).catch(()=>setErro("O navegador não permitiu tela cheia."));}}><Expand size={16}/>Tela cheia</Button></div></header>
    <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-sm">Estação<select className={campoOperacao} value={setor} onChange={e=>setParams({setor:e.target.value,dia:periodo})}>{setores.filter(s=>!["A_CLASSIFICAR","ESTRUTURA","FORNECEDOR"].includes(s)).map(s=><option key={s} value={s}>{rotulo(s)}</option>)}</select></label>
      <label className="text-sm">Saída<select className={campoOperacao} value={periodo} onChange={e=>setParams({setor,dia:e.target.value})}><option value="HOJE">Hoje</option><option value="AMANHA">Amanhã</option><option value="TODOS">Todos os dias</option></select></label>
      <label className="text-sm">Buscar item ou evento<div className="relative"><Search className="absolute left-3 top-3 text-muted-foreground" size={16}/><input className={`${campoOperacao} pl-9`} value={busca} onChange={e=>setBusca(e.target.value)}/></div></label>
      <label className="flex items-center gap-2 self-end py-3 text-sm"><input type="checkbox" checked={pendentes} onChange={e=>setPendentes(e.target.checked)}/>Somente pendentes</label>
    </div>
    {erro && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">{erro}{atualizado>0 && " Os dados exibidos podem estar desatualizados; aguarde a reconexão."}</p>}
    {!!mudancas.length && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4"><p className="text-sm">Programações revisadas. Confira os itens destacados antes de continuar.</p><Button variant="outline" onClick={()=>setMudancas([])}>Conferi as alterações</Button></div>}
    <div className="flex justify-between text-sm text-muted-foreground"><span>{carregando?"Carregando…":`${visiveis.length} itens nesta estação`}</span><span role="status">{atualizado?`Atualizado às ${new Date(atualizado).toLocaleTimeString("pt-BR")}`:"Conectando"} · atualização a cada 15s</span></div>
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{visiveis.map(l=><article key={l.id} className={`flex flex-col gap-4 rounded-xl border bg-card p-5 ${mudancas.includes(l.evento_id)?"border-warning ring-2 ring-warning/30":""}`}>
      <div className="flex flex-wrap justify-between gap-2"><span className="rounded bg-primary/10 px-2 py-1 text-sm font-semibold text-primary"><Timer className="mr-1 inline" size={15}/>Saída {new Date(l.programacoes.saida_em).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span><span className="text-xs text-muted-foreground">v{l.programacoes.versao} · {rotulo(l.estado)}</span></div>
      {mudancas.includes(l.evento_id) && <p className="text-sm font-semibold text-warning">Programação alterada. Confira a nova receita e quantidade.</p>}
      <div><p className="text-sm text-primary">{l.eventos.titulo}</p><h2 className="mt-2 text-2xl font-semibold">{l.quantidade} {l.unidade} · {l.titulo}</h2></div><p className="flex-1 whitespace-pre-wrap text-base leading-relaxed">{l.descricao}</p>
      {l.estado==="PRONTO"?<p className="flex items-center gap-2 text-success"><Check size={18}/>Produção concluída</p>:permitido && <Button disabled={ocupado || !!erro} className="h-12 text-base" onClick={()=>{void avancar(l);}}>{l.estado==="PENDENTE"?"Iniciar produção":"Marcar pronto"}</Button>}
    </article>)}</div>
    {!carregando && !erro && !visiveis.length && <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">Nenhum item pendente para esta seleção.</div>}
  </div>;
}
