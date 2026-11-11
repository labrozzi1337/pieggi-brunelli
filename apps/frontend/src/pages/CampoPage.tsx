import { useCallback, useEffect, useState } from "react";
import { Camera, Check, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { campoOperacao } from "@/components/operacao/ProgramacaoEditor";
import { rotulo } from "@/lib/operacao";

interface Campo {
  responsavel:string; expiraEm:string;
  evento:{id:string; titulo:string; revisao:number; etapa:string; data:string; inicio:string; fim:string; pax:number; logradouro:string; numero:string; complemento:string; bairro:string; cidade:string; uf:string; contato:string; telefone:string};
  programacao:{id:string; versao:number; alteracoes:string; saidaEm:string; itens:{nome:string; quantidade:number; unidade:string; servico:string; receita:string}[]}|null;
  tarefas:{id:string; titulo:string; estado:string; atualizadoEm:string}[];
  etapas:{id:string;ordem:number;tipo:string;titulo:string;orientacao:string;previstoEm:string;concluidoEm:string|null;observacao:string|null}[];
}
export function CampoPage() {
  // Fragment stays out of HTTP URLs and server access logs. Never persist this credential.
  const [token]=useState(()=>window.location.hash.slice(1));
  const [dados,setDados]=useState<Campo|null>(null); const [erro,setErro]=useState(""); const [ocupado,setOcupado]=useState(false); const [carregando,setCarregando]=useState(true);
  const carregar=useCallback(async()=>{
    try {setDados(await api<Campo>("/api/v1/campo",{headers:{"X-Pieggi-Campo":token}},false));setErro("");}
    catch(e){setDados(null);setErro(e instanceof Error?e.message:"Não foi possível abrir o evento.");}
    finally{setCarregando(false);}
  },[token]);
  // Remote data, not derived render state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{void carregar();},[carregar]);
  useEffect(()=>{const timer=window.setInterval(()=>{if(!ocupado) void carregar();},30000);return()=>clearInterval(timer);},[carregar,ocupado]);
  async function enviar(tarefaId:string,foto:File) {
    if(!dados) return; setOcupado(true);setErro("");
    const form=new FormData();form.set("foto",foto);form.set("tarefaId",tarefaId);form.set("revisao",String(dados.evento.revisao));
    try {await api("/api/v1/campo",{method:"POST",headers:{"X-Pieggi-Campo":token},body:form},false);await carregar();}
    catch(e){await carregar();setErro(e instanceof Error?e.message:"Não foi possível registrar a foto. Atualize antes de repetir.");throw e;}
    finally{setOcupado(false);}
  }
  async function concluir(etapaId:string,observacao:string){
    if(!dados)return;setOcupado(true);setErro("");
    try{await api("/api/v1/campo",{method:"PATCH",headers:{"X-Pieggi-Campo":token,"Content-Type":"application/json"},body:JSON.stringify({etapaId,revisao:dados.evento.revisao,observacao})},false);await carregar();}
    catch(e){await carregar();setErro(e instanceof Error?e.message:"Não foi possível confirmar a etapa.");throw e;}finally{setOcupado(false);}
  }
  const primeira=dados?.tarefas.find(t=>t.estado!=="PRONTO")?.id;
  const primeiraEtapa=dados?.etapas.find(t=>!t.concluidoEm)?.id;
  return <main className="mx-auto min-h-screen max-w-3xl space-y-5 p-4 pb-12 sm:p-6">
    <header className="flex items-center justify-between gap-3 rounded-xl border bg-card p-5"><div><p className="text-xs uppercase tracking-widest text-primary">Pieggi · equipe de campo</p><h1 className="mt-2 text-2xl font-semibold">{dados?.evento.titulo ?? "Seu evento"}</h1></div><Button aria-label="Atualizar evento" variant="outline" disabled={ocupado} onClick={()=>{void carregar();}}><RefreshCw size={18}/></Button></header>
    {erro && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">{erro}</p>}
    {carregando && <p role="status">Abrindo o evento…</p>}
    {dados && <>
      <section className="rounded-xl border bg-card p-5"><p className="text-sm text-primary">Líder: {dados.responsavel} · {dados.evento.pax} pessoas</p><p className="mt-3 flex gap-2 text-sm"><MapPin size={18}/>{dados.evento.logradouro}, {dados.evento.numero} {dados.evento.complemento} · {dados.evento.bairro} · {dados.evento.cidade}/{dados.evento.uf}</p><p className="mt-3 text-sm">Evento: {dados.evento.inicio?.slice(0,5)}–{dados.evento.fim?.slice(0,5)}</p><p className="mt-2 text-sm">Contato no local: {dados.evento.contato} {dados.evento.telefone && <a className="text-primary underline" href={`tel:${dados.evento.telefone.replace(/[^+0-9]/g,"")}`}>{dados.evento.telefone}</a>}</p><p className="mt-3 text-xs text-muted-foreground">Link válido somente hoje, até {new Date(dados.expiraEm).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}. Não compartilhe fora da equipe.</p></section>
      {dados.evento.etapa!=="EM_CAMPO" && <p role="status" className="rounded-lg bg-warning/10 p-4 text-sm">{dados.evento.etapa==="ENTREGUE"?"Evento encerrado. Obrigado pela entrega!":"Aguardando a liberação de saída pela expedição. As fotos serão liberadas depois da conferência."}</p>}
      {!dados.programacao?<p role="alert" className="rounded-lg bg-warning/10 p-4">Programação bloqueada para revisão. Aguarde a nova aprovação.</p>:<details className="rounded-xl border bg-card p-5"><summary className="cursor-pointer font-semibold">Programação v{dados.programacao.versao} · conferir itens</summary><p className="my-4 rounded-lg bg-muted p-3 text-sm">{dados.programacao.alteracoes}</p><div className="grid gap-3 sm:grid-cols-2">{dados.programacao.itens.map((item,i)=><article key={i} className="rounded-lg border p-4"><p className="text-xs text-primary">{item.servico}</p><h2 className="mt-2 font-semibold">{item.quantidade} {item.unidade} · {item.nome}</h2><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.receita}</p></article>)}</div></details>}
      {dados.programacao && !dados.etapas.length && <p role="alert" className="rounded-lg bg-warning/10 p-4 text-sm">Esta versão é anterior ao roteiro digital. Solicite a revisão da programação; não invente a ordem ou os horários no local.</p>}
      <div className="space-y-4">{dados.tarefas.map((t,i)=>{
        const fase=(["","MONTAGEM","REPOSICAO","DESMONTAGEM"] as const)[i];const etapas=dados.etapas.filter(e=>e.tipo===fase);const fotoAnterior=dados.tarefas[i-1]?.estado==="PRONTO";
        return <div className="space-y-4" key={t.id}>{etapas.map(etapa=><EtapaRoteiro key={etapa.id} etapa={etapa} permitido={dados.evento.etapa==="EM_CAMPO"&&fotoAnterior&&etapa.id===primeiraEtapa&&!erro} ocupado={ocupado} concluir={observacao=>concluir(etapa.id,observacao)}/>)}<FotoCampo tarefa={t} numero={i+1} permitido={dados.evento.etapa==="EM_CAMPO" && t.id===primeira && !erro && etapas.every(e=>!!e.concluidoEm)} ocupado={ocupado} enviar={foto=>enviar(t.id,foto)}/></div>;
      })}</div>
      {!!dados.tarefas.length && !primeira && <p role="status" className="rounded-xl bg-success/10 p-5 text-success">Fotos concluídas. Retorne à Pieggi para a conferência final de expedição.</p>}
    </>}
  </main>;
}
function EtapaRoteiro({etapa:e,permitido,ocupado,concluir}:{etapa:Campo["etapas"][number];permitido:boolean;ocupado:boolean;concluir:(observacao:string)=>Promise<void>}){
  const [erro,setErro]=useState("");
  return <section className={`space-y-3 rounded-xl border bg-card p-5 ${e.concluidoEm?"border-success/30":permitido?"border-primary":""}`}><p className="text-xs uppercase text-primary">Roteiro · {rotulo(e.tipo)} · etapa {e.ordem}</p><h2 className="font-semibold">{e.titulo}</h2><p className="text-sm">Previsto: {new Date(e.previstoEm).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</p><p className="whitespace-pre-wrap text-sm text-muted-foreground">{e.orientacao}</p>{e.concluidoEm?<p className="text-sm text-success">Concluído às {new Date(e.concluidoEm).toLocaleTimeString("pt-BR",{timeZone:"America/Sao_Paulo"})}{e.observacao&&` · ${e.observacao}`}</p>:permitido?<form className="space-y-3" onSubmit={ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget);void concluir(f.get("observacao") as string).catch(f=>setErro(f instanceof Error?f.message:"Falha na confirmação."));}}><label className="block text-sm">Observação / ocorrência<textarea name="observacao" rows={2} maxLength={1000} className={campoOperacao} placeholder="Informe o que aconteceu, se houver alguma ocorrência."/></label><label className="flex items-start gap-2 text-sm"><input type="checkbox" required disabled={ocupado}/>Executei e conferi esta etapa conforme a orientação.</label><Button className="h-12 w-full" type="submit" disabled={ocupado}>Concluir esta etapa</Button></form>:<p className="text-xs text-muted-foreground">Conclua a etapa e a foto anteriores.</p>}{erro&&<p role="alert" className="text-sm text-destructive">{erro}</p>}</section>;
}
function FotoCampo({tarefa:t,numero,permitido,ocupado,enviar}:{tarefa:Campo["tarefas"][number];numero:number;permitido:boolean;ocupado:boolean;enviar:(foto:File)=>Promise<void>}) {
  const [foto,setFoto]=useState<File|null>(null);const [preview,setPreview]=useState("");const [erro,setErro]=useState("");
  useEffect(()=>()=>{if(preview) URL.revokeObjectURL(preview);},[preview]);
  return <section className={`space-y-4 rounded-xl border bg-card p-5 ${permitido?"border-primary":""}`}>
    <div className="flex justify-between gap-3"><h2 className="font-semibold">{numero}. {t.titulo}</h2><span className={`text-xs ${t.estado==="PRONTO"?"text-success":"text-muted-foreground"}`}>{t.estado==="PRONTO"?<Check size={20}/>:rotulo(t.estado)}</span></div>
    {t.estado==="PRONTO"?<p className="text-sm text-success">Registrado às {new Date(t.atualizadoEm).toLocaleTimeString("pt-BR",{timeZone:"America/Sao_Paulo"})}</p>:permitido?<form className="space-y-4" onSubmit={e=>{e.preventDefault();if(foto) void enviar(foto).then(()=>setFoto(null)).catch(f=>setErro(f instanceof Error?f.message:"Falha no envio."));}}>
      <p className="text-sm text-muted-foreground">{numero===2?"Higienize a mesa antes da montagem. Fotografe a mesa completa já preparada.":"Fotografe esta etapa para registrar a entrega. O horário será confirmado pelo sistema."}</p>
      <label className="block text-sm"><Camera className="mr-2 inline" size={18}/>Foto · JPEG, PNG ou WebP até 8 MB<input className={`${campoOperacao} mt-2`} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={ocupado} required onChange={e=>{const arquivo=e.target.files?.[0] ?? null;setFoto(arquivo);setPreview(arquivo?URL.createObjectURL(arquivo):"");setErro("");}}/></label>
      {foto && preview && <img src={preview} alt="Conferência da foto escolhida" className="max-h-72 w-full rounded-lg object-contain"/>}
      <Button className="h-12 w-full" disabled={ocupado || !foto} type="submit">{ocupado?"Enviando…":"Enviar foto e concluir esta etapa"}</Button>
    </form>:<p className="text-sm text-muted-foreground">Conclua a etapa anterior para liberar esta foto.</p>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
  </section>;
}
