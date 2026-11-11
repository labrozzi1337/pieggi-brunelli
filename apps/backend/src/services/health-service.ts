import { banco } from "@/integrations/banco";

export type DatabaseStatus = "connected" | "unavailable" | "unconfigured";

/** Conexão direta com o Postgres; "unconfigured" quando falta PIEGGI_DATABASE_URL. */
export async function checkDatabase(): Promise<DatabaseStatus> {
  if (!process.env.PIEGGI_DATABASE_URL) return "unconfigured";
  try {
    await banco()`select 1 from fiscal_empresas limit 1`;
    return "connected";
  } catch {
    return "unavailable";
  }
}
