import { NextResponse } from "next/server";
import { z } from "zod";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { sugerirParaEvento, sugestaoSchema } from "@/dominios/operacao/fluxo";

/** Prévia do assistente: cardápio sugerido, quantidades, preço, CMV e travas — nada é salvo. Custo/CMV só para perfis com valores. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = z.string().uuid().parse((await context.params).id);
    const entrada = sugestaoSchema.parse(await request.json());
    const { sql, usuario } = await contexto(request);
    return NextResponse.json({ data: await sugerirParaEvento(sql, usuario, id, entrada) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return erroOperacao(error); }
}
