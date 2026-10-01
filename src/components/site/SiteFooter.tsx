// The footer bar of the site's pages outside the chat: the tagline, links to every page, and what the
// project is. `current` marks the page being shown.

import Link from 'next/link';

const PAGES = [
  { href: '/chat', label: 'Chat' },
  { href: '/sample', label: 'Sample' },
  { href: '/faq', label: 'FAQ' },
  { href: '/privacy', label: 'Privacy' },
] as const;

export function SiteFooter({ current }: { current?: (typeof PAGES)[number]['href'] }) {
  return (
    <footer className="site-footer">
      <p className="footer-brand">
        Token by Token <span aria-hidden="true">{'//'}</span> An educational LLM visualizer
      </p>
      <nav aria-label="Footer">
        {PAGES.map((p) => (
          <Link key={p.href} href={p.href} aria-current={p.href === current ? 'page' : undefined}>
            {p.label}
          </Link>
        ))}
      </nav>
      <p className="footer-note">
        A personal, non-commercial project. Replies come from OpenAI&rsquo;s API, and this site doesn&rsquo;t store your conversations on its servers.
      </p>
    </footer>
  );
}
