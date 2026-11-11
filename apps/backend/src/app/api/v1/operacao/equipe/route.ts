import { NextResponse } from "next/server";
import { z } from "zod";
import { comandoEquipe, consultarEquipe, operarEquipe } from "@/dominios/equipe/contratacoes";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { transacao } from "@/integrations/banco";

const semCache = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  try {
    const eventoId = z.string().uuid().parse(new URL(request.url).searchParams.get("eventoId"));
    const { usuario, sql } = await contexto(request);
    return NextResponse.json({ data: await consultarEquipe(sql, usuario, eventoId) }, { headers: semCache });
  } catch (error) { return erroOperacao(error); }
}

export async function POST(request: Request) {
  try {
    const { usuario } = await contexto(request);
    const entrada = comandoEquipe.parse(await request.json());
    return NextResponse.json({ data: await transacao((tx) => operarEquipe(tx, usuario, entrada)) }, { headers: semCache });
  } catch (error) { return erroOperacao(error); }
}
