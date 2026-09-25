/**
 * GET /api/fx: today's US dollar to Kwacha rate, for the Kwacha price switch
 * (lib/planPrice.ts). Public; see lib/fx.ts for where it comes from and why a
 * missing rate is answered with null rather than a guess.
 */
import { NextResponse } from 'next/server';
import { fetchZmwRate } from '@/lib/fx';

export const revalidate = 21600;

export async function GET() {
  const fx = await fetchZmwRate();
  return NextResponse.json(fx ?? { rate: null, asOf: null }, {
    headers: { 'Cache-Control': fx ? 'public, s-maxage=21600, stale-while-revalidate=86400' : 'public, s-maxage=600' },
  });
}
