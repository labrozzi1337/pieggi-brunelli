import { NextResponse } from "next/server";
import { z } from "zod";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { painelProducao } from "@/dominios/operacao/consultas";

export async function GET(request:Request) {
  try {
    const empresa=z.string().uuid().parse(new URL(request.url).searchParams.get("empresaId"));
    const { sql, usuario } = await contexto(request);
    return NextResponse.json({ data: await painelProducao(sql, usuario, empresa) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch(error) { return erroOperacao(error); }
}
