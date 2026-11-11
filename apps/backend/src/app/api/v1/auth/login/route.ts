import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/config/env";
import { carregarUsuario, ErroAutorizacao } from "@/dominios/acesso/autenticacao";
import { aplicarCookiesSessao, respostaErroAcesso } from "@/dominios/acesso/http";
import { createServerSupabaseClient } from "@/integrations/supabase/server";

const entradaSchema = z.object({ email: z.email(), senha: z.string().min(8).max(200) });

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const ambiente = getServerEnv();
    if (!ambiente.ok) throw new ErroAutorizacao("Backend não configurado.", 503);
    const entrada = entradaSchema.parse(await request.json());
    const banco = createServerSupabaseClient(ambiente.data);
    const { data, error } = await banco.auth.signInWithPassword({ email: entrada.email, password: entrada.senha });
    if (error || !data.user || !data.session) throw new ErroAutorizacao("E-mail ou senha inválidos.", 401);
    const usuario = await carregarUsuario(data.user.id, data.user.email ?? entrada.email);
    return aplicarCookiesSessao(NextResponse.json({ data: usuario }), data.session);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Informe e-mail e senha válidos." } }, { status: 400 });
    return respostaErroAcesso(error);
  }
}
