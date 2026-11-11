import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { baixarArquivo } from "@/lib/api";
import type { EventoOperacao } from "@/lib/operacao";
import { campoOperacao } from "./ProgramacaoEditor";

export function Contrato({ evento, ocupado, permitido, salvar }: { evento: EventoOperacao; ocupado: boolean; permitido: boolean; salvar: (form: FormData) => Promise<void> }) {
  const [erro, setErro] = useState("");
  return <section className="space-y-4 rounded-xl border bg-card p-5"><h3 className="text-lg font-semibold">Formalização do evento</h3><p className="text-sm text-muted-foreground">Anexe a via já assinada. O registro libera a programação e cria as pendências de agenda e faturamento. Este envio não substitui a assinatura das partes.</p>
    {evento.contrato_assinado_em ? <><p className="rounded-lg bg-success/10 p-4 text-sm">Assinatura registrada em {new Date(evento.contrato_assinado_em).toLocaleString("pt-BR")}.</p><Button variant="outline" onClick={() => { void baixarArquivo(`/api/v1/operacao/contratos?eventoId=${evento.id}`, "contrato-assinado.pdf").catch(e => setErro(e instanceof Error ? e.message : "Falha no download.")); }}>Baixar contrato assinado</Button></> : permitido ? <form className="space-y-4" onSubmit={e => {
      e.preventDefault(); const form = new FormData(e.currentTarget); const data = form.get("data"); if (typeof data !== "string" || !Number.isFinite(Date.parse(data))) return; form.set("eventoId", evento.id); form.set("assinadoEm", new Date(data).toISOString());
      if (window.confirm("Confirmo que o arquivo contém o contrato assinado pelas partes. Liberar a operação?")) void salvar(form).catch(e => setErro(e instanceof Error ? e.message : "Falha ao registrar."));
    }}><label className="block text-sm">Data e hora da assinatura<input name="data" type="datetime-local" required className={campoOperacao} /></label><label className="block text-sm">Via assinada (PDF, até 8 MB)<input name="arquivo" type="file" accept="application/pdf" required className="mt-2 block text-sm" /></label><Button disabled={ocupado} type="submit">Registrar assinatura e liberar operação</Button></form> : <p className="text-sm">Aguardando formalização pela equipe comercial.</p>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
  </section>;
}
