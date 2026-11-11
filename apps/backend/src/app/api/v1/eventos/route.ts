import { NextResponse } from "next/server";
import { z } from "zod";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { eventoEntrada, listarEventos, mapearEvento, salvarEvento } from "@/dominios/operacao/eventos";

export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams;
    const empresaId = z.string().uuid().parse(q.get("empresaId"));
    const { sql, usuario } = await contexto(request);
    return NextResponse.json({ data: await listarEventos(sql, usuario, empresaId, q.get("historico") === "1") }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return erroOperacao(error); }
}
export async function POST(request: Request) {
  try {
    const entrada = eventoEntrada.required({ cliente: true, titulo: true }).parse(await request.json());
    const { sql, usuario } = await contexto(request);
    const resultado = await sql.begin((tx) => salvarEvento(tx, usuario, null, entrada));
    return NextResponse.json({ data: mapearEvento(resultado.evento, resultado.cliente) }, { status: 201 });
  } catch (error) { return erroOperacao(error); }
}
