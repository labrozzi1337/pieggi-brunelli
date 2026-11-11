import type { AuthResponse } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { COOKIE_ACESSO, COOKIE_RENOVACAO, ErroAutorizacao } from "./autenticacao";

type Sessao = NonNullable<AuthResponse["data"]["session"]>;

export function aplicarCookiesSessao(resposta: NextResponse, sessao: Sessao): NextResponse {
  const comum = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
  resposta.cookies.set(COOKIE_ACESSO, sessao.access_token, { ...comum, maxAge: sessao.expires_in });
  resposta.cookies.set(COOKIE_RENOVACAO, sessao.refresh_token, { ...comum, maxAge: 60 * 60 * 24 * 30 });
  return resposta;
}

export function limparCookiesSessao(resposta: NextResponse): NextResponse {
  resposta.cookies.set(COOKIE_ACESSO, "", { httpOnly: true, maxAge: 0, path: "/" });
  resposta.cookies.set(COOKIE_RENOVACAO, "", { httpOnly: true, maxAge: 0, path: "/" });
  return resposta;
}

export function respostaErroAcesso(error: unknown): NextResponse {
  const conhecido = error instanceof ErroAutorizacao;
  return NextResponse.json({ error: { code: conhecido ? "ACCESS_ERROR" : "AUTH_ERROR", message: conhecido ? error.message : "Não foi possível autenticar." } }, { status: conhecido ? error.status : 401 });
}
