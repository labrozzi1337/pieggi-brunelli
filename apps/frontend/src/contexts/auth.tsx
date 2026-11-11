import { createContext, useContext } from "react";
import type { UsuarioSessao } from "@/lib/api";

export interface AuthContextValue {
  usuario: UsuarioSessao | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error("AuthProvider não encontrado.");
  return contexto;
}
