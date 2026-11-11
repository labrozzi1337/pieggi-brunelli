import { NextResponse } from "next/server";
import { z } from "zod";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { listarClientes } from "@/dominios/operacao/clientes";
import { autorizarEmpresa } from "@/dominios/acesso/autenticacao";

/** Autocompletar de clientes + o que cada cliente de regra própria preenche sozinho (endereço, contato, tabela). */
export async function GET(request: Request) {
  try {
    const empresaId = z.string().uuid().parse(new URL(request.url).searchParams.get("empresaId"));
    const { sql, usuario } = await contexto(request, ["ADMIN", "COMERCIAL", "ATENDIMENTO", "FINANCEIRO"]);
    autorizarEmpresa(usuario, empresaId);
    return NextResponse.json({ data: await listarClientes(sql, usuario, empresaId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return erroOperacao(error); }
}
