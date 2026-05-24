import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const RAILWAY = 'https://aibos-api-production.up.railway.app';

export async function POST(request: NextRequest) {
  try {
    const url      = new URL(request.url);
    const endpoint = url.searchParams.get('endpoint') ?? '/upload';
    
    // Build Railway URL with all query params except 'endpoint'
    const railwayUrl = new URL(endpoint, RAILWAY);
    url.searchParams.forEach((v, k) => {
      if (k !== 'endpoint') railwayUrl.searchParams.set(k, v);
    });

    const contentType = request.headers.get('content-type') ?? '';
    
    let fetchOptions: RequestInit;
    
    if (contentType.includes('multipart/form-data')) {
      // Forward form data as-is for file upload
      const formData = await request.formData();
      fetchOptions = { method: 'POST', body: formData };
    } else {
      // JSON body
      const body = await request.text();
      fetchOptions = {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      };
    }

    const response = await fetch(railwayUrl.toString(), fetchOptions);
    const data     = await response.json();
    
    return NextResponse.json(data, { status: response.status });

  } catch (error: any) {
    console.error('[Proxy POST]', error);
    return NextResponse.json(
      { ok: false, error: error.message ?? 'Proxy error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url      = new URL(request.url);
    const endpoint = url.searchParams.get('endpoint') ?? '/health';
    
    const railwayUrl = new URL(endpoint, RAILWAY);
    url.searchParams.forEach((v, k) => {
      if (k !== 'endpoint') railwayUrl.searchParams.set(k, v);
    });

    const response = await fetch(railwayUrl.toString());
    const data     = await response.json();
    
    return NextResponse.json(data, { status: response.status });

  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message ?? 'Proxy error' },
      { status: 500 }
    );
  }
}
