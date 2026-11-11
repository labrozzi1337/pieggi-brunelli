import { NextResponse } from "next/server";
import { autenticar } from "@/dominios/acesso/autenticacao";
import { respostaErroAcesso } from "@/dominios/acesso/http";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    return NextResponse.json({ data: await autenticar(request) });
  } catch (error) { return respostaErroAcesso(error); }
}
