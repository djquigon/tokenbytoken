// The header bar of the site's pages outside the chat (the landing page and the FAQ): the brand, then
// Settings, the FAQ, and Privacy (ADRs 0009, 0010). On the landing page the brand is plain text; elsewhere
// it links home. `current` marks the page being shown.

import Link from 'next/link';

import { PrefsMenu } from '@/components/prefs/PrefsMenu';

export function SiteHeader({ home = false, current }: { home?: boolean; current?: '/faq' }) {
  return (
    <header className="site-header">
      {home ? (
        <span className="brand">Token by Token</span>
      ) : (
        <Link href="/" className="brand">
          Token by Token
        </Link>
      )}
      <nav aria-label="Site">
        <PrefsMenu />
        <Link href="/faq" aria-current={current === '/faq' ? 'page' : undefined}>
          FAQ
        </Link>
        <Link href="/privacy">Privacy</Link>
      </nav>
    </header>
  );
}
