import { NextResponse } from "next/server";
import { z } from "zod";
import { contexto, erroOperacao, ErroOperacao } from "@/dominios/operacao/http";
import { tipoImagem } from "@/dominios/operacao/imagem";
import { concluirTarefaEvidencia, evidencias, exigirAcesso, novoCaminho, PAPEIS_EVIDENCIA, PAPEIS_LEITURA_OPERACAO } from "@/dominios/campo/campo";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { sql, usuario } = await contexto(request);
    if (Number(request.headers.get("content-length")) > 9 * 1024 * 1024) return NextResponse.json({ error: { message: "Foto deve ter até 8 MB." } }, { status: 413 });
    const form = await request.formData();
    const tarefaId = z.string().uuid().parse(form.get("tarefaId"));
    const revisao = z.coerce.number().int().positive().parse(form.get("revisao"));
    const foto = form.get("foto");
    if (!(foto instanceof File) || foto.size > 8 * 1024 * 1024 || !foto.size) return NextResponse.json({ error: { message: "Selecione uma foto de até 8 MB." } }, { status: 400 });
    const bytes = Buffer.from(await foto.arrayBuffer());
    const tipo = tipoImagem(bytes);
    if (!tipo) return NextResponse.json({ error: { message: "Foto precisa ser JPEG, PNG ou WebP." } }, { status: 400 });
    // O upload usa service role: autoriza antes (era a policy de storage); a transação confere de novo.
    const [tarefa] = await sql<{ evento_id: string; empresa_id: string }[]>`select evento_id, empresa_id from operacao_tarefas where id = ${tarefaId}`;
    exigirAcesso(usuario, tarefa?.empresa_id, PAPEIS_EVIDENCIA);
    const path = novoCaminho([tarefa!.evento_id], tipo.extensao);
    const upload = await evidencias().upload(path, bytes, { contentType: tipo.mime, upsert: false });
    if (upload.error) throw upload.error;
    const data = await concluirTarefaEvidencia(sql, usuario, { tarefaId, revisao, path });
    return NextResponse.json({ data });
  } catch (error) { return erroOperacao(error); }
}
export async function GET(request: Request) {
  try {
    const { sql, usuario } = await contexto(request);
    const tarefaId = z.string().uuid().parse(new URL(request.url).searchParams.get("tarefaId"));
    const [tarefa] = await sql<{ evidencia_path: string | null; empresa_id: string }[]>`select evidencia_path, empresa_id from operacao_tarefas where id = ${tarefaId}`;
    if (!tarefa) throw new ErroOperacao("Registro não encontrado.", 404);
    exigirAcesso(usuario, tarefa.empresa_id, PAPEIS_LEITURA_OPERACAO);
    if (!tarefa.evidencia_path) return NextResponse.json({ error: { message: "Evidência ainda não enviada." } }, { status: 404 });
    const foto = await evidencias().download(tarefa.evidencia_path);
    if (foto.error) throw foto.error;
    return new Response(foto.data, { headers: { "Content-Type": foto.data.type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return erroOperacao(error); }
}
