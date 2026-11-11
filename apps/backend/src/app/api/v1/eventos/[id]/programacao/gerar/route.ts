import { NextResponse } from "next/server";
import { z } from "zod";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { gerarProgramacaoDoEvento } from "@/dominios/operacao/fluxo";

/** Programação gerada pelo motor a partir da proposta aprovada; salva como nova versão em rascunho. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = z.string().uuid().parse((await context.params).id);
    const { revisao } = z.object({ revisao: z.number().int().positive() }).strict().parse(await request.json());
    const { sql, usuario } = await contexto(request);
    const data = await sql.begin((tx) => gerarProgramacaoDoEvento(tx, usuario, id, revisao));
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return erroOperacao(error); }
}
