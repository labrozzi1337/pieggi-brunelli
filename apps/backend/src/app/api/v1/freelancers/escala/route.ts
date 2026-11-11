import { NextResponse } from "next/server";
import { z } from "zod";
import { autorizarEmpresa } from "@/dominios/acesso/autenticacao";
import {
  cancelarDiaria, diariaEdicao, diariaEntrada, editarDiaria, escalaDoEvento, eventosParaEscala, lancarDiaria, PAPEIS_ESCALA, PAPEIS_FREELANCERS
} from "@/dominios/equipe/freelancers";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { transacao } from "@/integrations/banco";

const semCache = { "Cache-Control": "private, no-store" };
const entrada = z.object({
  comando: z.discriminatedUnion("acao", [
    z.object({ acao: z.literal("LANCAR"), dados: diariaEntrada }),
    z.object({ acao: z.literal("EDITAR"), dados: diariaEdicao }),
    z.object({ acao: z.literal("CANCELAR"), dados: z.object({ id: z.string().uuid(), motivo: z.string().trim().min(5).max(1000) }).strict() })
  ])
}).strict();

/** ?empresaId= → eventos para escalar; &eventoId= → escala do evento com verba × custo. */
export async function GET(request: Request) {
  try {
    const q = z.object({ empresaId: z.string().uuid(), eventoId: z.string().uuid().optional() }).parse(Object.fromEntries(new URL(request.url).searchParams));
    const { usuario, sql } = await contexto(request, PAPEIS_FREELANCERS);
    autorizarEmpresa(usuario, q.empresaId);
    const [eventos, escala] = await Promise.all([eventosParaEscala(sql, q.empresaId), q.eventoId ? escalaDoEvento(sql, usuario, q.eventoId) : null]);
    return NextResponse.json({ data: { eventos, escala } }, { headers: semCache });
  } catch (error) { return erroOperacao(error); }
}

export async function POST(request: Request) {
  try {
    const { usuario } = await contexto(request, PAPEIS_ESCALA);
    const { comando } = entrada.parse(await request.json());
    const data = await transacao((tx) => comando.acao === "LANCAR" ? lancarDiaria(tx, usuario, comando.dados)
      : comando.acao === "EDITAR" ? editarDiaria(tx, usuario, comando.dados)
      : cancelarDiaria(tx, usuario, comando.dados.id, comando.dados.motivo));
    return NextResponse.json({ data }, { headers: semCache });
  } catch (error) { return erroOperacao(error); }
}
