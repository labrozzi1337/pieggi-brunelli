import { NextResponse } from "next/server";
import { z } from "zod";
import { autorizarEmpresa } from "@/dominios/acesso/autenticacao";
import { evidencias, novoCaminho } from "@/dominios/campo/campo";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { tipoImagem } from "@/dominios/operacao/imagem";

/** Foto ou PDF da nota de entrada. Devolve o caminho que vai em NOTAS_LANCAR.fotoPath. */
export async function POST(request: Request) {
  try {
    const { usuario } = await contexto(request, ["ADMIN", "EXPEDICAO_COMPRAS"]);
    if (Number(request.headers.get("content-length")) > 9 * 1024 * 1024) return NextResponse.json({ error: { message: "Arquivo deve ter até 8 MB." } }, { status: 413 });
    const form = await request.formData();
    const empresaId = z.string().uuid().parse(form.get("empresaId"));
    autorizarEmpresa(usuario, empresaId);
    const arquivo = form.get("arquivo");
    if (!(arquivo instanceof File) || !arquivo.size || arquivo.size > 8 * 1024 * 1024) return NextResponse.json({ error: { message: "Selecione uma foto ou PDF de até 8 MB." } }, { status: 400 });
    const bytes = Buffer.from(await arquivo.arrayBuffer());
    const tipo = tipoImagem(bytes) ?? (bytes.subarray(0, 5).toString() === "%PDF-" ? { mime: "application/pdf", extensao: "pdf" } : null);
    if (!tipo) return NextResponse.json({ error: { message: "Envie JPEG, PNG, WebP ou PDF." } }, { status: 400 });
    const path = novoCaminho(["notas", empresaId], tipo.extensao);
    const upload = await evidencias().upload(path, bytes, { contentType: tipo.mime, upsert: false });
    if (upload.error) throw upload.error;
    return NextResponse.json({ data: { path } });
  } catch (error) { return erroOperacao(error); }
}
