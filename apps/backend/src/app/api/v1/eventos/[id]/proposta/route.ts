import { NextResponse } from "next/server";
import { z } from "zod";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { gerarPropostaGuiada, propostaGuiadaSchema } from "@/dominios/operacao/fluxo";

/** "Confirmar e gerar proposta": gates, cálculo pelas regras da data do evento, nova versão e aprovação (descritivo vendido travado). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = z.string().uuid().parse((await context.params).id);
    const entrada = propostaGuiadaSchema.parse(await request.json());
    const { sql, usuario } = await contexto(request);
    const data = await sql.begin((tx) => gerarPropostaGuiada(tx, usuario, id, entrada));
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return erroOperacao(error); }
}
