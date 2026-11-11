import { NextResponse } from "next/server";
import { z } from "zod";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { alterarRegra, definirChaveRegrasCliente, listarRegras } from "@/dominios/nucleo/regras";
import { escoposTipo } from "@/dominios/regras/motor";
import { invalidarRegras } from "@/dominios/regras/repositorio";

const comando = z.discriminatedUnion("acao", [
  z.object({
    acao: z.literal("ALTERAR"), codigo: z.string().regex(/^[a-z0-9_]+(\.[A-Za-z0-9_]+)*$/), escopoTipo: z.enum(escoposTipo),
    escopoChave: z.string().regex(/^[A-Z0-9_]{0,60}$/), valor: z.json().refine((v) => v !== null, "Informe o valor."),
    vigenteDesde: z.string().date(), justificativa: z.string().trim().min(5).max(1000), titulo: z.string().trim().max(200).optional()
  }).strict(),
  z.object({ acao: z.literal("CHAVE_CLIENTE"), clienteId: z.string().uuid(), chave: z.string().trim().toUpperCase().regex(/^([A-Z0-9_]{2,40})?$/) }).strict()
]);

export async function GET(request: Request) {
  try {
    const empresaId = z.string().uuid().parse(new URL(request.url).searchParams.get("empresaId"));
    const { sql, usuario } = await contexto(request);
    return NextResponse.json({ data: await listarRegras(sql, usuario, empresaId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return erroOperacao(error); }
}

export async function POST(request: Request) {
  try {
    const entrada = comando.parse(await request.json());
    const { sql, usuario } = await contexto(request);
    const data = await sql.begin(async (tx) => {
      if (entrada.acao === "ALTERAR") return alterarRegra(tx, usuario, entrada);
      await definirChaveRegrasCliente(tx, usuario, entrada.clienteId, entrada.chave);
      return { ok: true };
    });
    invalidarRegras();
    return NextResponse.json({ data });
  } catch (error) { return erroOperacao(error); }
}
