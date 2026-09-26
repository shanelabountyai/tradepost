'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** P0-7: threads are plain polling (PRD non-goal: real-time chat). Re-renders the page's server data; typed text survives. */
export function Poll({ ms = 10_000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === 'visible' && router.refresh(), ms);
    return () => clearInterval(t);
  }, [router, ms]);
  return null;
}
