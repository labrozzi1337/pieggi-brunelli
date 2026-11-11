import { useEffect, useRef } from "react";
import { api, limparCache } from "./api";

/** Intervalo da checagem "mudou algo nesta empresa?" (uma consulta mínima no servidor). */
const INTERVALO_MS = 3000;
const EVENTO = "pieggi:mudou";

/**
 * Um único vigia por aba (montado no layout): quando outra pessoa altera algo, limpa o cache de leituras
 * e avisa as telas abertas, que recarregam sozinhas. Pausa com a aba em segundo plano e confere ao voltar.
 */
export function useVigiaMudancas(empresaId: string | undefined) {
  useEffect(() => {
    if (!empresaId) return;
    let ultima: string | undefined, ativo = true, consultando = false;
    const conferir = async () => {
      if (consultando || document.visibilityState !== "visible") return;
      consultando = true;
      try {
        const { versao } = await api<{ versao: string }>(`/api/v1/mudancas?empresaId=${encodeURIComponent(empresaId)}`);
        if (ativo && ultima !== undefined && versao !== ultima) { limparCache(); window.dispatchEvent(new Event(EVENTO)); }
        ultima = versao;
      } catch { /* sem rede: tenta no próximo ciclo */ } finally { consultando = false; }
    };
    void conferir();
    const timer = window.setInterval(() => { void conferir(); }, INTERVALO_MS);
    const aoVoltar = () => { void conferir(); };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => { ativo = false; clearInterval(timer); document.removeEventListener("visibilitychange", aoVoltar); window.removeEventListener("focus", aoVoltar); };
  }, [empresaId]);
}

/** Recarrega a tela quando o vigia detecta mudança. `pausado` evita perder uma edição em andamento. */
export function useAoMudar(recarregar: () => unknown, pausado = false) {
  const ref = useRef({ recarregar, pausado });
  useEffect(() => { ref.current = { recarregar, pausado }; });
  useEffect(() => {
    const aoMudar = () => { if (!ref.current.pausado) void ref.current.recarregar(); };
    window.addEventListener(EVENTO, aoMudar);
    return () => window.removeEventListener(EVENTO, aoMudar);
  }, []);
}
