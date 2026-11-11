import { NextResponse } from "next/server";
import { z } from "zod";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { gerarAgenda } from "@/dominios/operacao/agenda";
import { dadosAgenda } from "@/dominios/operacao/consultas";

export async function GET(request: Request) {
  try {
    const id = z.string().uuid().parse(new URL(request.url).searchParams.get("eventoId"));
    const { sql, usuario } = await contexto(request);
    const evento = await dadosAgenda(sql, usuario, id);
    if (!evento) return NextResponse.json({ error: { message: "Agenda disponível após formalização e preenchimento de data e horários." } }, { status: 409 });
    return new Response(gerarAgenda(evento), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": "attachment; filename=evento-pieggi.ics", "Cache-Control": "private, no-store" } });
  } catch (error) { return erroOperacao(error); }
}
