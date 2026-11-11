import { useState, type FormEvent } from "react";
import { LockKeyhole } from "lucide-react";
import { useAuth } from "@/contexts/auth";

export function LoginPage() {
  const { entrar } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault(); setErro(""); setEnviando(true);
    try { await entrar(email, senha); }
    catch (falha) { setErro(falha instanceof Error ? falha.message : "Não foi possível entrar."); }
    finally { setEnviando(false); }
  };

  return <main className="grid min-h-screen place-items-center bg-slate-950 p-4 text-slate-950"><section className="w-full max-w-sm rounded-[14px] bg-white p-6 shadow-2xl sm:p-8"><div className="grid h-11 w-11 place-items-center rounded-lg bg-cyan-100 text-cyan-900"><LockKeyhole className="h-5 w-5" /></div><p className="mt-6 text-xs font-bold uppercase tracking-[.18em] text-cyan-800">Pieggi 360</p><h1 className="mt-2 text-2xl font-semibold">Entre no sistema</h1><p className="mt-2 text-sm text-slate-500">Acesso restrito à equipe autorizada.</p><form onSubmit={(evento) => { void enviar(evento); }} className="mt-6 grid gap-4"><label className="grid gap-1.5 text-xs font-medium"><span>E-mail</span><input type="email" autoComplete="username" required value={email} onChange={(evento) => setEmail(evento.target.value)} className="h-11 rounded-md border px-3 text-sm outline-none focus:ring-2 focus:ring-cyan-600" /></label><label className="grid gap-1.5 text-xs font-medium"><span>Senha</span><input type="password" autoComplete="current-password" required minLength={8} value={senha} onChange={(evento) => setSenha(evento.target.value)} className="h-11 rounded-md border px-3 text-sm outline-none focus:ring-2 focus:ring-cyan-600" /></label>{erro && <p role="alert" className="rounded-md bg-red-50 p-3 text-xs text-red-700">{erro}</p>}<button disabled={enviando} className="h-11 rounded-md bg-slate-950 text-sm font-semibold text-white disabled:opacity-50">{enviando ? "Entrando…" : "Entrar"}</button></form></section></main>;
}
