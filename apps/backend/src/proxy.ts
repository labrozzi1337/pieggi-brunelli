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
  // Mesma origem (proxy do Vite, nginx ou rewrite da Vercel) sempre passa; origens cruzadas só as da lista.
  // Atrás de proxy/rewrite o Host pode ser interno: o domínio público chega em x-forwarded-host.
  const hostOrigem = URL.canParse(origin ?? "") ? new URL(origin!).host : null;
  const hostsDoSite = [request.headers.get("host"), ...(request.headers.get("x-forwarded-host") ?? "").split(",").map((h) => h.trim())];
  const originAllowed = !origin || getAllowedOrigins().includes(origin) || (!!hostOrigem && hostsDoSite.includes(hostOrigem));

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

