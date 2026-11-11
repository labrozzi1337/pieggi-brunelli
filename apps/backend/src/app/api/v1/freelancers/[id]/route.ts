import { NextResponse } from "next/server";
import { z } from "zod";
import { historicoFreelancer, PAPEIS_FREELANCERS } from "@/dominios/equipe/freelancers";
import { contexto, erroOperacao } from "@/dominios/operacao/http";

/** Cadastro + histórico de eventos trabalhados (uma linha por diária). */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = z.string().uuid().parse((await context.params).id);
    const { usuario, sql } = await contexto(request, PAPEIS_FREELANCERS);
    return NextResponse.json({ data: await historicoFreelancer(sql, usuario, id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return erroOperacao(error); }
}
