import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { api, baixarArquivo } from "@/lib/api";
import { campoOperacao } from "./ProgramacaoEditor";
import type { EventoOperacao, Programacao } from "@/lib/operacao";

type Linha={indice:number;nome:string;unidade:string;programado:number;remanescentes:number;retorno:number;descarte:number};
interface Dados {balanco:{revisao:number;linhas:Linha[];recebedor:string;observacoes:string}|null;termos:{id:string;revisao_balanco:number;assinado_em:string}[]}
export function Balanco({evento,programacao,editar,atualizar}:{evento:EventoOperacao;programacao:Programacao;editar:boolean;atualizar:()=>Promise<void>}) {
  const [fonte]=useState(programacao);
  const [dados,setDados]=useState<Dados|null>(null);const [linhas,setLinhas]=useState<Linha[]>([]);const [recebedor,setRecebedor]=useState("");const [obs,setObs]=useState("");const [erro,setErro]=useState("");const [ocupado,setOcupado]=useState(false);const [dirty,setDirty]=useState(false);const [pronto,setPronto]=useState(false);
  const carregar=useCallback(async()=>{
    try {
      const d=await api<Dados>(`/api/v1/operacao/balanco?eventoId=${evento.id}`);setDados(d);setLinhas(d.balanco?.linhas ?? fonte.itens.flatMap((i,indice)=>i.setor!=="ESTRUTURA"?[{indice,nome:i.nome,unidade:i.unidade,programado:i.quantidade,remanescentes:0,retorno:0,descarte:0}]:[]));setRecebedor(d.balanco?.recebedor ?? "");setObs(d.balanco?.observacoes ?? "");setDirty(false);setPronto(true);setErro("");
    }catch(e){setErro(e instanceof Error?e.message:"Falha ao consultar balanço.");}
  },[evento.id,fonte.itens]);
  // Load the persisted operational record; never default a completed checklist.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{void carregar();},[carregar]);
  const remanescentes=linhas.some(l=>l.remanescentes>0);const termo=dados?.termos.find(t=>t.revisao_balanco===dados.balanco?.revisao);
  async function salvar() {
    setOcupado(true);setErro("");
    try {await api("/api/v1/operacao/balanco",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({eventoId:evento.id,revisao:evento.revisao,balancoRevisao:dados?.balanco?.revisao ?? 0,linhas:linhas.map(({indice,remanescentes,retorno,descarte})=>({indice,remanescentes,retorno,descarte})),recebedor,observacoes:obs})});await atualizar();await carregar();}
    catch(e){setErro(e instanceof Error?e.message:"Falha ao salvar balanço. Atualize antes de repetir.");}finally{setOcupado(false);}
  }
  async function anexar(form:HTMLFormElement) {
    setOcupado(true);setErro("");
    try{const f=new FormData(form);const data=f.get("data");f.delete("data");f.set("eventoId",evento.id);f.set("revisao",String(evento.revisao));f.set("balancoRevisao",String(dados?.balanco?.revisao));f.set("assinadoEm",new Date(data as string).toISOString());await api("/api/v1/operacao/balanco",{method:"POST",body:f});await atualizar();await carregar();form.reset();}catch(e){setErro(e instanceof Error?e.message:"Falha ao anexar termo.");}finally{setOcupado(false);}
  }
  const podeEditar=editar && evento.etapa_operacao==="EM_CAMPO" && pronto && !ocupado;
  function quantidade(indice:number,campo:"remanescentes"|"retorno"|"descarte",valor:string){setDirty(true);setLinhas(a=>a.map(l=>l.indice===indice?{...l,[campo]:valor===""?0:Number(valor)}:l));}
  return <section className="space-y-5 rounded-xl border bg-card p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-lg font-semibold">Consumo, sobras e descarte</h3><p className="mt-1 text-sm text-muted-foreground">Confira item a item. Não preencha automaticamente como consumido: confirme as quantidades físicas antes de salvar.</p></div><Button variant="outline" disabled={ocupado} onClick={()=>{if(!dirty || window.confirm("Descartar alterações e carregar o balanço salvo?")) void carregar();}}>Atualizar balanço</Button></div>
    {linhas.map(l=><article key={l.indice} className="rounded-lg border p-4"><div className="flex flex-wrap justify-between gap-2"><h4 className="font-semibold">{l.nome}</h4><span className="text-sm text-primary">Programado: {l.programado} {l.unidade}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{([['remanescentes','Entregue ao cliente'],['retorno','Retornou à Pieggi'],['descarte','Descarte']] as const).map(([campo,label])=><label key={campo} className="text-sm">{label} ({l.unidade})<input type="number" min="0" max={l.programado} step={l.unidade==="UN"?1:0.001} className={campoOperacao} value={l[campo]} disabled={!podeEditar} onChange={e=>quantidade(l.indice,campo,e.target.value)}/></label>)}</div><p className={`mt-3 text-sm ${l.programado-l.remanescentes-l.retorno-l.descarte<0?"text-destructive":"text-muted-foreground"}`}>Consumo calculado: {Number((l.programado-l.remanescentes-l.retorno-l.descarte).toFixed(3))} {l.unidade}</p></article>)}
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Quem recebeu os remanescentes?<input value={recebedor} maxLength={200} className={campoOperacao} disabled={!podeEditar} onChange={e=>{setRecebedor(e.target.value);setDirty(true);}}/></label><label className="text-sm">Observações da conferência<textarea value={obs} maxLength={3000} rows={3} className={campoOperacao} disabled={!podeEditar} onChange={e=>{setObs(e.target.value);setDirty(true);}}/></label></div>
    {editar && evento.etapa_operacao==="EM_CAMPO" && <Button disabled={!podeEditar || (!dirty && !!dados?.balanco)} onClick={()=>{if(window.confirm("Confirmar estas quantidades conferidas? Se houver termo anterior, uma nova revisão exigirá nova assinatura.")) void salvar();}}>Confirmar e salvar balanço</Button>}
    {dados?.balanco && remanescentes && <div className="space-y-4 rounded-lg bg-muted p-4"><p className="text-sm">{termo?`Termo assinado anexado à revisão ${dados.balanco.revisao}.`:"Remanescentes exigem o termo assinado antes de encerrar o evento. Confira o nome e as quantidades antes de colher a assinatura."}</p><Button variant="outline" disabled={dirty || ocupado} onClick={()=>{void baixarArquivo(`/api/v1/operacao/balanco?eventoId=${evento.id}&documento=termo`,"termo-remanescentes.docx").catch(e=>setErro(e instanceof Error?e.message:"Falha no download."));}}>Baixar termo para assinatura</Button>{termo && <Button variant="outline" onClick={()=>{void baixarArquivo(`/api/v1/operacao/balanco?eventoId=${evento.id}&documento=assinado&termoId=${termo.id}`,"termo-assinado.pdf").catch(e=>setErro(e instanceof Error?e.message:"Falha no download."));}}>Baixar PDF assinado</Button>}
      {!termo && podeEditar && <form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();void anexar(e.currentTarget);}}><label className="text-sm">PDF assinado · até 8 MB<input type="file" name="arquivo" accept="application/pdf" required className={campoOperacao}/></label><label className="text-sm">Data e hora da assinatura<input type="datetime-local" name="data" required className={campoOperacao}/></label><label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" required/>Conferi que o PDF contém a assinatura do recebedor e os itens desta revisão.</label><Button type="submit" disabled={dirty || ocupado}>Anexar termo assinado</Button></form>}
    </div>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
  </section>;
}
