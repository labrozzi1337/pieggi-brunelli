import { NextResponse } from "next/server";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { simulacaoSchema, simular } from "@/dominios/operacao/fluxo";

/** Calculadora: o mesmo motor do assistente de evento (sugestão, quantidades, preço, CMV e travas) sem evento cadastrado. */
export async function POST(request: Request) {
  try {
    const e = simulacaoSchema.parse(await request.json());
    const { sql, usuario } = await contexto(request);
    return NextResponse.json({ data: await simular(sql, usuario, e) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return erroOperacao(error); }
}
