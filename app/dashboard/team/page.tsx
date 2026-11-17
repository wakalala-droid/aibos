'use client';
/**
 * The AIBOS team lives on Home since 17 November 2026 (owner: "part of the
 * home page, not separated from it"; components/home/HomeTeam.tsx). This
 * address stays for old links (the evening "AIBOS did N things" note, a saved
 * bookmark) and sends them to the team on Home.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TeamPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard#team'); }, [router]);
  return null;
}
