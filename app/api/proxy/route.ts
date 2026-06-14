// app/api/proxy/route.ts
// Forwards all requests to Railway backend.
// Handles BOTH multipart/form-data (upload) AND application/json (chat).

import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://aibos-api-production.up.railway.app";

async function proxyRequest(req: NextRequest, method: string): Promise<NextResponse> {
  // Strip the /api/proxy prefix to get the target path
  const url = new URL(req.url);
  const targetPath = url.pathname.replace(/^\/api\/proxy/, "") || "/";
  const targetURL = `${API_BASE}${targetPath}${url.search}`;

  const ct = req.headers.get("content-type") ?? "";

  let body: BodyInit | undefined;
  const headers: HeadersInit = {};

  // Pass through Authorization if present
  const auth = req.headers.get("authorization");
  if (auth) headers["authorization"] = auth;

  if (method === "GET" || method === "DELETE") {
    body = undefined;
  } else if (ct.includes("multipart/form-data")) {
    // UPLOAD: forward raw form data — let fetch set boundary automatically
    // Do NOT set content-type header — fetch auto-sets it with the correct boundary
    body = await req.blob();
  } else if (ct.includes("application/json")) {
    // CHAT / JSON: preserve body and content-type exactly
    body = await req.text();
    headers["content-type"] = "application/json";
  } else if (ct) {
    // Any other non-empty content-type body (e.g. text/plain)
    body = await req.text();
    headers["content-type"] = ct;
  }

  try {
    const upstream = await fetch(targetURL, {
      method,
      headers,
      body,
    });

    // Read response
    const responseBody = await upstream.text();

    return new NextResponse(responseBody, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "access-control-allow-origin": "*",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[proxy] ${method} ${targetURL} → ${message}`);
    return NextResponse.json(
      { error: "Proxy error", detail: message },
      { status: 502 }
    );
  }
}

export async function GET(req: NextRequest) { return proxyRequest(req, "GET"); }
export async function POST(req: NextRequest) { return proxyRequest(req, "POST"); }
export async function PUT(req: NextRequest) { return proxyRequest(req, "PUT"); }
export async function DELETE(req: NextRequest) { return proxyRequest(req, "DELETE"); }
export async function PATCH(req: NextRequest) { return proxyRequest(req, "PATCH"); }

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization",
    },
  });
}
