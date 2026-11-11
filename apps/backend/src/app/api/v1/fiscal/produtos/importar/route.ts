import { NextResponse } from "next/server";
import { z } from "zod";
import { autorizarEmpresa } from "@/dominios/acesso/autenticacao";
import { importarCatalogoFiscal, situacaoCatalogo } from "@/dominios/fiscal/catalogo-planilha";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { transacao } from "@/integrations/banco";

export const runtime = "nodejs";
const PAPEIS = ["ADMIN", "FINANCEIRO"] as const;
const LIMITE = 5 * 1024 * 1024;

/** Situação do catálogo fiscal (ativos, pendentes, última planilha). */
export async function GET(request: Request) {
  try {
    const empresaId = z.string().uuid().parse(new URL(request.url).searchParams.get("empresaId"));
    const { sql, usuario } = await contexto(request, PAPEIS);
    autorizarEmpresa(usuario, empresaId);
    return NextResponse.json({ data: await situacaoCatalogo(sql, empresaId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return erroOperacao(error); }
}

/** Importa a planilha .xlsx revisada pela contabilidade (multipart: empresaId, arquivo). */
export async function POST(request: Request) {
  try {
    const { usuario } = await contexto(request, PAPEIS);
    if (Number(request.headers.get("content-length")) > LIMITE + 65536) return NextResponse.json({ error: { message: "A planilha deve ter até 5 MB." } }, { status: 413 });
    const form = await request.formData();
    const empresaId = z.string().uuid().parse(form.get("empresaId"));
    autorizarEmpresa(usuario, empresaId);
    const arquivo = form.get("arquivo");
    if (!(arquivo instanceof File) || !arquivo.size || arquivo.size > LIMITE || !/\.xlsx$/i.test(arquivo.name)) {
      return NextResponse.json({ error: { message: "Selecione a planilha .xlsx (até 5 MB)." } }, { status: 400 });
    }
    const bytes = Buffer.from(await arquivo.arrayBuffer());
    const data = await transacao((tx) => importarCatalogoFiscal(tx, usuario, empresaId, arquivo.name, bytes));
    return NextResponse.json({ data });
  } catch (error) { return erroOperacao(error); }
}
