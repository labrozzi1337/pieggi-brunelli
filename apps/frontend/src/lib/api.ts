import { z } from "zod";

const healthSchema = z.object({
  data: z.object({
    service: z.literal("start-back-api"),
    status: z.enum(["ok", "degraded"]),
    database: z.enum(["connected", "unconfigured", "unavailable"]),
    schema: z.literal("start_back"),
    timestamp: z.string().datetime()
  }),
  meta: z.object({ requestId: z.string().min(1) })
});

export type HealthResponse = z.infer<typeof healthSchema>;

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "")
  ?? (import.meta.env.DEV ? "http://localhost:3000" : "");

export async function getHealth(signal: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${API_URL}/api/v1/health`, { signal });
  const body: unknown = await response.json();

  if (!response.ok && response.status !== 503) {
    throw new Error("A API não respondeu corretamente.");
  }

  const parsed = healthSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error("A resposta da API possui formato inválido.");
  }

  return parsed.data;
}
