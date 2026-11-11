import { NextResponse } from "next/server";
import { z } from "zod";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { gerenciarAcessoCampo, listarAcessosCampo } from "@/dominios/campo/campo";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { sql, usuario } = await contexto(request);
    const eventoId = z.string().uuid().parse(new URL(request.url).searchParams.get("eventoId"));
    const data = await listarAcessosCampo(sql, usuario, eventoId);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return erroOperacao(error); }
}
export async function POST(request: Request) {
  try {
    const { sql, usuario } = await contexto(request);
    const entrada = z.object({ eventoId: z.string().uuid(), responsavel: z.string().trim().min(2).max(100).optional(), revogarId: z.string().uuid().optional() }).strict().parse(await request.json());
    const data = await gerenciarAcessoCampo(sql, usuario, entrada);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return erroOperacao(error); }
}
