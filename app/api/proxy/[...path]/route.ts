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
import { apiBase } from "@/lib/api-base";

// Force this route to run on the Node.js runtime (not Edge) so streaming
// request bodies (file uploads) are handled reliably.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A chat answer, a large Excel import or a first request to a server waking up
// can take well over the platform's default function limit, and a request cut
// off here reaches the owner as a bare "Proxy error".
export const maxDuration = 60;

// Response types relayed as raw bytes. Reading them as text decoded binary as
// UTF-8 and replaced every invalid byte, so a payslip PDF downloaded through
// here was corrupt and would not open.
function isTextual(ct: string): boolean {
  return /^(application\/(json|problem\+json|xml|x-www-form-urlencoded)|text\/)/i.test(ct);
}

async function proxy(req: NextRequest, method: string): Promise<NextResponse> {
  /*
    Resolved per request rather than once at module load. The address used to
    be a module constant with the Railway URL as its fallback, so a missing
    variable produced a working-looking site pointed at a dead host. Now a
    missing variable is a 503 that says which variable and what to do.
  */
  const base = apiBase();
  if (!base.ok) {
    console.error("[proxy] %s", base.reason);
    return NextResponse.json(
      { error: "The backend is not configured.", detail: base.reason },
      { status: 503 },
    );
  }
  const API_BASE = base.url;

  const url = new URL(req.url);
  // Strip the /api/proxy prefix to get the downstream backend path.
  const path = url.pathname.replace(/^\/api\/proxy/, "") || "/";
  const upstream = `${API_BASE}${path}${url.search}`;

  const ct = req.headers.get("content-type") ?? "";
  const headers: Record<string, string> = {};

  const auth = req.headers.get("authorization");
  if (auth) headers["authorization"] = auth;

  // Multi-business scope (audit #16): forward the active-business header so the
  // backend resolves which venture's books this request touches.
  const biz = req.headers.get("x-business-id");
  if (biz) headers["x-business-id"] = biz;
  // Which set of books a person invited into another business is working in.
  const actingAs = req.headers.get("x-acting-as");
  if (actingAs) headers["x-acting-as"] = actingAs;

  // The visitor's own address. Without it the API saw every request arrive
  // from this server, so the per-address limits on the public payment page
  // were one limit shared by every customer paying at once. The platform sets
  // x-real-ip itself and does not let a client choose it.
  const clientIp = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (clientIp) headers["x-forwarded-for"] = clientIp;

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
    const resCt = res.headers.get("content-type") ?? "application/json";

    // Server-Sent Events (the streamed AI chat, audit #21) must be piped
    // through UNBUFFERED — awaiting res.text() here would hold every token
    // until the answer finished, defeating the whole point of streaming.
    if (resCt.includes("text/event-stream") && res.body) {
      return new NextResponse(res.body, {
        status: res.status,
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache, no-transform",
          "x-accel-buffering": "no",
          connection: "keep-alive",
        },
      });
    }

    // Headers a download or a throttled request needs on the way back.
    const passthrough: Record<string, string> = { "content-type": resCt };
    for (const h of ["content-disposition", "retry-after"]) {
      const v = res.headers.get(h);
      if (v) passthrough[h] = v;
    }

    if (res.ok && !isTextual(resCt)) {
      return new NextResponse(await res.arrayBuffer(), { status: res.status, headers: passthrough });
    }

    const text = await res.text();

    /*
      SAY WHEN THE THING ON THE OTHER END IS NOT OUR API.

      Every error this API raises is FastAPI-shaped: {"detail": "..."}, and the
      clients read `detail` to show the user something useful. A reply with no
      `detail` did not come from us, it came from whatever is answering at that
      address — and the clients fall back to "Request failed (404)", which says
      nothing about where to look.

      That is not hypothetical. Pointed at the retired Railway host, this proxy
      faithfully relayed `{"status":"error","code":404,"message":"Application
      not found"}` and the Hospitality screen showed "Request failed (404)".
      The address was the whole problem and nothing on screen said so.

      So: on an error with no `detail`, put one in, naming the host that
      answered. `upstream` is built from NEXT_PUBLIC_API_URL, which is public
      by definition, so there is nothing here a visitor could not already read.
    */
    if (!res.ok) {
      let looksLikeOurApi = false;
      try {
        looksLikeOurApi = typeof JSON.parse(text)?.detail === "string";
      } catch {
        /* not JSON at all — an HTML error page, say. Definitely not ours. */
      }
      if (!looksLikeOurApi) {
        const host = (() => {
          try { return new URL(API_BASE).host; } catch { return API_BASE; }
        })();
        console.error("[proxy] %s %s -> %s (not an API response): %s",
          method, path, res.status, text.slice(0, 200));
        return NextResponse.json(
          {
            detail:
              `The backend at ${host} answered ${res.status}, and it was not ` +
              `this API. Check NEXT_PUBLIC_API_URL points at the running ` +
              `service, then redeploy so the new value is built in.`,
            upstream_status: res.status,
            upstream_body: text.slice(0, 300),
          },
          { status: 502 },
        );
      }
    }

    // No CORS header: this proxy is called same-origin from our own app. A
    // wildcard `access-control-allow-origin` here would let any website read
    // these responses through a victim's browser — remove it entirely.
    return new NextResponse(text, {
      status: res.status,
      headers: passthrough,
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
  // Same-origin calls don't preflight; return a bare 204 with no permissive CORS.
  return new NextResponse(null, { status: 204 });
}
