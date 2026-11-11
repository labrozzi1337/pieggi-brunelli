import { NextResponse } from "next/server";
import { z } from "zod";
import { comandoSchema, contexto, erroOperacao } from "@/dominios/operacao/http";
import { operarEvento } from "@/dominios/operacao/programacao";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = z.string().uuid().parse((await context.params).id);
    const entrada = comandoSchema.parse(await request.json());
    const { sql, usuario } = await contexto(request);
    const data = await sql.begin((tx) => operarEvento(tx, usuario, id, entrada.revisao, entrada.comando));
    return NextResponse.json({ data });
  } catch (error) { return erroOperacao(error); }
}
