import { getServerEnv } from "@/config/env";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { banco } from "@/integrations/banco";

export const papeisUsuario = ["ADMIN", "COMERCIAL", "ATENDIMENTO", "FINANCEIRO", "PROGRAMACAO", "PRODUCAO", "EXPEDICAO_COMPRAS", "CAMPO"] as const;
export type PapelUsuario = (typeof papeisUsuario)[number];

export const COOKIE_ACESSO = "pieggi_access_token";
export const COOKIE_RENOVACAO = "pieggi_refresh_token";

export interface UsuarioAutenticado {
  id: string;
  email: string;
  nome: string;
  papeis: PapelUsuario[];
  empresas: string[];
}

export class ErroAutorizacao extends Error {
  public constructor(message: string, public readonly status: 401 | 403 | 503) { super(message); }
}

// Estado do processo: cliente de verificação (guarda as chaves públicas por 10 min), perfis recentes e sessões encerradas.
// ponytail: em memória por instância; com várias instâncias, o logout revoga só na que o atendeu (o token expira sozinho em até 1 h).
interface EstadoAuth { verificador?: ReturnType<typeof createServerSupabaseClient>; perfis: Map<string, { ate: number; usuario: UsuarioAutenticado }>; encerradas: Map<string, number> }
const global = globalThis as typeof globalThis & { pieggiAuth?: EstadoAuth };
const auth: EstadoAuth = (global.pieggiAuth ??= { perfis: new Map(), encerradas: new Map() });
/** Papéis e status do usuário são relidos a cada 30 s: desativação ou troca de papel vale em até 30 s. */
const PERFIL_TTL_MS = 30_000;

export async function autenticar(request: Request, permitidos?: readonly PapelUsuario[]): Promise<UsuarioAutenticado> {
  const ambiente = getServerEnv();
  if (!ambiente.ok) throw new ErroAutorizacao("Backend não configurado.", 503);
  const token = extrairToken(request);
  if (!token) throw new ErroAutorizacao("Sessão não autenticada.", 401);
  // Assinatura (ES256, chaves públicas do projeto) e validade conferidas localmente: sem ida ao servidor de auth por requisição.
  const { data, error } = await (auth.verificador ??= createServerSupabaseClient(ambiente.data)).auth.getClaims(token);
  const claims = data?.claims;
  if (error || !claims?.sub || claims.role !== "authenticated") throw new ErroAutorizacao("Sessão inválida ou expirada.", 401);
  if (claims.session_id && auth.encerradas.has(claims.session_id)) throw new ErroAutorizacao("Sessão encerrada.", 401);
  const cache = auth.perfis.get(claims.sub);
  const usuario = cache && cache.ate > Date.now() ? cache.usuario : await carregarUsuario(claims.sub, claims.email ?? "");
  if (cache?.usuario !== usuario) auth.perfis.set(claims.sub, { ate: Date.now() + PERFIL_TTL_MS, usuario });
  if (permitidos && !usuario.papeis.some((papel) => permitidos.includes(papel))) throw new ErroAutorizacao("Perfil sem permissão para esta operação.", 403);
  return usuario;
}

/** Logout: o token de acesso deixa de valer neste servidor na hora, mesmo antes de expirar. */
export function encerrarSessao(token: string): void {
  try {
    const { session_id: sessao, exp, sub } = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()) as { session_id?: string; exp?: number; sub?: string };
    const agora = Date.now();
    for (const [id, ate] of auth.encerradas) if (ate < agora) auth.encerradas.delete(id);
    if (sessao) auth.encerradas.set(sessao, (exp ?? 0) * 1000 || agora + 3_600_000);
    if (sub) auth.perfis.delete(sub);
  } catch { /* token malformado: nada a revogar */ }
}

export async function carregarUsuario(id: string, email: string, permitidos?: readonly PapelUsuario[]): Promise<UsuarioAutenticado> {
  const [perfil] = await banco()<{ nome: string; ativo: boolean; papeis: string[]; empresas: string[] }[]>`
    select nome, ativo,
      array(select papel::text from usuario_papeis where usuario_id = u.id) papeis,
      array(select empresa_id::text from usuario_empresas where usuario_id = u.id) empresas
    from usuarios u where id = ${id}`;
  if (!perfil || perfil.ativo !== true) throw new ErroAutorizacao("Usuário sem acesso ativo.", 403);
  const papeisAtivos = perfil.papeis.filter((p): p is PapelUsuario => papeisUsuario.includes(p as PapelUsuario));
  if (permitidos && !papeisAtivos.some((papel) => permitidos.includes(papel))) throw new ErroAutorizacao("Perfil sem permissão para esta operação.", 403);
  return { id, email, nome: perfil.nome, papeis: papeisAtivos, empresas: perfil.empresas };
}

export function exigirPapel(usuario: UsuarioAutenticado, permitidos: readonly PapelUsuario[]): void {
  if (!usuario.papeis.some((p) => p === "ADMIN" || permitidos.includes(p))) throw new ErroAutorizacao("Perfil sem permissão para esta operação.", 403);
}

export function autorizarEmpresa(usuario: UsuarioAutenticado, empresaId: string): void {
  if (!usuario.empresas.includes(empresaId)) throw new ErroAutorizacao("Empresa fora do escopo do usuário.", 403);
}

export function extrairToken(request: Request, cookie = COOKIE_ACESSO): string | undefined {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) return bearer;
  const par = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${cookie}=`));
  return par ? decodeURIComponent(par.slice(cookie.length + 1)) : undefined;
}
