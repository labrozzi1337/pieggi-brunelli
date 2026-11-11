import { NextResponse } from "next/server";
import { contexto, erroOperacao, ErroOperacao } from "@/dominios/operacao/http";
import { consultarCep, consultarCnpj } from "@/dominios/consultas/publicas";

/** Autopreenchimento de cadastro: ?cep=00000000 (ViaCEP) ou ?cnpj=00000000000000 (OpenCNPJ + ViaCEP). Só usuários logados. */
export async function GET(request: Request) {
  try {
    await contexto(request);
    const p = new URL(request.url).searchParams;
    const cep = p.get("cep"), cnpj = p.get("cnpj");
    if (!cep && !cnpj) throw new ErroOperacao("Informe cep ou cnpj.", 400);
    const data = cnpj ? await consultarCnpj(cnpj) : await consultarCep(cep!);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (error) { return erroOperacao(error); }
}
