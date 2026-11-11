import { useCallback, useEffect, useState } from "react";
import { Copy, Link2, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { campoOperacao } from "./ProgramacaoEditor";
import { api } from "@/lib/api";

interface Acesso {id:string;responsavel:string;expira_em:string;revogado_em:string|null}
export function CampoAcesso({eventoId}:{eventoId:string}) {
  const [lista,setLista]=useState<Acesso[]>([]);const [erro,setErro]=useState("");const [link,setLink]=useState("");const [ocupado,setOcupado]=useState(false);const [copiado,setCopiado]=useState(false);
  const carregar=useCallback(async()=>{try{setLista(await api<Acesso[]>(`/api/v1/operacao/campo?eventoId=${eventoId}`));}catch(e){setErro(e instanceof Error?e.message:"Falha ao consultar links.");}},[eventoId]);
  // Remote read when the selected event changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{void carregar();},[carregar]);
  async function alterar(responsavel?:string,revogarId?:string) {
    setOcupado(true);setErro("");setCopiado(false);
    try{const resultado=await api<{token:string|null}>("/api/v1/operacao/campo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({eventoId,responsavel,revogarId})});setLink(resultado.token?`${window.location.origin}/campo#${resultado.token}`:"");await carregar();}
    catch(e){setErro(e instanceof Error?e.message:"Falha ao registrar link.");}finally{setOcupado(false);}
  }
  return <section className="space-y-4 rounded-xl border bg-card p-5"><h3 className="flex items-center gap-2 text-lg font-semibold"><Link2 size={20}/>Acesso do líder de campo</h3><p className="text-sm text-muted-foreground">Sem conta no sistema. Um evento, somente no dia previsto, sem preços. Gerar outro link revoga o anterior. A URL aparece uma única vez; copie e compartilhe com o líder.</p>
    <form className="flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);if(window.confirm("Gerar um novo link e revogar os anteriores deste evento?")) void alterar(f.get("nome") as string);}}><label className="flex-1 text-sm">Nome do líder<input name="nome" required minLength={2} maxLength={100} className={campoOperacao}/></label><Button type="submit" disabled={ocupado}>Gerar link temporário</Button></form>
    {link && <div className="space-y-2 rounded-lg bg-muted p-3"><label className="block text-sm">Guarde este link<input readOnly value={link} className={campoOperacao} onFocus={e=>e.currentTarget.select()}/></label><Button variant="outline" onClick={()=>{void navigator.clipboard.writeText(link).then(()=>setCopiado(true)).catch(()=>setErro("Copie o link selecionando o campo acima."));}}><Copy size={16}/>{copiado?"Copiado":"Copiar link"}</Button></div>}
    {lista.map(a=><div key={a.id} className="flex flex-wrap justify-between gap-2 rounded-lg border p-3 text-sm"><div><p>{a.responsavel}</p><p className="text-xs text-muted-foreground">{a.revogado_em?"Revogado":new Date(a.expira_em)<new Date()?"Expirado":`Válido até ${new Date(a.expira_em).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}`}</p></div>{!a.revogado_em && new Date(a.expira_em)>new Date() && <Button variant="outline" disabled={ocupado} onClick={()=>{if(window.confirm("Revogar imediatamente este acesso?")) void alterar(undefined,a.id);}}><ShieldOff size={16}/>Revogar</Button>}</div>)}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
  </section>;
}
