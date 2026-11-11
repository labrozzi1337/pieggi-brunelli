import { z } from "zod";

const serverEnvSchema = z.object({
  PIEGGI_SUPABASE_URL: z.url(),
  PIEGGI_SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  PIEGGI_ALLOWED_ORIGINS: z.string().default("http://localhost:5173")
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): { ok: true; data: ServerEnv } | { ok: false; issues: string[] } {
  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    return {
      ok: false,
      issues: result.error.issues.map((issue) => issue.path.join("."))
    };
  }

  return { ok: true, data: result.data };
}

export function getAllowedOrigins(): string[] {
  return (process.env.PIEGGI_ALLOWED_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

