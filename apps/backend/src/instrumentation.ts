/** Roda uma vez quando o servidor sobe: abre o pool do banco antes do primeiro clique. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { aquecerBanco } = await import("@/integrations/banco");
  void aquecerBanco();
}
