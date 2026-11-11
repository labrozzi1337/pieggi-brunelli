import { NextResponse } from "next/server";
import { z } from "zod";
import { contexto, erroOperacao } from "@/dominios/operacao/http";
import { evidencias, exigirAcesso, novoCaminho } from "@/dominios/campo/campo";
import { PAPEIS_CONTRATO, PAPEIS_LEITURA_CONTRATO, registrarContrato } from "@/dominios/campo/registros";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { sql, usuario } = await contexto(request);
    if (Number(request.headers.get("content-length")) > 9 * 1024 * 1024) return NextResponse.json({ error: { message: "Contrato deve ter até 8 MB." } }, { status: 413 });
    const form = await request.formData();
    const eventoId = z.string().uuid().parse(form.get("eventoId"));
    const revisao = z.coerce.number().int().positive().parse(form.get("revisao"));
    const assinado = z.iso.datetime().parse(form.get("assinadoEm"));
    const arquivo = form.get("arquivo");
    if (!(arquivo instanceof File) || !arquivo.size || arquivo.size > 8388608) return NextResponse.json({ error: { message: "Selecione o contrato assinado em PDF, até 8 MB." } }, { status: 400 });
    const bytes = Buffer.from(await arquivo.arrayBuffer());
    if (bytes.subarray(0, 5).toString() !== "%PDF-") return NextResponse.json({ error: { message: "Arquivo não é um PDF válido." } }, { status: 400 });
    // Upload com service role: autoriza antes (era a policy de storage); a transação confere de novo.
    const [e] = await sql<{ empresa_id: string }[]>`select empresa_id from eventos where id = ${eventoId}`;
    exigirAcesso(usuario, e?.empresa_id, PAPEIS_CONTRATO);
    const path = novoCaminho([eventoId], "pdf");
    const upload = await evidencias().upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (upload.error) throw upload.error;
    const data = await registrarContrato(sql, usuario, { eventoId, revisao, path, assinadoEm: assinado });
    return NextResponse.json({ data });
  } catch (error) { return erroOperacao(error); }
}
export async function GET(request: Request) {
  try {
    const { sql, usuario } = await contexto(request);
    const eventoId = z.string().uuid().parse(new URL(request.url).searchParams.get("eventoId"));
    const [e] = await sql<{ empresa_id: string }[]>`select empresa_id from eventos where id = ${eventoId}`;
    exigirAcesso(usuario, e?.empresa_id, PAPEIS_LEITURA_CONTRATO);
    const [contrato] = await sql<{ arquivo_path: string }[]>`select arquivo_path from evento_contratos where evento_id = ${eventoId}`;
    if (!contrato) return NextResponse.json({ error: { message: "Nenhum contrato anexado. Registros antigos podem não ter arquivo." } }, { status: 404 });
    const arquivo = await evidencias().download(contrato.arquivo_path);
    if (arquivo.error) throw arquivo.error;
    return new Response(arquivo.data, { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=contrato-assinado.pdf", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return erroOperacao(error); }
}
