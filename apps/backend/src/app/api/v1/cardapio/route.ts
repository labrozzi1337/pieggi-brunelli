import { NextResponse } from "next/server";
import { z } from "zod";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { listarCardapio, salvarItemCardapio } from "@/dominios/nucleo/regras";

const alteracao = z.object({
  id: z.string().uuid(),
  dados: z.object({
    nomeEn: z.string().trim().max(200), nomeEs: z.string().trim().max(200), selo: z.enum(["", "VEGANO", "VEGETARIANO"]),
    estacao: z.enum(["", "COZINHA_QUENTE", "COZINHA_FRIA", "CONFEITARIA", "BEBIDAS", "ESTRUTURA", "FORNECEDOR"]),
    fornecedor: z.string().trim().max(200), ativo: z.boolean(), custo: z.number().nonnegative().max(1000000)
  }).partial().strict()
}).strict();

export async function GET(request: Request) {
  try {
    const { sql, usuario } = await contexto(request);
    return NextResponse.json({ data: await listarCardapio(sql, usuario) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return erroOperacao(error); }
}

export async function PATCH(request: Request) {
  try {
    const entrada = alteracao.parse(await request.json());
    const { sql, usuario } = await contexto(request);
    await sql.begin((tx) => salvarItemCardapio(tx, usuario, entrada.id, entrada.dados));
    return NextResponse.json({ data: { id: entrada.id } });
  } catch (error) { return erroOperacao(error); }
}
