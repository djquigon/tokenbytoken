import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';

import { THEME_INIT_SCRIPT } from '@/components/prefs/store';
import { CHAT_PRELOAD_SCRIPT } from '@/generation/conversation-store';
import { SITE } from '@/shared/site';

import './globals.css';

// Self-hosted at build time by next/font, so the CSP's font-src 'self' holds.
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], variable: '--font-plex-sans', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-mono', display: 'swap' });

export const metadata: Metadata = {
  // Pages set only their own part, as in "FAQ · How does an AI work?".
  title: { default: `${SITE.name} ${SITE.answer}`, template: `%s · ${SITE.name}` },
  description: 'Ask a real AI chatbot a question, then step through how its reply was made, token by token, with every value labeled.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // The theme script sets data attributes before hydration, so React must not warn about them.
    <html lang="en" data-theme="dark" data-effects="on" data-motion="system" className={`${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT + CHAT_PRELOAD_SCRIPT }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
