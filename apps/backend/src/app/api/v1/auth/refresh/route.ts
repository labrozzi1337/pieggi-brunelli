import { NextResponse } from "next/server";
import { getServerEnv } from "@/config/env";
import { COOKIE_RENOVACAO, carregarUsuario, ErroAutorizacao, extrairToken } from "@/dominios/acesso/autenticacao";
import { aplicarCookiesSessao, respostaErroAcesso } from "@/dominios/acesso/http";
import { createServerSupabaseClient } from "@/integrations/supabase/server";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const ambiente = getServerEnv();
    if (!ambiente.ok) throw new ErroAutorizacao("Backend não configurado.", 503);
    const token = extrairToken(request, COOKIE_RENOVACAO);
    if (!token) throw new ErroAutorizacao("Sessão não renovável.", 401);
    const banco = createServerSupabaseClient(ambiente.data);
    const { data, error } = await banco.auth.refreshSession({ refresh_token: token });
    if (error || !data.user || !data.session) throw new ErroAutorizacao("Sessão expirada.", 401);
    const usuario = await carregarUsuario(data.user.id, data.user.email ?? "");
    return aplicarCookiesSessao(NextResponse.json({ data: usuario }), data.session);
  } catch (error) { return respostaErroAcesso(error); }
}
