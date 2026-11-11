import { NextResponse } from "next/server";
import { z } from "zod";
import { autorizarEmpresa } from "@/dominios/acesso/autenticacao";
import { contexto, erroOperacao } from "@/dominios/operacao/http";

/**
 * Marca da última alteração da empresa, para as telas recarregarem sozinhas (tempo real por consulta curta).
 * Toda alteração grava auditoria na mesma transação; só aparece aqui depois do commit, então quem recarrega já vê o dado novo.
 * ponytail: cada tela aberta consulta a cada poucos segundos; com muitos usuários, trocar por SSE com uma consulta por empresa.
 */
export async function GET(request: Request) {
  try {
    const empresaId = z.string().uuid().parse(new URL(request.url).searchParams.get("empresaId"));
    const { sql, usuario } = await contexto(request);
    autorizarEmpresa(usuario, empresaId);
    const [linha] = await sql<{ versao: string | null }[]>`
      select greatest(
        (select max(criado_em) from auditoria_eventos where empresa_id = ${empresaId}),
        (select max(criado_em) from auditoria_eventos where empresa_id is null),
        (select max(atualizado_em) from eventos where empresa_id = ${empresaId})
      )::text versao`;
    return NextResponse.json({ data: { versao: linha?.versao ?? "" } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return erroOperacao(error); }
}
