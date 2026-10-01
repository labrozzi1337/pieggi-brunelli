import { NextResponse } from "next/server";
import { getServerEnv } from "@/config/env";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { log } from "@/lib/logger";
import { checkDatabase } from "@/services/health-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const env = getServerEnv();

  if (!env.ok) {
    log("warn", "Configuração do Supabase ausente ou inválida.", {
      event: "health.database_unconfigured",
      requestId
    });

    return NextResponse.json({
      data: healthData("degraded", "unconfigured"),
      meta: { requestId }
    }, { status: 503 });
  }

  const database = await checkDatabase(createServerSupabaseClient(env.data));

  if (database === "unavailable") {
    log("error", "Não foi possível consultar o schema da aplicação.", {
      event: "health.database_unavailable",
      requestId,
      errorCode: "DATABASE_UNAVAILABLE"
    });
  }

  return NextResponse.json({
    data: healthData(database === "connected" ? "ok" : "degraded", database),
    meta: { requestId }
  }, { status: database === "connected" ? 200 : 503 });
}

function healthData(
  status: "ok" | "degraded",
  database: "connected" | "unconfigured" | "unavailable"
) {
  return {
    service: "start-back-api" as const,
    status,
    database,
    schema: "start_back" as const,
    timestamp: new Date().toISOString()
  };
}

