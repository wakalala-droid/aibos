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

  const hasBody = method !== "GET" && method !== "DELETE" && req.body != null;
  const isMultipart = ct.includes("multipart/form-data");

  if (hasBody && ct) {
    // Preserve the original Content-Type. For multipart this is essential — it
    // carries the `boundary=...` that matches the raw bytes we forward verbatim.
    headers["content-type"] = ct;
  }

  let init: RequestInit & { duplex?: "half" };
  if (hasBody && isMultipart) {
    // Stream file uploads straight through instead of buffering — buffering via
    // req.blob()/req.formData() is what throws Next.js's "There was an error
    // parsing the body". Forwarding req.body as a ReadableStream sidesteps the
    // parse step entirely and avoids loading whole files into memory. When the
    // body is a stream, fetch requires duplex:"half".
    // (`duplex` is valid at runtime but missing from the TS RequestInit type.)
    init = { method, headers, body: req.body, duplex: "half" };
  } else if (hasBody) {
    // Everything else (JSON etc) is small — buffer it. Streaming these via
    // duplex:"half" is unreliable on Vercel's production Node runtime and
    // throws "expected non-null body source" even for empty/tiny bodies.
    init = { method, headers, body: await req.text() };
  } else {
    init = { method, headers };
  }

  try {
    const res = await fetch(upstream, init);
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
    // Node's fetch wraps the real network error in `.cause` (e.g. ECONNRESET,
    // UND_ERR_*) — without logging it, every failure looks like a bare
    // "fetch failed" with no way to diagnose it.
    const cause = err instanceof Error && err.cause ? ` cause=${String(err.cause)}` : "";
    console.error(`[proxy] ${method} ${upstream} → ${msg}${cause}`);
    return NextResponse.json(
      { error: "Proxy error", detail: `Could not reach backend: ${msg}${cause}` },
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
