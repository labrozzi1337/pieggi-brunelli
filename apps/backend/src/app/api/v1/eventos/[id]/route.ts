import { NextResponse } from "next/server";
import { z } from "zod";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { eventoEntrada, mapearEvento, salvarEvento } from "@/dominios/operacao/eventos";

export async function PATCH(request: Request, context: { params: Promise<{ id:string }> }) {
  try {
    const id = z.string().uuid().parse((await context.params).id);
    const entrada = eventoEntrada.required({ atualizadoEm:true }).parse(await request.json());
    const { sql, usuario } = await contexto(request);
    if (entrada.registrarContratoAssinado) return NextResponse.json({ error: { message:"Abra a operação do evento e envie o PDF assinado na aba Contrato." } }, { status:409 });
    const resultado = await sql.begin((tx) => salvarEvento(tx, usuario, id, entrada));
    return NextResponse.json({ data:mapearEvento(resultado.evento,resultado.cliente) });
  } catch (error) { return erroOperacao(error); }
}
