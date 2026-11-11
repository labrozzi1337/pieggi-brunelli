import { NextResponse } from "next/server";
import { getServerEnv } from "@/config/env";
import { COOKIE_RENOVACAO, encerrarSessao, extrairToken } from "@/dominios/acesso/autenticacao";
import { limparCookiesSessao } from "@/dominios/acesso/http";
import { createServerSupabaseClient } from "@/integrations/supabase/server";

export async function POST(request: Request): Promise<NextResponse> {
  const ambiente = getServerEnv();
  const acesso = extrairToken(request);
  const renovacao = extrairToken(request, COOKIE_RENOVACAO);
  if (acesso) encerrarSessao(acesso);
  if (ambiente.ok && acesso && renovacao) {
    const banco = createServerSupabaseClient(ambiente.data);
    await banco.auth.setSession({ access_token: acesso, refresh_token: renovacao });
    await banco.auth.signOut();
  }
  return limparCookiesSessao(NextResponse.json({ data: { encerrada: true } }));
}
