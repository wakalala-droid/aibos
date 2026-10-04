// Which build is live right now. The app compares it with the build it is
// running (NEXT_PUBLIC_BUILD_SHA, fixed at build time) and offers the update
// when they differ (components/pwa/UpdatePrompt.tsx). Never cached: the whole
// point is to see a deploy the moment it lands.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    { build: process.env.VERCEL_GIT_COMMIT_SHA || 'dev' },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
