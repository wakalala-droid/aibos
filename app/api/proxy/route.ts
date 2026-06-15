// app/api/proxy/route.ts
// Next.js route handler — proxies all requests to Railway backend.
// Correctly handles:
//   - multipart/form-data (file uploads) — preserves boundary
//   - application/json (chat, data-studio) — preserves body + content-type
//   - GET / DELETE (no body)

import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://aibos-api-production.up.railway.app";

async function proxy(req: NextRequest, method: string): Promise<NextResponse> {
  const url = new URL(req.url);
  // Strip /api/proxy prefix to get downstream path
  const path = url.pathname.replace(/^\/api\/proxy/, "") || "/";
  const upstream = `${API_BASE}${path}${url.search}`;

  const ct = req.headers.get("content-type") ?? "";
  const headers: Record<string, string> = {};

  const auth = req.headers.get("authorization");
  if (auth) headers["authorization"] = auth;

  let body: BodyInit | undefined;

  if (method !== "GET" && method !== "DELETE") {
    if (ct.includes("multipart/form-data")) {
      // Upload — pass raw bytes; do NOT set content-type so fetch auto-adds boundary
      body = await req.blob();
    } else if (ct.includes("application/json")) {
      // Chat / data-studio — must preserve Content-Type + body exactly
      body = await req.text();
      headers["content-type"] = "application/json";
    } else if (ct) {
      body = await req.text();
      headers["content-type"] = ct;
    }
  }

  try {
    const res = await fetch(upstream, { method, headers, body });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/json",
        "access-control-allow-origin": "*",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[proxy] ${method} ${upstream} → ${msg}`);
    return NextResponse.json({ error: "Proxy error", detail: msg }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  return proxy(req, "GET");
}
export async function POST(req: NextRequest) {
  return proxy(req, "POST");
}
export async function PUT(req: NextRequest) {
  return proxy(req, "PUT");
}
export async function DELETE(req: NextRequest) {
  return proxy(req, "DELETE");
}
export async function PATCH(req: NextRequest) {
  return proxy(req, "PATCH");
}
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS",
      "access-control-allow-headers": "Content-Type,Authorization",
    },
  });
}
