import { NextResponse, type NextRequest } from "next/server";
import { getAllowedOrigins } from "@/config/env";

const API_PREFIX = "/api/";
const ALLOWED_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const ALLOWED_HEADERS = "Authorization,Content-Type,Idempotency-Key,X-Request-Id,X-Pieggi-Campo";

export function proxy(request: NextRequest): NextResponse {
  if (!request.nextUrl.pathname.startsWith(API_PREFIX)) {
    return NextResponse.next();
  }

  const origin = request.headers.get("origin");
  // Mesma origem (via proxy do Vite ou nginx) sempre passa; origens cruzadas só as da lista.
  const originAllowed = !origin || getAllowedOrigins().includes(origin) || (URL.canParse(origin) && new URL(origin).host === request.headers.get("host"));

  if (!originAllowed) {
    return NextResponse.json({
      error: { code: "ORIGIN_NOT_ALLOWED", message: "Origem não permitida." }
    }, { status: 403 });
  }

  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const response = request.method === "OPTIONS"
    ? new NextResponse(null, { status: 204 })
    : NextResponse.next({ request: { headers: requestHeaders } });

  if (origin) response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
  response.headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Vary", "Origin");
  response.headers.set("X-Request-Id", requestId);
  return response;
}

export const config = { matcher: "/api/:path*" };

