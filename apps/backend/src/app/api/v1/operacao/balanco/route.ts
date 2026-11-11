import { NextResponse } from "next/server";
import { z } from "zod";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { contexto, erroOperacao, ErroOperacao } from "@/dominios/operacao/http";
import { evidencias, exigirAcesso, novoCaminho } from "@/dominios/campo/campo";
import { consultarBalanco, linhaBalancoSchema as linha, PAPEIS_BALANCO, registrarTermoRemanescentes, salvarBalanco } from "@/dominios/campo/balanco";

export const runtime = "nodejs";
const salvoSchema=z.object({programacao_id:z.string().uuid(),revisao:z.number(),recebedor:z.string(),observacoes:z.string(),linhas:z.array(linha.extend({nome:z.string(),unidade:z.string(),programado:z.number(),consumido:z.number()}))});
export async function GET(request:Request) {
  try {
    const {sql,usuario}=await contexto(request);
    const q=new URL(request.url).searchParams;const eventoId=z.string().uuid().parse(q.get("eventoId"));
    const {programacao,balanco,termos}=await consultarBalanco(sql,usuario,eventoId);
    if(q.get("documento")==="assinado") {
      const termoId=z.string().uuid().parse(q.get("termoId"));
      const [termo]=await sql<{arquivo_path:string}[]>`select arquivo_path from remanescentes_termos where evento_id = ${eventoId} and id = ${termoId}`;
      if(!termo) throw new ErroOperacao("Registro não encontrado.",404);
      const arquivo=await evidencias().download(termo.arquivo_path);if(arquivo.error) throw arquivo.error;
      return new Response(arquivo.data,{headers:{"Content-Type":"application/pdf","Content-Disposition":"attachment; filename=termo-assinado.pdf","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
    }
    if(q.get("documento")==="termo") {
      const b=salvoSchema.parse(balanco);const itens=b.linhas.filter(i=>i.remanescentes>0);
      if(!itens.length) throw new ErroOperacao("Não há remanescentes para gerar o termo.",409);
      const evento=z.object({titulo:z.string(),data_evento:z.string()}).parse(programacao.evento);
      const par=(text:string,bold=false)=>new Paragraph({children:[new TextRun({text,bold})],spacing:{after:160}});
      const doc=new Document({creator:"Pieggi",styles:{default:{document:{run:{font:"Arial",size:24,color:"000000"}}}},sections:[{properties:{page:{margin:{top:720,bottom:720,left:720,right:720}}},children:[par("REGISTRO DE ENTREGA DE REMANESCENTES",true),par(`Evento: ${evento.titulo} · ${evento.data_evento}`),par(`Programação v${programacao.versao} · balanço revisão ${b.revisao}`),par(`Recebedor: ${b.recebedor}`),...itens.map(i=>par(`${i.remanescentes} ${i.unidade} — ${i.nome}`)),par(b.observacoes),par("Declaro o recebimento dos itens e quantidades relacionados acima."),par("Data e horário da entrega: __________________________________"),par("Nome e assinatura do recebedor: ______________________________"),par("Nome e assinatura do responsável Pieggi: ______________________"),par("Documento aguardando assinatura. Anexe o PDF assinado ao mesmo balanço no sistema."),par(`Identificador: ${b.programacao_id} · revisão ${b.revisao}`)]}]});
      const bytes=await Packer.toBuffer(doc);return new Response(new Uint8Array(bytes),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":"attachment; filename=termo-remanescentes.docx","Cache-Control":"private, no-store"}});
    }
    return NextResponse.json({data:{balanco:balanco ? salvoSchema.parse(balanco) : null,termos:z.array(z.object({id:z.string().uuid(),revisao_balanco:z.number().int(),assinado_em:z.string()})).parse(termos)}},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return erroOperacao(error);}
}
export async function POST(request:Request) {
  try {
    const {sql,usuario}=await contexto(request);
    if(request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      if(Number(request.headers.get("content-length"))>9*1024*1024) throw new ErroOperacao("PDF deve ter até 8 MB.",400);
      const form=await request.formData();const evento=z.string().uuid().parse(form.get("eventoId"));const revisao=z.coerce.number().int().positive().parse(form.get("revisao"));const balanco=z.coerce.number().int().positive().parse(form.get("balancoRevisao"));const assinado=z.iso.datetime().parse(form.get("assinadoEm"));const arquivo=form.get("arquivo");
      if(!(arquivo instanceof File) || !arquivo.size || arquivo.size>8388608) throw new ErroOperacao("Selecione o PDF assinado, até 8 MB.",400);
      const bytes=Buffer.from(await arquivo.arrayBuffer());if(bytes.subarray(0,5).toString()!=="%PDF-") throw new ErroOperacao("Arquivo precisa ser PDF.",400);
      // Upload com service role: autoriza antes (era a policy de storage); a transação confere de novo.
      const [e]=await sql<{empresa_id:string}[]>`select empresa_id from eventos where id = ${evento}`;exigirAcesso(usuario,e?.empresa_id,PAPEIS_BALANCO);
      const path=novoCaminho([evento],"pdf");const upload=await evidencias().upload(path,bytes,{contentType:"application/pdf",upsert:false});if(upload.error) throw upload.error;
      const data=await registrarTermoRemanescentes(sql,usuario,{eventoId:evento,revisao,balancoRevisao:balanco,path,assinadoEm:assinado});return NextResponse.json({data});
    }
    const e=z.object({eventoId:z.string().uuid(),revisao:z.number().int().positive(),balancoRevisao:z.number().int().nonnegative(),linhas:z.array(linha).max(500),recebedor:z.string().trim().max(200),observacoes:z.string().trim().max(3000)}).strict().parse(await request.json());
    const data=await salvarBalanco(sql,usuario,e);return NextResponse.json({data});
  }catch(error){return erroOperacao(error);}
}
