import { NextResponse } from "next/server";
import { z } from "zod";
import { ErroAutorizacao } from "@/dominios/acesso/autenticacao";
import { erroOperacao } from "@/dominios/operacao/http";
import { tipoImagem } from "@/dominios/operacao/imagem";
import { concluirEtapaCampo, consultarCampo, evidencias, hashToken, novoCaminho, registrarFotoCampo } from "@/dominios/campo/campo";
import { banco } from "@/integrations/banco";

export const runtime = "nodejs";
const campoSchema = z.object({ acessoId: z.string().uuid(), evento: z.object({ id: z.string().uuid(), etapa: z.string(), revisao: z.number().int() }).passthrough(), tarefas: z.array(z.object({ id: z.string().uuid(), estado: z.string() }).passthrough()) }).passthrough();
// O token não é usuário: só o hash é consultado. Camada 1 aqui; a escrita revalida sob lock (camada 2).
async function acesso(request: Request) {
  const token = request.headers.get("X-Pieggi-Campo");
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ErroAutorizacao("Link de campo inválido.", 403);
  const sql = banco();
  const hash = hashToken(token);
  return { sql, hash, dados: campoSchema.parse(await consultarCampo(sql, hash)) };
}
export async function GET(request: Request) {
  try {
    const { dados } = await acesso(request);
    return NextResponse.json({ data: dados }, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) { return erroOperacao(error); }
}
export async function PATCH(request: Request) {
  try {
    const { sql, hash } = await acesso(request);
    const dados = z.object({ etapaId: z.string().uuid(), revisao: z.number().int().positive(), observacao: z.string().trim().max(1000) }).strict().parse(await request.json());
    const data = await concluirEtapaCampo(sql, hash, dados);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return erroOperacao(error); }
}
export async function POST(request: Request) {
  try {
    // Valida a credencial antes de aceitar o arquivo; a transação confere de novo sob lock.
    const { sql, hash, dados } = await acesso(request);
    if (Number(request.headers.get("content-length")) > 9 * 1024 * 1024) return NextResponse.json({ error: { message: "Foto deve ter até 8 MB." } }, { status: 413 });
    const form = await request.formData();
    const tarefaId = z.string().uuid().parse(form.get("tarefaId"));
    const revisao = z.coerce.number().int().positive().parse(form.get("revisao"));
    if (dados.evento.etapa !== "EM_CAMPO" || !dados.tarefas.some(t => t.id === tarefaId && t.estado !== "PRONTO")) throw new ErroAutorizacao("Tarefa indisponível para este evento.", 403);
    const foto = form.get("foto");
    if (!(foto instanceof File) || !foto.size || foto.size > 8 * 1024 * 1024) return NextResponse.json({ error: { message: "Selecione uma foto de até 8 MB." } }, { status: 400 });
    const bytes = Buffer.from(await foto.arrayBuffer());
    const tipo = tipoImagem(bytes);
    if (!tipo) return NextResponse.json({ error: { message: "Foto precisa ser JPEG, PNG ou WebP." } }, { status: 400 });
    const path = novoCaminho([dados.evento.id, dados.acessoId], tipo.extensao);
    const upload = await evidencias().upload(path, bytes, { contentType: tipo.mime, upsert: false });
    if (upload.error) throw upload.error;
    // Não apague o arquivo após resposta ambígua: a transação pode ter confirmado.
    const data = await registrarFotoCampo(sql, hash, { tarefaId, revisao, path });
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return erroOperacao(error); }
}
