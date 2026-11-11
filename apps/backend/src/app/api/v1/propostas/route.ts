import { NextResponse } from "next/server";
import { z } from "zod";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { aprovarProposta, consultarPropostas, propostaOperacional, propostaSchema, salvarProposta } from "@/dominios/operacao/propostas";

const comando = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("SALVAR"), eventoId: z.string().uuid(), revisao: z.number().int().positive(), chave: z.string().uuid(), dados: propostaSchema }).strict(),
  z.object({ acao: z.literal("APROVAR"), eventoId: z.string().uuid(), revisao: z.number().int().positive(), propostaId: z.string().uuid(), confirmado: z.literal(true) }).strict()
]);
export async function GET(request: Request) {
  try {
    const parametros = new URL(request.url).searchParams;
    const eventoId = z.string().uuid().parse(parametros.get("eventoId"));
    const { sql, usuario } = await contexto(request);
    const data = parametros.get("operacional") === "true" ? await propostaOperacional(sql, usuario, eventoId) : await consultarPropostas(sql, usuario, eventoId);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return erroOperacao(error); }
}
export async function POST(request: Request) {
  try {
    const entrada = comando.parse(await request.json());
    const { sql, usuario } = await contexto(request);
    const data = await sql.begin((tx) => entrada.acao === "SALVAR" ? salvarProposta(tx, usuario, entrada) : aprovarProposta(tx, usuario, entrada));
    return NextResponse.json({ data });
  } catch (error) { return erroOperacao(error); }
}
