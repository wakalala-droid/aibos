// app/api/proxy/[...path]/route.ts
// CATCH-ALL proxy — forwards EVERY /api/proxy/* sub-path to the Railway backend.
//
// Why this file exists:
//   app/api/proxy/route.ts matches ONLY the exact path "/api/proxy".
//   Sub-paths like /api/proxy/upload and /api/proxy/chat were falling through
//   to Vercel's 404 HTML page (the "404: This page could not be found" error).
//   A [...path] segment catches all of them.
//
// Handles:
//   - multipart/form-data (file uploads) — preserves boundary
//   - application/json (chat, data-studio) — preserves body + content-type
//   - GET / DELETE (no body)

import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://aibos-api-production.up.railway.app";

// Force this route to run on the Node.js runtime (not Edge) so streaming
// request bodies (file uploads) are handled reliably.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function proxy(req: NextRequest, method: string): Promise<NextResponse> {
  const url = new URL(req.url);
  // Strip the /api/proxy prefix to get the downstream backend path.
  const path = url.pathname.replace(/^\/api\/proxy/, "") || "/";
  const upstream = `${API_BASE}${path}${url.search}`;

  const ct = req.headers.get("content-type") ?? "";
  const headers: Record<string, string> = {};

  const auth = req.headers.get("authorization");
  if (auth) headers["authorization"] = auth;

  let body: BodyInit | undefined;

  if (method !== "GET" && method !== "DELETE") {
    if (ct.includes("multipart/form-data")) {
      // Upload — pass raw bytes; do NOT set content-type so fetch re-adds the boundary.
      body = await req.blob();
    } else if (ct.includes("application/json")) {
      // Chat / data-studio — preserve Content-Type + body exactly.
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
    return NextResponse.json(
      { error: "Proxy error", detail: `Could not reach backend: ${msg}` },
      { status: 502 }
    );
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
