import { NextRequest, NextResponse } from 'next/server';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

async function forward(req: NextRequest): Promise<NextResponse> {
  const url      = new URL(req.url);
  const stripped = url.pathname.replace(/^\/api\/proxy/, '') || '/';
  const target   = `${BACKEND}${stripped}${url.search}`;

  const headers = new Headers();
  req.headers.forEach((val, key) => {
    // Strip host — let upstream set it; strip content-length for multipart
    if (!['host', 'content-length'].includes(key.toLowerCase())) {
      headers.set(key, val);
    }
  });

  let body: BodyInit | null = null;
  const ct = req.headers.get('content-type') ?? '';

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (ct.includes('multipart/form-data')) {
      // For file uploads: read as FormData and re-send
      // This strips the original boundary and lets fetch re-encode
      try {
        const formData = await req.formData();
        body = formData;
        // Remove content-type so fetch sets the correct multipart boundary
        headers.delete('content-type');
      } catch {
        body = await req.blob();
      }
    } else {
      body = await req.text();
    }
  }

  try {
    const upstream = await fetch(target, { method: req.method, headers, body });

    const respHeaders = new Headers();
    upstream.headers.forEach((val, key) => {
      if (key.toLowerCase() !== 'transfer-encoding') {
        respHeaders.set(key, val);
      }
    });

    // Add CORS headers
    respHeaders.set('Access-Control-Allow-Origin', '*');
    respHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    respHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    const data = await upstream.arrayBuffer();
    return new NextResponse(data, { status: upstream.status, headers: respHeaders });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Proxy error', detail: msg }, { status: 502 });
  }
}

export const GET     = forward;
export const POST    = forward;
export const PUT     = forward;
export const PATCH   = forward;
export const DELETE  = forward;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
