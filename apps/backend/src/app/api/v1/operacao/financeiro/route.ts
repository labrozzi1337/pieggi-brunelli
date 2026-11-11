import { NextResponse } from "next/server";
import { z } from "zod";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { financeiroSchema, listarCustos, operarFinanceiro } from "@/dominios/campo/registros";

export async function GET(request:Request) {
  try {
    const empresa=z.string().uuid().parse(new URL(request.url).searchParams.get("empresaId"));const {sql,usuario}=await contexto(request);
    const data=await listarCustos(sql,usuario,empresa);
    return NextResponse.json({data},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return erroOperacao(error);}
}
export async function POST(request:Request) {
  try {
    const {sql,usuario}=await contexto(request);const e=financeiroSchema.parse(await request.json());const data=await operarFinanceiro(sql,usuario,e);return NextResponse.json({data});
  }catch(error){return erroOperacao(error);}
}
