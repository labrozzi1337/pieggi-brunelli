import { NextResponse } from "next/server";
import { z } from "zod";
import { notaDoEvento, PAPEIS_NOTA } from "@/dominios/fiscal/nota-do-evento";
import { contexto, erroOperacao } from "@/dominios/operacao/http";

/** Rascunho da NF-e do evento: destinatário + itens da programação aprovada já ligados ao catálogo fiscal. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = z.string().uuid().parse((await context.params).id);
    const { sql, usuario } = await contexto(request, PAPEIS_NOTA);
    return NextResponse.json({ data: await notaDoEvento(sql, usuario, id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return erroOperacao(error); }
}
