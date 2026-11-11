import { NextResponse } from "next/server";
import { z } from "zod";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { painelOperacao } from "@/dominios/operacao/consultas";

export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams;
    const empresa = z.string().uuid().parse(q.get("empresaId"));
    const evento = z.string().uuid().optional().parse(q.get("evento") || undefined);
    const desde = z.string().date().optional().parse(q.get("desde") || undefined);
    const { sql, usuario } = await contexto(request);
    return NextResponse.json({ data: await painelOperacao(sql, usuario, empresa, evento, desde) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return erroOperacao(error); }
}
