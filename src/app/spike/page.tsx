import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { SpikeClient } from './spike-client';

export const metadata: Metadata = {
  title: 'Streaming spike · Token by Token',
  robots: { index: false, follow: false },
};

// Diagnostic page for Phase 0 (docs/PLAN.md §4). Hidden unless SPIKE_ENABLED=1.
export default async function SpikePage() {
  await connection(); // decide per request, never at build time
  if (process.env.SPIKE_ENABLED !== '1') notFound();
  return <SpikeClient />;
}
