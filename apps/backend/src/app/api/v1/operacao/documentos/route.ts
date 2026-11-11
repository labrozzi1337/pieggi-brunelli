import { createHash } from "node:crypto";
import { z } from "zod";
import { contexto, erroOperacao, ErroOperacao } from "@/dominios/operacao/http";
import { documentoFonteSchema, eventoDocumentoSchema, gerarPlaquinhas, gerarWord, nomesSetores } from "@/dominios/operacao/documentos";
import { exigirAcesso } from "@/dominios/campo/campo";
import { PAPEIS_DOCUMENTOS, registrarDocumentoOperacional } from "@/dominios/campo/registros";

export async function GET(request: Request) {
  try {
    const url=new URL(request.url);
    const entrada=z.object({ programacaoId:z.string().uuid(), tipo:z.enum(["PROGRAMACAO","COMANDA","PLAQUINHAS"]), setor:z.string().optional() }).parse(Object.fromEntries(url.searchParams));
    if (entrada.tipo==="COMANDA" && (!entrada.setor || !nomesSetores[entrada.setor])) throw new ErroOperacao("Escolha o setor da comanda.",400);
    const {sql,usuario}=await contexto(request,PAPEIS_DOCUMENTOS);
    // to_jsonb: mesmo formato de datas/horas que o PostgREST devolvia aos geradores.
    const [fonte]=await sql<{ p: Record<string, unknown>; e: Record<string, unknown> }[]>`
      select jsonb_build_object('id',p.id,'evento_id',p.evento_id,'empresa_id',p.empresa_id,'versao',p.versao,'status',p.status,'saida_em',p.saida_em,'aprovado_em',p.aprovado_em,'alteracoes',p.alteracoes,'itens',p.itens,'rotulos',p.rotulos) as p,
        jsonb_build_object('titulo',e.titulo,'data_evento',e.data_evento,'pax',e.pax,'horario_inicio',e.horario_inicio,'horario_fim',e.horario_fim) as e
      from programacoes p join eventos e on e.id=p.evento_id where p.id=${entrada.programacaoId}`;
    if (!fonte) throw new ErroOperacao("Programação não encontrada.",404);
    exigirAcesso(usuario,String(fonte.p.empresa_id),PAPEIS_DOCUMENTOS);
    if (fonte.p.status!=="APROVADA") throw new ErroOperacao("Aprove a programação vigente antes de gerar documentos.",409);
    const p=documentoFonteSchema.parse(fonte.p);
    const e=eventoDocumentoSchema.parse(fonte.e);
    const pdf=entrada.tipo==="PLAQUINHAS";
    const arquivo=pdf ? await gerarPlaquinhas(p,e) : await gerarWord(p,e,entrada.tipo==="COMANDA" ? entrada.setor : undefined);
    const digest=createHash("sha256").update(arquivo).digest("hex");
    // A versão pode mudar enquanto o arquivo é gerado: o registro confirma sob lock.
    await registrarDocumentoOperacional(sql,usuario,{programacaoId:p.id,tipo:entrada.tipo,setor:entrada.setor ?? "",sha256:digest});
    return new Response(new Uint8Array(arquivo),{headers:{"Content-Type":pdf?"application/pdf":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":`attachment; filename="${entrada.tipo.toLowerCase()}-${entrada.setor ?? "evento"}-v${p.versao}.${pdf?"pdf":"docx"}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","X-Programacao-Versao":String(p.versao)}});
  } catch(error) { return erroOperacao(error); }
}
