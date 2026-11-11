import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { entrar as autenticar, obterSessao, sair as encerrarSessao, type UsuarioSessao } from "@/lib/api";
import { AuthContext } from "./auth";

const CHAVE = "pieggi.sessao";
function lembrado(): UsuarioSessao | null {
  try { return JSON.parse(localStorage.getItem(CHAVE) ?? "null") as UsuarioSessao | null; } catch { return null; }
}
function lembrar(u: UsuarioSessao | null) {
  try { if (u) localStorage.setItem(CHAVE, JSON.stringify(u)); else localStorage.removeItem(CHAVE); } catch { /* armazenamento indisponível */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Abre direto com o último usuário conhecido e confirma a sessão em segundo plano: a tela não espera o servidor.
  // É só exibição: toda chamada à API continua validando a sessão no backend.
  const [usuario, setUsuarioEstado] = useState<UsuarioSessao | null>(lembrado);
  const [carregando, setCarregando] = useState(!usuario);
  const setUsuario = useCallback((u: UsuarioSessao | null) => { lembrar(u); setUsuarioEstado(u); }, []);

  useEffect(() => { obterSessao().then(setUsuario).catch(() => setUsuario(null)).finally(() => setCarregando(false)); }, [setUsuario]);

  const valor = useMemo(() => ({
    usuario, carregando,
    entrar: async (email: string, senha: string) => { setUsuario(await autenticar(email, senha)); },
    sair: async () => { setUsuario(null); await encerrarSessao(); }
  }), [usuario, carregando, setUsuario]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
