/** Roda uma vez quando o servidor sobe: abre o pool do banco antes do primeiro clique. */
export async function register() {
  // Só no servidor Node em execução; no build (next build) não abre conexão.
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { aquecerBanco } = await import("@/integrations/banco");
  void aquecerBanco();
}
